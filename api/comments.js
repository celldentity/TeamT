// 댓글 API — 로그인한 사람만. 답글(대댓글)은 한 단계까지.
//   POST   /api/comments {postId, parentId?, body} → 댓글/답글 쓰기
//   PATCH  /api/comments?id=N {body}               → 내 댓글 수정
//   DELETE /api/comments?id=N                      → 내 댓글 삭제(답글이 달려 있으면 «삭제된 댓글»로 자리만 남긴다)
const L = require("./_lib");

const bodyOf = (b) => { const t = String(b.body || "").replace(/\r\n/g, "\n").trim(); return L.len(t) < 1 || L.len(t) > 1000 ? null : t; };

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    if (!["POST", "PATCH", "DELETE"].includes(req.method)) return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
    if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });
    const db = L.db(), b = req.method === "DELETE" ? {} : L.readBody(req);

    if (req.method === "POST") {
      const text = bodyOf(b), postId = Number(b.postId);
      if (text === null) return L.json(res, 400, { error: "댓글은 1~1000자로 적어 주세요." });
      const [p] = await db.query("SELECT id FROM posts WHERE id = ?", [postId]);
      if (!p[0]) return L.json(res, 404, { error: "글을 찾을 수 없어요. 지워졌을 수 있어요." });
      let parentId = null;
      if (b.parentId) {
        const [par] = await db.query("SELECT id, parent_id, deleted FROM comments WHERE id = ? AND post_id = ?", [Number(b.parentId), postId]);
        if (!par[0] || par[0].deleted) return L.json(res, 404, { error: "답글을 달 댓글을 찾을 수 없어요." });
        parentId = par[0].parent_id || par[0].id; // 답글에 답해도 같은 댓글 아래에 모은다(한 단계)
      }
      const [r] = await db.query("INSERT INTO comments (post_id, parent_id, author_id, body) VALUES (?, ?, ?, ?)", [postId, parentId, me.id, text]);
      // 폰 알림: 내 글에 댓글이 달리면 글쓴이에게, 내 댓글에 답글이 달리면 그 댓글을 쓴 사람에게. 한 사람에게 한 번만, 나 자신은 뺀다(알림 페이지의 규칙과 같다).
      try {
        const [[info]] = await db.query("SELECT p.author_id AS post_author, p.title, pc.author_id AS parent_author FROM posts p LEFT JOIN comments pc ON pc.id = ? WHERE p.id = ?", [parentId, postId]);
        const to = new Map();
        if (info.parent_author && info.parent_author !== me.id) to.set(info.parent_author, "reply");
        if (info.post_author && info.post_author !== me.id && !to.has(info.post_author)) to.set(info.post_author, "comment");
        const snip = text.replace(/\s+/g, " ").slice(0, 90);
        await require("./_push").notify([...to.keys()], (uid) => ({
          title: to.get(uid) === "reply" ? `${me.nickname}님이 답글을 남겼어요` : `${me.nickname}님이 내 글에 댓글을 남겼어요`,
          body: snip, url: `/article?id=${postId}#c${r.insertId}`, tag: `c-${r.insertId}`, badge: "auto",
        }));
      } catch (e) { console.error("push comment", e); }
      return L.json(res, 201, { id: r.insertId });
    }

    const id = Number(req.query.id);
    if (!Number.isInteger(id) || id < 1) return L.json(res, 400, { error: "잘못된 요청입니다." });
    const [rows] = await db.query("SELECT id, parent_id, author_id, deleted FROM comments WHERE id = ?", [id]);
    const c = rows[0];
    if (!c || c.deleted) return L.json(res, 404, { error: "댓글을 찾을 수 없어요. 지워졌을 수 있어요." });
    if (c.author_id !== me.id) return L.json(res, 403, { error: "내가 쓴 댓글만 고치거나 지울 수 있어요." });

    if (req.method === "PATCH") {
      const text = bodyOf(b);
      if (text === null) return L.json(res, 400, { error: "댓글은 1~1000자로 적어 주세요." });
      await db.query("UPDATE comments SET body = ?, updated_at = NOW() WHERE id = ?", [text, id]);
      return L.json(res, 200, { id });
    }

    // 삭제: 답글이 있으면 자리만 남기고, 없으면 지운다. 마지막 답글을 지웠는데 부모가 «삭제된 댓글»이면 부모도 함께 지운다.
    const drop = async (cid) => { await db.query("DELETE FROM likes WHERE target_type = 'c' AND target_id = ?", [cid]); await db.query("DELETE FROM comments WHERE id = ?", [cid]); };
    const [kids] = await db.query("SELECT COUNT(*) AS n FROM comments WHERE parent_id = ?", [id]);
    if (Number(kids[0].n) > 0) {
      await db.query("DELETE FROM likes WHERE target_type = 'c' AND target_id = ?", [id]);
      await db.query("UPDATE comments SET deleted = 1, body = '' WHERE id = ?", [id]);
    } else {
      await drop(id);
      if (c.parent_id) {
        const [par] = await db.query("SELECT deleted FROM comments WHERE id = ?", [c.parent_id]);
        const [left] = await db.query("SELECT COUNT(*) AS n FROM comments WHERE parent_id = ?", [c.parent_id]);
        if (par[0] && par[0].deleted && Number(left[0].n) === 0) await drop(c.parent_id);
      }
    }
    return L.json(res, 200, { ok: true });
  } catch (e) {
    console.error("comments", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
