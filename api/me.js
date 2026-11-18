// GET /api/me → 내 정보(로그인 안 했으면 user:null) · PATCH /api/me {nickname} → 닉네임 변경
const L = require("./_lib");

module.exports = async (req, res) => {
  try {
    const u = await L.currentUser(req);
    if (req.method === "GET") return L.json(res, 200, { user: u ? L.publicUser(u) : null });
    if (req.method === "PATCH") {
      if (!u) return L.json(res, 401, { error: "로그인이 필요합니다." });
      if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });
      const nickname = String(L.readBody(req).nickname || "").trim();
      if ([...nickname].length < 2 || [...nickname].length > 20) return L.json(res, 400, { error: "닉네임은 2~20자로 정해 주세요." });
      await L.db().query("UPDATE users SET nickname = ? WHERE id = ?", [nickname, u.id]);
      return L.json(res, 200, { user: L.publicUser({ ...u, nickname }) });
    }
    return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
  } catch (e) {
    console.error("me", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
