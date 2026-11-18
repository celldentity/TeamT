// POST /api/likes {type: "p"|"c", id} → 좋아요 켜고 끄기(누가 언제 눌렀는지 likes 표에 남는다). 응답 {liked, count}
const L = require("./_lib");

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    if (req.method !== "POST") return L.json(res, 405, { error: "POST 로 요청해 주세요." });
    if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });
    const b = L.readBody(req), type = b.type === "c" ? "c" : b.type === "p" ? "p" : null, id = Number(b.id), db = L.db();
    if (!type || !Number.isInteger(id) || id < 1) return L.json(res, 400, { error: "잘못된 요청입니다." });

    const [t] = await db.query(type === "p" ? "SELECT id FROM posts WHERE id = ?" : "SELECT id FROM comments WHERE id = ? AND deleted = 0", [id]);
    if (!t[0]) return L.json(res, 404, { error: "대상을 찾을 수 없어요. 지워졌을 수 있어요." });

    const [del] = await db.query("DELETE FROM likes WHERE target_type = ? AND target_id = ? AND user_id = ?", [type, id, me.id]);
    let liked = false;
    if (del.affectedRows === 0) { await db.query("INSERT IGNORE INTO likes (target_type, target_id, user_id) VALUES (?, ?, ?)", [type, id, me.id]); liked = true; }
    const [n] = await db.query("SELECT COUNT(*) AS n FROM likes WHERE target_type = ? AND target_id = ?", [type, id]);
    return L.json(res, 200, { liked, count: Number(n[0].n) });
  } catch (e) {
    console.error("likes", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
