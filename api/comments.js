// 댓글 API — 로그인한 사람만. 답글(대댓글)은 한 단계까지.
//   POST   /api/comments {postId, parentId?, body} → 댓글/답글 쓰기
//   PATCH  /api/comments?id=N {body}               → 내 댓글 수정
//   DELETE /api/comments?id=N                      → 내 댓글 삭제(답글이 달려 있으면 «삭제된 댓글»로 자리만 남긴다)
const L = require("./_lib");
const M = require("./_media");
const P = require("./_points");

// 사진·영상만 있는 댓글도 허용한다(hasMedia). 글자는 1000자까지.
const bodyOf = (b, hasMedia) => { const t = String(b.body || "").replace(/\r\n/g, "\n").trim(); return (L.len(t) < 1 && !hasMedia) || L.len(t) > 1000 ? null : t; };
const mediaIds = (b) => (Array.isArray(b.media) ? b.media.map(Number) : null);   // null = 건드리지 않는다(PATCH)

// 붙이려는 파일이 모두 내 것이고 다 올라왔는지(status 1), 다른 글·댓글에 안 붙었는지, 댓글 한도(4개·동영상 1개·동영상 100MB)를 지키는지 확인한다. 문제가 있으면 안내 문구를 돌려준다.
async function checkMedia(db, ids, userId, commentId) {
  if (!ids.length) return null;
  if (ids.length > M.C_MAX_FILES || ids.some((x) => !Number.isInteger(x) || x < 1) || new Set(ids).size !== ids.length) return `사진·동영상은 ${M.C_MAX_FILES}개까지 붙일 수 있어요.`;
  const [rows] = await db.query("SELECT id, kind, size, post_id, comment_id, status FROM post_media WHERE id IN (?) AND owner_id = ?", [ids, userId]);
  if (rows.length !== ids.length || rows.some((m) => m.status !== 1 || m.post_id || (m.comment_id && m.comment_id !== commentId))) return "올리던 사진·동영상을 찾을 수 없어요. 다시 올려 주세요.";
  const vids = rows.filter((m) => m.kind === "video");
  if (vids.length > M.C_MAX_VIDEOS) return `댓글에는 동영상을 ${M.C_MAX_VIDEOS}개까지 붙일 수 있어요.`;
  if (vids.some((m) => Number(m.size) > M.C_MAX_VIDEO)) return "댓글에는 동영상을 100MB 까지 올릴 수 있어요.";
  return null;
}
// 댓글의 파일 목록을 ids 로 맞춘다: 순서대로 붙이고, 빠진 것은 표와 R2 에서 지운다
async function setMedia(db, commentId, ids) {
  const [old] = await db.query("SELECT id FROM post_media WHERE comment_id = ?", [commentId]);
  const gone = old.map((m) => m.id).filter((x) => !ids.includes(x));
  for (let i = 0; i < ids.length; i++) await db.query("UPDATE post_media SET comment_id = ?, pos = ? WHERE id = ?", [commentId, i, ids[i]]);
  if (gone.length) { await db.query("DELETE FROM post_media WHERE id IN (?)", [gone]); await M.removeFiles(gone); }
}
const dropMedia = async (db, commentId) => { const [m] = await db.query("SELECT id FROM post_media WHERE comment_id = ?", [commentId]); if (m.length) { await db.query("DELETE FROM post_media WHERE comment_id = ?", [commentId]); await M.removeFiles(m.map((x) => x.id)); } };

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    if (!["POST", "PATCH", "DELETE"].includes(req.method)) return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
    if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });
    const db = L.db(), b = req.method === "DELETE" ? {} : L.readBody(req);

    if (req.method === "POST") {
      // 같은 요청이 두 번 와도(브라우저가 저장을 다시 시도) 댓글은 하나만: 클라이언트 키(cid)로 이미 만든 것이 있으면 그 번호를 돌려준다
      const cid = typeof b.cid === "string" && /^[a-z0-9]{6,24}$/.test(b.cid) ? b.cid : null;
      if (cid) { const [dup] = await db.query("SELECT id FROM comments WHERE author_id = ? AND client_id = ?", [me.id, cid]); if (dup[0]) return L.json(res, 200, { id: dup[0].id }); }
      const mids = mediaIds(b) || [], postId = Number(b.postId), text = bodyOf(b, mids.length > 0);
      if (text === null) return L.json(res, 400, { error: "댓글은 1~1000자로 적어 주세요(사진·동영상만 올려도 돼요)." });
      const bad = await checkMedia(db, mids, me.id, 0);
      if (bad) return L.json(res, 400, { error: bad });
      const [p] = await db.query("SELECT id FROM posts WHERE id = ?", [postId]);
      if (!p[0]) return L.json(res, 404, { error: "글을 찾을 수 없어요. 지워졌을 수 있어요." });
      let parentId = null;
      if (b.parentId) {
        const [par] = await db.query("SELECT id, parent_id, deleted FROM comments WHERE id = ? AND post_id = ?", [Number(b.parentId), postId]);
        if (!par[0] || par[0].deleted) return L.json(res, 404, { error: "답글을 달 댓글을 찾을 수 없어요." });
        parentId = par[0].parent_id || par[0].id; // 답글에 답해도 같은 댓글 아래에 모은다(한 단계)
      }
      let r;
      try { [r] = await db.query("INSERT INTO comments (post_id, parent_id, author_id, body, client_id) VALUES (?, ?, ?, ?, ?)", [postId, parentId, me.id, text, cid]); }
      catch (e) { if (cid && e.code === "ER_DUP_ENTRY") { const [dup] = await db.query("SELECT id FROM comments WHERE author_id = ? AND client_id = ?", [me.id, cid]); if (dup[0]) return L.json(res, 200, { id: dup[0].id }); } throw e; }
      if (mids.length) await setMedia(db, r.insertId, mids);
      // 폰 알림: 내 글에 댓글이 달리면 글쓴이에게, 내 댓글에 답글이 달리면 그 댓글을 쓴 사람에게. 한 사람에게 한 번만, 나 자신은 뺀다(알림 페이지의 규칙과 같다).
      try {
        const [[info]] = await db.query("SELECT p.author_id AS post_author, p.title, pc.author_id AS parent_author FROM posts p LEFT JOIN comments pc ON pc.id = ? WHERE p.id = ?", [parentId, postId]);
        const to = new Map();
        if (info.parent_author && info.parent_author !== me.id) to.set(info.parent_author, "reply");
        if (info.post_author && info.post_author !== me.id && !to.has(info.post_author)) to.set(info.post_author, "comment");
        const snip = text.replace(/\s+/g, " ").slice(0, 90) || "사진·동영상을 남겼어요";
        await require("./_push").notify([...to.keys()], (uid) => ({
          title: to.get(uid) === "reply" ? `${me.nickname}님이 답글을 남겼어요` : `${me.nickname}님이 내 글에 댓글을 남겼어요`,
          body: snip, url: `/article?id=${postId}#c${r.insertId}`, tag: `c-${r.insertId}`, badge: "auto",
        }));
      } catch (e) { console.error("push comment", e); }
      let points = 0;   // 오늘의 질문에서 지목된 사람이 제대로 답했으면 포인트(실패해도 댓글은 성공)
      try { points = await P.onComment(db, { postId, commentId: r.insertId, userId: me.id, text }); } catch (e) { console.error("points", e); }
      return L.json(res, 201, { id: r.insertId, points });
    }

    const id = Number(req.query.id);
    if (!Number.isInteger(id) || id < 1) return L.json(res, 400, { error: "잘못된 요청입니다." });
    const [rows] = await db.query("SELECT id, parent_id, author_id, deleted FROM comments WHERE id = ?", [id]);
    const c = rows[0];
    if (!c || c.deleted) return L.json(res, 404, { error: "댓글을 찾을 수 없어요. 지워졌을 수 있어요." });
    if (c.author_id !== me.id) return L.json(res, 403, { error: "내가 쓴 댓글만 고치거나 지울 수 있어요." });

    if (req.method === "PATCH") {
      const mids = mediaIds(b);   // null = 파일은 그대로, 배열 = 그 목록으로 맞춘다
      const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM post_media WHERE comment_id = ?", [id]);
      const text = bodyOf(b, mids ? mids.length > 0 : Number(n) > 0);
      if (text === null) return L.json(res, 400, { error: "댓글은 1~1000자로 적어 주세요(사진·동영상만 올려도 돼요)." });
      if (mids) { const bad = await checkMedia(db, mids, me.id, id); if (bad) return L.json(res, 400, { error: bad }); }
      await db.query("UPDATE comments SET body = ?, updated_at = NOW() WHERE id = ?", [text, id]);
      if (mids) await setMedia(db, id, mids);
      let points = 0;
      try { const [[cm]] = await db.query("SELECT post_id FROM comments WHERE id = ?", [id]); points = await P.onComment(db, { postId: cm.post_id, commentId: id, userId: me.id, text }); } catch (e) { console.error("points", e); }
      return L.json(res, 200, { id, points });
    }

    // 삭제: 답글이 있으면 자리만 남기고, 없으면 지운다. 마지막 답글을 지웠는데 부모가 «삭제된 댓글»이면 부모도 함께 지운다.
    try { await P.onGone(db, id); } catch (e) { console.error("points", e); }   // 이 댓글로 받은 오늘의 질문 포인트는 회수
    await dropMedia(db, id);   // 붙은 사진·동영상은 댓글이 «삭제된 댓글» 자리만 남더라도 지운다
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
