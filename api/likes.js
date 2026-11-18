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
    // 폰 알림: 좋아요를 «켰을» 때만, 내 글·내 댓글을 쓴 사람에게(T조 AI 글은 받는 사람이 없다). 같은 대상은 tag 가 같아 기기에서 하나로 합쳐진다.
    if (liked) {
      try {
        const [[o]] = type === "p"
          ? await db.query("SELECT author_id AS owner, id AS post_id, title AS what FROM posts WHERE id = ?", [id])
          : await db.query("SELECT c.author_id AS owner, c.post_id, LEFT(c.body, 60) AS what FROM comments c WHERE c.id = ?", [id]);
        if (o && o.owner && o.owner !== me.id) {
          await require("./_push").notify([o.owner], () => ({
            title: `${me.nickname}님이 ${type === "p" ? "내 글을" : "내 댓글을"} 좋아해요`,
            body: type === "p" ? `«${o.what}»` : String(o.what).replace(/\s+/g, " "), url: `/article?id=${o.post_id}${type === "c" ? "#c" + id : ""}`, tag: `like-${type}-${id}`, badge: "auto",
          }));
        }
      } catch (e) { console.error("push like", e); }
    }
    return L.json(res, 200, { liked, count: Number(n[0].n) });
  } catch (e) {
    console.error("likes", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
