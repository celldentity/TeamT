// GET /api/members → T조 소개 페이지에 보일 팀원 목록(로그인한 사람만). 이메일은 내려주지 않는다.
const L = require("./_lib");

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    if (req.method !== "GET") return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
    const [rows] = await L.db().query("SELECT id, nickname, bio, photo_v, cover_v, created_at FROM users ORDER BY id");
    return L.json(res, 200, { members: rows.map((r) => ({ id: r.id, nickname: r.nickname, bio: r.bio, photoUrl: L.photoUrl(r), coverUrl: L.coverUrl(r), joinedAt: r.created_at, me: r.id === me.id })) });
  } catch (e) {
    console.error("members", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
