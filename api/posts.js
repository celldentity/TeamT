// 아티클(글) API — 로그인한 사람만.
//   GET    /api/posts[?limit=N]  → 목록(최신순, 기본 100)
//   GET    /api/posts?id=N       → 글 한 편 + 댓글 전체(답글은 parentId 로 이어짐)
//   POST   /api/posts {category,title,body,ai?}      → 새 글
//   PATCH  /api/posts?id=N {category,title,body,ai?} → 글 수정(쓴 사람만)
//   DELETE /api/posts?id=N                           → 글 삭제(쓴 사람만, 댓글·좋아요도 함께)
const L = require("./_lib");

const who = (id, nickname, photo_v) => (id ? { id, nickname, photoUrl: L.photoUrl({ id, photo_v }) } : null); // null = T조 AI
const fields = (b) => {
  const category = String(b.category || ""), title = String(b.title || "").trim(), body = String(b.body || "").replace(/\r\n/g, "\n").trim();
  if (!L.CATS.includes(category)) return { error: "분류를 골라 주세요." };
  if (L.len(title) < 2 || L.len(title) > 80) return { error: "제목은 2~80자로 적어 주세요." };
  if (L.len(body) < 10 || L.len(body) > 5000) return { error: "내용은 10~5000자로 적어 주세요." };
  return { category, title, body, ai: b.ai ? 1 : 0 };
};
const SELECT = `SELECT p.id, p.author_id, p.ai, p.category, p.title, p.created_at, p.updated_at, u.nickname, u.photo_v,
  (SELECT COUNT(*) FROM likes l WHERE l.target_type = 'p' AND l.target_id = p.id) AS likes,
  (SELECT COUNT(*) FROM likes l WHERE l.target_type = 'p' AND l.target_id = p.id AND l.user_id = ?) AS liked,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted = 0) AS comments`;
const shape = (r, me) => ({
  id: r.id, category: r.category, title: r.title, ai: !!r.ai, author: who(r.author_id, r.nickname, r.photo_v),
  createdAt: r.created_at, updatedAt: r.updated_at, likes: Number(r.likes), liked: Number(r.liked) > 0, comments: Number(r.comments),
  mine: !!r.author_id && r.author_id === me.id,
});

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    const id = Number(req.query.id), db = L.db();

    if (req.method === "GET") {
      if (!req.query.id) {
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 100));
        const [rows] = await db.query(`${SELECT}, LEFT(p.body, 160) AS excerpt FROM posts p LEFT JOIN users u ON u.id = p.author_id ORDER BY p.created_at DESC, p.id DESC LIMIT ?`, [me.id, limit]);
        return L.json(res, 200, { categories: L.CATS, posts: rows.map((r) => ({ ...shape(r, me), excerpt: r.excerpt })) });
      }
      if (!Number.isInteger(id) || id < 1) return L.json(res, 400, { error: "잘못된 요청입니다." });
      const [rows] = await db.query(`${SELECT}, p.body FROM posts p LEFT JOIN users u ON u.id = p.author_id WHERE p.id = ?`, [me.id, id]);
      if (!rows[0]) return L.json(res, 404, { error: "글을 찾을 수 없어요. 지워졌을 수 있어요." });
      const [cs] = await db.query(`SELECT c.id, c.parent_id, c.author_id, c.body, c.deleted, c.created_at, c.updated_at, u.nickname, u.photo_v,
          (SELECT COUNT(*) FROM likes l WHERE l.target_type = 'c' AND l.target_id = c.id) AS likes,
          (SELECT COUNT(*) FROM likes l WHERE l.target_type = 'c' AND l.target_id = c.id AND l.user_id = ?) AS liked
        FROM comments c JOIN users u ON u.id = c.author_id WHERE c.post_id = ? ORDER BY c.created_at, c.id`, [me.id, id]);
      return L.json(res, 200, {
        categories: L.CATS,
        post: { ...shape(rows[0], me), body: rows[0].body },
        comments: cs.map((c) => c.deleted
          ? { id: c.id, parentId: c.parent_id, deleted: true, createdAt: c.created_at }
          : { id: c.id, parentId: c.parent_id, deleted: false, author: who(c.author_id, c.nickname, c.photo_v), body: c.body, createdAt: c.created_at, updatedAt: c.updated_at, likes: Number(c.likes), liked: Number(c.liked) > 0, mine: c.author_id === me.id }),
      });
    }

    if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });

    if (req.method === "POST") {
      const f = fields(L.readBody(req));
      if (f.error) return L.json(res, 400, { error: f.error });
      const [r] = await db.query("INSERT INTO posts (author_id, ai, category, title, body) VALUES (?, ?, ?, ?, ?)", [me.id, f.ai, f.category, f.title, f.body]);
      return L.json(res, 201, { id: r.insertId });
    }

    if (req.method === "PATCH" || req.method === "DELETE") {
      if (!Number.isInteger(id) || id < 1) return L.json(res, 400, { error: "잘못된 요청입니다." });
      const [rows] = await db.query("SELECT author_id FROM posts WHERE id = ?", [id]);
      if (!rows[0]) return L.json(res, 404, { error: "글을 찾을 수 없어요. 지워졌을 수 있어요." });
      if (rows[0].author_id !== me.id) return L.json(res, 403, { error: "내가 쓴 글만 고치거나 지울 수 있어요." });

      if (req.method === "PATCH") {
        const f = fields(L.readBody(req));
        if (f.error) return L.json(res, 400, { error: f.error });
        await db.query("UPDATE posts SET category = ?, title = ?, body = ?, ai = ?, updated_at = NOW() WHERE id = ?", [f.category, f.title, f.body, f.ai, id]);
        return L.json(res, 200, { id });
      }

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query("DELETE FROM likes WHERE target_type = 'c' AND target_id IN (SELECT id FROM comments WHERE post_id = ?)", [id]);
        await conn.query("DELETE FROM comments WHERE post_id = ?", [id]);
        await conn.query("DELETE FROM likes WHERE target_type = 'p' AND target_id = ?", [id]);
        await conn.query("DELETE FROM posts WHERE id = ?", [id]);
        await conn.commit();
      } catch (e) { await conn.rollback().catch(() => {}); throw e; } finally { conn.release(); }
      return L.json(res, 200, { ok: true });
    }
    return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
  } catch (e) {
    console.error("posts", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
