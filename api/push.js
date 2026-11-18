// 폰 푸시 알림 구독 — 로그인한 사람만.
//   GET    /api/push                → {publicKey}            (브라우저가 구독할 때 쓰는 공개키)
//   POST   /api/push {subscription} → 이 기기를 내 구독으로 저장(같은 기기면 갱신)
//   DELETE /api/push {endpoint}     → 이 기기 구독 해제
const L = require("./_lib");
const P = require("./_push");

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    if (req.method === "GET") return L.json(res, 200, { publicKey: P.vapid().publicKey });
    if (!["POST", "DELETE"].includes(req.method)) return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
    if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });
    const b = L.readBody(req), db = L.db();

    if (req.method === "DELETE") {
      const ep = String(b.endpoint || "");
      if (!ep) return L.json(res, 400, { error: "잘못된 요청입니다." });
      await db.query("DELETE FROM push_subs WHERE endpoint_hash = ? AND user_id = ?", [P.hashOf(ep), me.id]);
      return L.json(res, 200, { ok: true });
    }

    const s = b.subscription || {}, ep = String(s.endpoint || ""), k = s.keys || {};
    if (!/^https:\/\//.test(ep) || ep.length > 1000 || !k.p256dh || !k.auth || String(k.p256dh).length > 200 || String(k.auth).length > 100) return L.json(res, 400, { error: "알림 정보가 올바르지 않아요." });
    const [cnt] = await db.query("SELECT COUNT(*) AS n FROM push_subs WHERE user_id = ?", [me.id]);
    if (Number(cnt[0].n) >= 10) return L.json(res, 400, { error: "알림을 켠 기기가 너무 많아요. 안 쓰는 기기에서 끄고 다시 시도해 주세요." });
    // 같은 기기가 다른 사람 계정으로 다시 켜질 수 있으므로 주인을 덮어쓴다
    await db.query("INSERT INTO push_subs (user_id, endpoint, endpoint_hash, p256dh, auth) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)",
      [me.id, ep, P.hashOf(ep), String(k.p256dh), String(k.auth)]);
    return L.json(res, 200, { ok: true });
  } catch (e) {
    console.error("push", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
