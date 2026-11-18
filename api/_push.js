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

// except 를 뺀 모든 구독자에게 보낸다. 만료된 구독(404/410)은 지운다. 실패해도 예외를 던지지 않는다.
async function sendToAll(payload, exceptUserId) {
  vapid();
  const [subs] = await L.db().query("SELECT id, endpoint, p256dh, auth FROM push_subs WHERE user_id <> ?", [exceptUserId || 0]);
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(subs.map((s) =>
    webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 86400, timeout: 8000 })
      .catch(async (e) => { if (e.statusCode === 404 || e.statusCode === 410) await L.db().query("DELETE FROM push_subs WHERE id = ?", [s.id]); throw e; })));
  return { sent: results.filter((r) => r.status === "fulfilled").length, failed: results.filter((r) => r.status === "rejected").length };
}

module.exports = { vapid, hashOf, sendToAll };
