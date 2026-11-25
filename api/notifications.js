// 알림 — 로그인한 사람만. 별도 알림 표 없이 댓글·좋아요 기록에서 바로 뽑는다(내가 한 것은 제외).
//   GET  /api/notifications          → {unread, items[]}  (최근 50개, isNew = 마지막 확인 이후)
//   GET  /api/notifications?count=1  → {unread}           (상단바 숫자용)
//   POST /api/notifications {read:true} → 지금까지 확인함으로 표시
// 종류: post = 새 글 · comment = 내 글에 달린 댓글 · reply = 내 댓글에 달린 답글 · like_post = 내 글 좋아요 · like_comment = 내 댓글 좋아요 (정의는 _notif.js)
const L = require("./_lib");
const AI = require("./_persona");

const N = require("./_notif");
const { EVENTS, SEEN } = N;

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    const db = L.db(), P = N.args(me.id);

    if (req.method === "POST") {
      if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });
      await db.query("UPDATE users SET notif_seen_at = NOW() WHERE id = ?", [me.id]);
      return L.json(res, 200, { unread: 0 });
    }
    if (req.method !== "GET") return L.json(res, 405, { error: "허용되지 않는 요청입니다." });

    const [cnt] = await db.query(`SELECT COUNT(*) AS n FROM (${EVENTS}) e WHERE e.created_at > ${SEEN}`, [...P, me.id]);
    // 시스템 알림(notices, 예: 도메인 만료 임박) — 본인 것만. 표가 아직 없으면 건너뛴다.
    let notices = [];
    try { [notices] = await db.query(`SELECT id, kind, title, body, created_at, created_at > ${SEEN} AS is_new FROM notices WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`, [me.id, me.id]); } catch (e) { if (e.errno !== 1146) throw e; }
    const unread = Number(cnt[0].n) + notices.filter((n) => Number(n.is_new)).length;
    if (req.query.count) return L.json(res, 200, { unread });

    const [rows] = await db.query(`SELECT e.kind, e.ref_id, e.post_id, e.snippet, e.created_at, e.created_at > ${SEEN} AS is_new, u.id AS actor_id, u.nickname, u.photo_v, p.title
      FROM (${EVENTS}) e LEFT JOIN users u ON u.id = e.actor_id JOIN posts p ON p.id = e.post_id ORDER BY e.created_at DESC, e.ref_id DESC LIMIT 50`, [me.id, ...P]);
    const sys = notices.map((n) => ({ kind: "notice", refId: n.id, postId: /^ready:\d+$/.test(n.kind) ? Number(n.kind.slice(6)) : 0, postTitle: n.title, snippet: n.body, createdAt: n.created_at, isNew: !!Number(n.is_new), actor: { id: 0, nickname: "공지", photoUrl: null } }));
    return L.json(res, 200, {
      unread,
      items: [...sys, ...rows.map((r) => ({
        kind: r.kind, refId: r.ref_id, postId: r.post_id, postTitle: r.title, snippet: r.snippet, createdAt: r.created_at, isNew: !!Number(r.is_new),
        actor: r.actor_id ? { id: r.actor_id, nickname: r.nickname, photoUrl: L.photoUrl({ id: r.actor_id, photo_v: r.photo_v }) } : { id: 0, nickname: AI.AI_NAME, photoUrl: AI.AI_PHOTO, ai: true },   // 글쓴이 없음 = AI 캐릭터 «미드핑»
      }))].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50),
    });
  } catch (e) {
    console.error("notifications", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
