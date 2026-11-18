// GET /api/me → 내 정보(로그인 안 했으면 user:null) · PATCH /api/me {nickname?, bio?} → 닉네임·한 줄 소개 변경
const L = require("./_lib");

module.exports = async (req, res) => {
  try {
    const u = await L.currentUser(req);
    if (req.method === "GET") return L.json(res, 200, { user: u ? L.publicUser(u) : null });
    if (req.method === "PATCH") {
      if (!u) return L.json(res, 401, { error: "로그인이 필요합니다." });
      if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });
      const b = L.readBody(req), next = { ...u };
      if (b.nickname !== undefined) {
        next.nickname = String(b.nickname).trim();
        if (L.len(next.nickname) < 2 || L.len(next.nickname) > 20) return L.json(res, 400, { error: "닉네임은 2~20자로 정해 주세요." });
      }
      if (b.bio !== undefined) {
        next.bio = String(b.bio).trim();
        if (L.len(next.bio) > 60) return L.json(res, 400, { error: "한 줄 소개는 60자까지 쓸 수 있어요." });
      }
      await L.db().query("UPDATE users SET nickname = ?, bio = ? WHERE id = ?", [next.nickname, next.bio, u.id]);
      return L.json(res, 200, { user: L.publicUser(next) });
    }
    return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
  } catch (e) {
    console.error("me", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
