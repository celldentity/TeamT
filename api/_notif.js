// 알림의 «무엇이 새 알림인가» 한 곳에 모은다 — 알림 페이지·상단 종 숫자·폰 푸시의 앱 아이콘 숫자(배지)가 모두 같은 값을 쓴다.
// 별도 알림 표 없이 글·댓글·좋아요 기록에서 바로 뽑고, users.notif_seen_at 이후에 생긴 것이 «새 알림»이다. 파일명이 _ 로 시작해 라우트로 노출되지 않는다.
// 종류: post = 다른 사람(또는 T조 AI)의 새 글(피드 글 제외) · comment = 내 글에 달린 댓글 · reply = 내 댓글에 달린 답글 · like_post = 내 글 좋아요 · like_comment = 내 댓글 좋아요
const POST_FROM = "2026-11-18 06:30:00";   // 새 글 알림은 이 시각(UTC) 이후 글부터 — 기존 글이 한꺼번에 «새 알림»으로 쏟아지지 않게
const N_ARGS = 10;                          // EVENTS 안의 ? 개수(전부 내 id)

const EVENTS = `
  SELECT 'post' AS kind, p.id AS ref_id, p.id AS post_id, p.author_id AS actor_id, '' AS snippet, p.created_at AS created_at
    FROM posts p WHERE (p.author_id IS NULL OR p.author_id <> ?) AND p.kind <> 'feed' AND p.created_at > '${POST_FROM}'   -- 피드 글은 «새 글» 알림에서 뺀다(내 피드에 달린 댓글·좋아요만 알림)
  UNION ALL
  SELECT 'comment', c.id, c.post_id, c.author_id, LEFT(c.body, 80), c.created_at
    FROM comments c JOIN posts p ON p.id = c.post_id LEFT JOIN comments pc ON pc.id = c.parent_id
    WHERE p.author_id = ? AND (c.author_id IS NULL OR c.author_id <> ?) AND c.deleted = 0 AND (pc.author_id IS NULL OR pc.author_id <> ?)
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
const args = (uid) => Array(N_ARGS).fill(uid);

async function unread(db, uid) {
  const [r] = await db.query(`SELECT COUNT(*) AS n FROM (${EVENTS}) e WHERE e.created_at > ${SEEN}`, [...args(uid), uid]);
  let extra = 0;   // 시스템 알림(notices) — 표가 아직 없는 환경이면 0
  try { const [n] = await db.query(`SELECT COUNT(*) AS n FROM notices WHERE user_id = ? AND created_at > ${SEEN}`, [uid, uid]); extra = Number(n[0].n); } catch (e) { if (e.errno !== 1146) throw e; }
  return Number(r[0].n) + extra;
}

module.exports = { EVENTS, SEEN, args, unread };
