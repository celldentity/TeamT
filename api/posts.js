// 아티클(글) API — 로그인한 사람만.
//   GET    /api/posts[?limit=N]  → 목록(최신순, 기본 100)
//   GET    /api/posts?id=N       → 글 한 편 + 댓글 전체(답글은 parentId 로 이어짐)
//   GET    /api/posts?feed=1[&before=ID][&limit=N] → {more,total,posts} 피드(최신순, 사진·동영상 전체 포함, total=피드 글 전체 수). 기본 목록에는 피드가 섞이지 않는다
//   POST   /api/posts {kind:"feed",body,media?:[id…]}            → 새 피드 글(제목·분류 없음, 사진·동영상 합쳐 10개·동영상 2개·한 개 100MB, 새 글 알림은 없음)
//   POST   /api/posts {category,title,body,ai?,media?:[id…]}      → 새 글(사진·동영상은 /api/media 로 먼저 올린 id, 순서대로 붙고 첫째가 대표)
//   PATCH  /api/posts?id=N {category,title,body,ai?,media?:[id…]} → 글 수정(쓴 사람만, media 를 주면 그 목록으로 바꾼다)
//   DELETE /api/posts?id=N                           → 글 삭제(쓴 사람만, 댓글·좋아요도 함께)
const L = require("./_lib");
const M = require("./_media");
const { WEEKLY_GOAL } = require("./_points");

// 피드 글: 제목·분류는 화면에 안 나온다. 알림·AI 도우미가 쓰는 title 칸에는 본문 첫 줄을 넣어 둔다(본문이 없으면 «사진»).
const FEED = "피드", FEED_BODY_MAX = 2000;
const feedFields = (b) => {
  const body = String(b.body || "").replace(/\r\n/g, "\n").trim();
  const media = Array.isArray(b.media) ? b.media.map(Number) : null;
  if (L.len(body) > FEED_BODY_MAX) return { error: `내용은 ${FEED_BODY_MAX}자까지 적을 수 있어요.` };
  if (!body && !(media && media.length)) return { error: "내용을 적거나 사진·동영상을 올려 주세요." };
  if (media && (media.length > M.F_MAX_FILES || media.some((x) => !Number.isInteger(x) || x < 1) || new Set(media).size !== media.length)) return { error: `사진·동영상은 ${M.F_MAX_FILES}개까지 붙일 수 있어요.` };
  const first = body.split("\n").find((x) => x.trim()) || "";
  return { feed: true, category: FEED, title: [...first.trim()].slice(0, 40).join("") || "사진", body, ai: 0, media };
};
const who = (id, nickname, photo_v) => (id ? { id, nickname, photoUrl: L.photoUrl({ id, photo_v }) } : null); // null = T조 AI
const fields = (b) => {
  const category = String(b.category || ""), title = String(b.title || "").trim(), body = String(b.body || "").replace(/\r\n/g, "\n").trim();
  if (!L.CATS.includes(category)) return { error: "분류를 골라 주세요." };
  if (L.len(title) < 2 || L.len(title) > 80) return { error: "제목은 2~80자로 적어 주세요." };
  if (L.len(body) < 10 || L.len(body) > 5000) return { error: "내용은 10~5000자로 적어 주세요." };
  const media = Array.isArray(b.media) ? b.media.map(Number) : null;   // null = 건드리지 않는다(PATCH)
  if (media && (media.length > M.MAX_FILES || media.some((x) => !Number.isInteger(x) || x < 1) || new Set(media).size !== media.length)) return { error: `사진·동영상은 ${M.MAX_FILES}개까지 붙일 수 있어요.` };
  return { category, title, body, ai: b.ai ? 1 : 0, media };
};
// 붙이려는 파일이 모두 내 것이고 다 올라왔는지(status 1), 아직 다른 글에 안 붙었는지 확인한다. 문제가 있으면 안내 문구를 돌려준다.
async function checkMedia(db, ids, userId, postId, feed) {
  if (!ids.length) return null;
  const [rows] = await db.query("SELECT id, kind, size, post_id, comment_id, status FROM post_media WHERE id IN (?) AND owner_id = ?", [ids, userId]);
  if (rows.length !== ids.length || rows.some((m) => m.status !== 1 || m.comment_id || (m.post_id && m.post_id !== postId))) return "올리던 사진·동영상을 찾을 수 없어요. 다시 올려 주세요.";
  const vids = rows.filter((m) => m.kind === "video"), maxV = feed ? M.F_MAX_VIDEOS : M.MAX_VIDEOS;
  if (vids.length > maxV) return `동영상은 ${maxV}개까지 붙일 수 있어요.`;
  if (feed && vids.some((m) => Number(m.size) > M.F_MAX_VIDEO)) return `피드에는 동영상을 ${Math.round(M.F_MAX_VIDEO / 1048576)}MB 까지 올릴 수 있어요.`;
  return null;
}
// 글의 파일 목록을 ids 로 맞춘다: 순서대로 붙이고, 빠진 것은 표와 R2 에서 지운다
async function setMedia(db, postId, ids) {
  const [old] = await db.query("SELECT id FROM post_media WHERE post_id = ?", [postId]);
  const gone = old.map((m) => m.id).filter((x) => !ids.includes(x));
  for (let i = 0; i < ids.length; i++) await db.query("UPDATE post_media SET post_id = ?, pos = ? WHERE id = ?", [postId, i, ids[i]]);
  if (gone.length) { await db.query("DELETE FROM post_media WHERE id IN (?)", [gone]); await M.removeFiles(gone); }
}
const SELECT = `SELECT p.id, p.author_id, p.ai, p.category, p.title, p.created_at, p.updated_at, u.nickname, u.photo_v,
  p.kind, p.target_id, p.qdate, p.goal, p.stage, p.ref_post_id, t.nickname AS t_nick, t.photo_v AS t_pv,
  (SELECT COUNT(DISTINCT c.author_id) FROM comments c WHERE c.post_id = p.id AND c.deleted = 0 AND c.author_id IS NOT NULL) AS human_comments,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted = 0 AND p.target_id IS NOT NULL AND c.author_id = p.target_id) AS target_comments,
  (SELECT COUNT(*) FROM likes l WHERE l.target_type = 'p' AND l.target_id = p.id) AS likes,
  (SELECT COUNT(*) FROM likes l WHERE l.target_type = 'p' AND l.target_id = p.id AND l.user_id = ?) AS liked,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted = 0) AS comments,
  (SELECT m.id FROM post_media m WHERE m.post_id = p.id AND m.status = 1 ORDER BY m.pos, m.id LIMIT 1) AS cover_id,
  (SELECT m.kind FROM post_media m WHERE m.post_id = p.id AND m.status = 1 ORDER BY m.pos, m.id LIMIT 1) AS cover_kind,
  (SELECT m.has_thumb FROM post_media m WHERE m.post_id = p.id AND m.status = 1 ORDER BY m.pos, m.id LIMIT 1) AS cover_thumb,
  (SELECT COUNT(*) FROM post_media m WHERE m.post_id = p.id AND m.status = 1) AS media_n`;
const shape = (r, me) => ({
  id: r.id, category: r.category, title: r.title, ai: !!r.ai, author: who(r.author_id, r.nickname, r.photo_v),
  createdAt: r.created_at, updatedAt: r.updated_at, likes: Number(r.likes), liked: Number(r.liked) > 0, comments: Number(r.comments),
  mine: !!r.author_id && r.author_id === me.id,
  special: r.kind && r.kind !== "post" ? r.kind : null,                                                           // daily | weekly | digest
  target: r.target_id ? who(r.target_id, r.t_nick, r.t_pv) : null,                                                // 오늘 지목된 사람
  answered: r.kind === "daily" ? Number(r.target_comments) > 0 : undefined,                                       // 지목된 사람이 답했는지
  forMe: !!r.target_id && r.target_id === me.id,
  qdate: r.qdate ? new Date(r.qdate).toISOString().slice(0, 10) : null,
  progress: r.kind === "weekly" ? { done: Number(r.human_comments), goal: WEEKLY_GOAL, pct: Math.min(100, Math.round((Number(r.human_comments) / WEEKLY_GOAL) * 100)), stage: r.stage } : null,
  ref: r.ref_post_id || null,                                                                                     // weekly ↔ digest
  cover: r.cover_id ? { id: r.cover_id, kind: r.cover_kind, thumb: !!r.cover_thumb, n: Number(r.media_n) } : null,   // 목록 카드의 썸네일
});

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    const id = Number(req.query.id), db = L.db();

    if (req.method === "GET") {
      // 하단 «아티클» 새 글 숫자: ?count=1&after=<이전에 받은 now> → 그 뒤에 남이 올린 글·피드 수와 지금 DB 시각(now). after 가 없으면 0(처음 쓰는 기기는 지금까지의 것을 «본 것» 으로 시작).
      if (req.query.count) {
        const [[t]] = await db.query("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS now"), after = String(req.query.after || "");
        if (!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(after)) return L.json(res, 200, { count: 0, now: t.now });
        const [[c]] = await db.query("SELECT COUNT(*) AS n FROM posts WHERE created_at > ? AND (author_id IS NULL OR author_id <> ?)", [after, me.id]);
        return L.json(res, 200, { count: Number(c.n), now: t.now });
      }
      if (!req.query.id && req.query.feed) {
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20)), before = Number(req.query.before) || 0;
        const [rows] = await db.query(`${SELECT}, p.body FROM posts p LEFT JOIN users u ON u.id = p.author_id LEFT JOIN users t ON t.id = p.target_id WHERE p.kind = 'feed'${before ? " AND p.id < ?" : ""} ORDER BY p.id DESC LIMIT ?`, before ? [me.id, before, limit + 1] : [me.id, limit + 1]);
        const more = rows.length > limit, page = rows.slice(0, limit);
        const [ms] = page.length ? await db.query("SELECT post_id, id, kind, w, h, has_thumb FROM post_media WHERE post_id IN (?) AND status = 1 ORDER BY post_id, pos, id", [page.map((r) => r.id)]) : [[]];
        const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM posts WHERE kind = 'feed'");   // 제목 옆 «피드 N»
        return L.json(res, 200, { more, total: Number(total), posts: page.map((r) => ({ ...shape(r, me), body: r.body, media: ms.filter((m) => m.post_id === r.id).map(M.shape) })) });
      }
      if (!req.query.id) {
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 100));
        const [rows] = await db.query(`${SELECT}, LEFT(p.body, 160) AS excerpt FROM posts p LEFT JOIN users u ON u.id = p.author_id LEFT JOIN users t ON t.id = p.target_id WHERE p.kind <> 'feed' ORDER BY p.created_at DESC, p.id DESC LIMIT ?`, [me.id, limit]);
        return L.json(res, 200, { categories: L.CATS, posts: rows.map((r) => ({ ...shape(r, me), excerpt: r.excerpt })) });
      }
      if (!Number.isInteger(id) || id < 1) return L.json(res, 400, { error: "잘못된 요청입니다." });
      const [rows] = await db.query(`${SELECT}, p.body FROM posts p LEFT JOIN users u ON u.id = p.author_id LEFT JOIN users t ON t.id = p.target_id WHERE p.id = ?`, [me.id, id]);
      if (!rows[0]) return L.json(res, 404, { error: "글을 찾을 수 없어요. 지워졌을 수 있어요." });
      const [cs] = await db.query(`SELECT c.id, c.parent_id, c.author_id, c.body, c.deleted, c.created_at, c.updated_at, u.nickname, u.photo_v,
          (SELECT COUNT(*) FROM likes l WHERE l.target_type = 'c' AND l.target_id = c.id) AS likes,
          (SELECT COUNT(*) FROM likes l WHERE l.target_type = 'c' AND l.target_id = c.id AND l.user_id = ?) AS liked
        FROM comments c LEFT JOIN users u ON u.id = c.author_id WHERE c.post_id = ? ORDER BY c.created_at, c.id`, [me.id, id]);
      const [ms] = await db.query("SELECT id, kind, w, h, has_thumb FROM post_media WHERE post_id = ? AND status = 1 ORDER BY pos, id", [id]);
      const [cms] = cs.length ? await db.query("SELECT id, comment_id, kind, w, h, has_thumb FROM post_media WHERE comment_id IN (?) AND status = 1 ORDER BY pos, id", [cs.map((c) => c.id)]) : [[]];
      const cmedia = (cid) => cms.filter((m) => m.comment_id === cid).map(M.shape);
      return L.json(res, 200, {
        categories: L.CATS,
        post: { ...shape(rows[0], me), body: rows[0].body, media: ms.map(M.shape) },
        comments: cs.map((c) => c.deleted
          ? { id: c.id, parentId: c.parent_id, deleted: true, createdAt: c.created_at }
          : { id: c.id, parentId: c.parent_id, deleted: false, author: who(c.author_id, c.nickname, c.photo_v), body: c.body, media: cmedia(c.id), createdAt: c.created_at, updatedAt: c.updated_at, likes: Number(c.likes), liked: Number(c.liked) > 0, mine: !!c.author_id && c.author_id === me.id, byTarget: !!c.author_id && c.author_id === rows[0].target_id }),
      });
    }

    if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });

    if (req.method === "POST") {
      const raw = L.readBody(req), f = raw.kind === "feed" ? feedFields(raw) : fields(raw);
      if (f.error) return L.json(res, 400, { error: f.error });
      // 같은 요청이 두 번 와도(브라우저가 저장을 다시 시도) 글은 하나만: 클라이언트 키(cid)로 이미 만든 글이 있으면 그 번호를 돌려준다
      const cid = typeof raw.cid === "string" && /^[a-z0-9]{6,24}$/.test(raw.cid) ? raw.cid : null;
      if (cid) { const [dup] = await db.query("SELECT id FROM posts WHERE author_id = ? AND client_id = ?", [me.id, cid]); if (dup[0]) return L.json(res, 200, { id: dup[0].id }); }
      const bad = await checkMedia(db, f.media || [], me.id, 0, f.feed);
      if (bad) return L.json(res, 400, { error: bad });
      let r;
      try { [r] = await db.query("INSERT INTO posts (author_id, ai, category, title, body, kind, client_id) VALUES (?, ?, ?, ?, ?, ?, ?)", [me.id, f.ai, f.category, f.title, f.body, f.feed ? "feed" : "post", cid]); }
      catch (e) { if (cid && e.code === "ER_DUP_ENTRY") { const [dup] = await db.query("SELECT id FROM posts WHERE author_id = ? AND client_id = ?", [me.id, cid]); if (dup[0]) return L.json(res, 200, { id: dup[0].id }); } throw e; }
      if (f.media && f.media.length) await setMedia(db, r.insertId, f.media);
      // 새 글 폰 알림: 알림을 켠 다른 팀원 모두에게. 실패해도 글쓰기는 성공으로 돌려준다. 피드 글은 아무에게도 알리지 않는다(내 피드에 댓글·좋아요가 달릴 때만 내게 알림 — comments.js·likes.js).
      if (!f.feed) await require("./_push").notify(null, () => ({ title: "새 글이 올라왔어요", body: `${me.nickname}: ${f.title}`, url: `/article?id=${r.insertId}`, tag: `post-${r.insertId}`, badge: "auto" }), [me.id]).catch((e) => console.error("push post", e));
      return L.json(res, 201, { id: r.insertId });
    }

    if (req.method === "PATCH" || req.method === "DELETE") {
      if (!Number.isInteger(id) || id < 1) return L.json(res, 400, { error: "잘못된 요청입니다." });
      const [rows] = await db.query("SELECT author_id, kind FROM posts WHERE id = ?", [id]);
      if (!rows[0]) return L.json(res, 404, { error: "글을 찾을 수 없어요. 지워졌을 수 있어요." });
      if (rows[0].author_id !== me.id) return L.json(res, 403, { error: "내가 쓴 글만 고치거나 지울 수 있어요." });

      if (req.method === "PATCH") {
        const isFeed = rows[0].kind === "feed", f = isFeed ? feedFields(L.readBody(req)) : fields(L.readBody(req));
        if (f.error) return L.json(res, 400, { error: f.error });
        if (f.media) { const bad = await checkMedia(db, f.media, me.id, id, isFeed); if (bad) return L.json(res, 400, { error: bad }); }
        await db.query("UPDATE posts SET category = ?, title = ?, body = ?, ai = ?, updated_at = NOW() WHERE id = ?", [f.category, f.title, f.body, f.ai, id]);
        if (f.media) await setMedia(db, id, f.media);
        return L.json(res, 200, { id });
      }

      const [mine] = await db.query("SELECT id FROM post_media WHERE post_id = ? OR comment_id IN (SELECT id FROM comments WHERE post_id = ?)", [id, id]);
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query("DELETE FROM likes WHERE target_type = 'c' AND target_id IN (SELECT id FROM comments WHERE post_id = ?)", [id]);
        await conn.query("DELETE FROM post_media WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ?)", [id]);   // 댓글에 붙은 파일(댓글을 지우기 전에)
        await conn.query("DELETE FROM comments WHERE post_id = ?", [id]);
        await conn.query("DELETE FROM likes WHERE target_type = 'p' AND target_id = ?", [id]);
        await conn.query("DELETE FROM post_media WHERE post_id = ?", [id]);
        await conn.query("DELETE FROM posts WHERE id = ?", [id]);
        await conn.commit();
      } catch (e) { await conn.rollback().catch(() => {}); throw e; } finally { conn.release(); }
      await M.removeFiles(mine.map((m) => m.id));
      return L.json(res, 200, { ok: true });
    }
    return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
  } catch (e) {
    console.error("posts", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
