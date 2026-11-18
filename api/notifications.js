// 알림 — 로그인한 사람만. 별도 알림 표 없이 댓글·좋아요 기록에서 바로 뽑는다(내가 한 것은 제외).
//   GET  /api/notifications          → {unread, items[]}  (최근 50개, isNew = 마지막 확인 이후)
//   GET  /api/notifications?count=1  → {unread}           (상단바 숫자용)
//   POST /api/notifications {read:true} → 지금까지 확인함으로 표시
// 종류: comment = 내 글에 달린 댓글 · reply = 내 댓글에 달린 답글 · like_post = 내 글 좋아요 · like_comment = 내 댓글 좋아요
const L = require("./_lib");

// ? 9개 모두 내 id
const EVENTS = `
  SELECT 'comment' AS kind, c.id AS ref_id, c.post_id AS post_id, c.author_id AS actor_id, LEFT(c.body, 80) AS snippet, c.created_at AS created_at
    FROM comments c JOIN posts p ON p.id = c.post_id LEFT JOIN comments pc ON pc.id = c.parent_id
    WHERE p.author_id = ? AND c.author_id <> ? AND c.deleted = 0 AND (pc.author_id IS NULL OR pc.author_id <> ?)
  UNION ALL
  SELECT 'reply', c.id, c.post_id, c.author_id, LEFT(c.body, 80), c.created_at
    FROM comments c JOIN comments pc ON pc.id = c.parent_id
    WHERE pc.author_id = ? AND c.author_id <> ? AND c.deleted = 0
  UNION ALL
  SELECT 'like_post', l.target_id, l.target_id, l.user_id, '', l.created_at
    FROM likes l JOIN posts p ON p.id = l.target_id
    WHERE l.target_type = 'p' AND p.author_id = ? AND l.user_id <> ?
  UNION ALL
  SELECT 'like_comment', l.target_id, c.post_id, l.user_id, LEFT(c.body, 80), l.created_at
    FROM likes l JOIN comments c ON c.id = l.target_id
    WHERE l.target_type = 'c' AND c.author_id = ? AND l.user_id <> ? AND c.deleted = 0`;
const SEEN = "(SELECT notif_seen_at FROM users WHERE id = ?)";

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    const db = L.db(), P = Array(9).fill(me.id);

    if (req.method === "POST") {
      if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });
      await db.query("UPDATE users SET notif_seen_at = NOW() WHERE id = ?", [me.id]);
      return L.json(res, 200, { unread: 0 });
    }
    if (req.method !== "GET") return L.json(res, 405, { error: "허용되지 않는 요청입니다." });

    const [cnt] = await db.query(`SELECT COUNT(*) AS n FROM (${EVENTS}) e WHERE e.created_at > ${SEEN}`, [...P, me.id]);
    const unread = Number(cnt[0].n);
    if (req.query.count) return L.json(res, 200, { unread });

    const [rows] = await db.query(`SELECT e.kind, e.ref_id, e.post_id, e.snippet, e.created_at, e.created_at > ${SEEN} AS is_new, u.id AS actor_id, u.nickname, u.photo_v, p.title
      FROM (${EVENTS}) e JOIN users u ON u.id = e.actor_id JOIN posts p ON p.id = e.post_id ORDER BY e.created_at DESC, e.ref_id DESC LIMIT 50`, [me.id, ...P]);
    return L.json(res, 200, {
      unread,
      items: rows.map((r) => ({
        kind: r.kind, refId: r.ref_id, postId: r.post_id, postTitle: r.title, snippet: r.snippet, createdAt: r.created_at, isNew: !!Number(r.is_new),
        actor: { id: r.actor_id, nickname: r.nickname, photoUrl: L.photoUrl({ id: r.actor_id, photo_v: r.photo_v }) },
      })),
    });
  } catch (e) {
    console.error("notifications", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
