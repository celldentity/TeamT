// 폰 푸시 알림(웹 푸시) 공용. 파일명이 _ 로 시작해 Vercel 이 라우트로 노출하지 않는다.
// VAPID 키는 새 비밀값을 만들지 않고 SESSION_SECRET 에서 HMAC 으로 항상 같은 값을 뽑아 쓴다
// (환경변수를 더 늘리지 않으려고). SESSION_SECRET 을 바꾸면 키도 바뀌어 기존 구독은 다시 켜야 한다.
const crypto = require("crypto");
const webpush = require("web-push");
const L = require("./_lib");

let keys;
function vapid() {
  if (keys) return keys;
  for (let i = 0; ; i++) {
    const priv = crypto.createHmac("sha256", L.env.SESSION_SECRET).update("vapid-p256:" + i).digest();
    const ecdh = crypto.createECDH("prime256v1");
    try { ecdh.setPrivateKey(priv); } catch { continue; } // 곡선 범위를 벗어나는 드문 값은 건너뜀
    keys = { publicKey: ecdh.getPublicKey().toString("base64url"), privateKey: priv.toString("base64url") };
    webpush.setVapidDetails("https://t-niping.vercel.app", keys.publicKey, keys.privateKey);
    return keys;
  }
}

const hashOf = (endpoint) => crypto.createHash("sha256").update(endpoint).digest("hex");

// 한 기기로 보낸다. 만료된 구독(404/410)은 지운다.
const deliver = (s, body) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 86400, timeout: 8000 })
  .catch(async (e) => { if (e.statusCode === 404 || e.statusCode === 410) await L.db().query("DELETE FROM push_subs WHERE id = ?", [s.id]); throw e; });

// 받을 사람에게 한 명씩 개인 알림을 보낸다. userIds 가 null 이면 구독한 모든 팀원, exceptIds 는 뺀다(보통 행동한 본인).
// make(userId) 가 보낼 내용 {title, body, url, tag, badge?} 를 돌려준다. badge 가 "auto" 면 그 사람의 «안 읽은 알림 수»를 계산해 앱 아이콘 숫자로 같이 보낸다.
// 실패해도 예외를 던지지 않는다 — 글·댓글·좋아요 자체는 이미 성공했으니 알림 실패가 그것을 망치면 안 된다.
async function notify(userIds, make, exceptIds = []) {
  if (userIds && !userIds.length) return { users: 0, sent: 0, failed: 0 };
  vapid();
  const db = L.db(), skip = new Set(exceptIds.filter(Boolean));
  const [subs] = userIds ? await db.query("SELECT id, user_id, endpoint, p256dh, auth FROM push_subs WHERE user_id IN (?)", [userIds]) : await db.query("SELECT id, user_id, endpoint, p256dh, auth FROM push_subs");
  const by = new Map();
  for (const s of subs) if (!skip.has(s.user_id)) { if (!by.has(s.user_id)) by.set(s.user_id, []); by.get(s.user_id).push(s); }
  let sent = 0, failed = 0;
  await Promise.all([...by].map(async ([uid, list]) => {
    try {
      const payload = await make(uid); if (!payload) return;
      if (payload.badge === "auto") payload.badge = await require("./_notif").unread(db, uid);
      const body = JSON.stringify(payload);
      const rs = await Promise.allSettled(list.map((s) => deliver(s, body)));
      sent += rs.filter((r) => r.status === "fulfilled").length; failed += rs.filter((r) => r.status === "rejected").length;
    } catch (e) { failed += list.length; console.error("notify", uid, e); }
  }));
  return { users: by.size, sent, failed };
}
// 알림을 켠 직후 «켜졌어요» 확인용으로 그 기기 하나에만 보낸다(DB 에 저장하기 전의 구독 정보 그대로)
const sendRaw = (sub, payload) => { vapid(); return webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 600, timeout: 8000 }); };

module.exports = { vapid, hashOf, notify, sendRaw };
