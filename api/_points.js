// 포인트 제도(2026-11-19 요청). 파일명이 _ 로 시작해 라우트로 노출되지 않는다.
//  · 오늘의 질문: 지목된 사람이 «제대로 된 답»(공백 뺀 DAILY_MIN 자 이상)을 댓글로 남기면 +DAILY.
//  · 이번 주 토론: Claude 가 아티클로 정리해 토론이 끝나는 순간 한 번 정산한다.
//      댓글을 하나라도 남긴 사람 +JOIN / 의미 있는 댓글(공백 뺀 TOP_MIN 자 이상)을 가장 많이 남긴 사람(공동 포함, 2개 이상) +TOP /
//      Claude 가 «흐름과 결론에 핵심 역할»이라고 판단한 사람(최대 KEY_MAX 명) +KEY. 댓글이 하나도 없는 사람은 0점.
//  · 점수는 points 표에 한 줄씩 쌓이고(누적 기록은 남는다), 연도(yr)별로 합산해 «올해 포인트»를 보여 준다 — 해가 바뀌면 올해 점수는 0 에서 다시 시작한다.
//  · 같은 일로 두 번 받지 않는다: UNIQUE(user_id, kind, post_id). 정산·적립은 몇 번 불러도 한 번만.
const L = require("./_lib");

const RULES = { DAILY: 10, JOIN: 5, TOP: 5, KEY: 10, DAILY_MIN: 30, TOP_MIN: 10, KEY_MAX: 2 };
const KIND = { daily: "오늘의 질문 답변", w_join: "주간 토론 참여", w_top: "주간 토론 댓글 최다", w_key: "주간 토론 핵심 역할" };
const year = () => new Date(Date.now() + 9 * 36e5).getUTCFullYear();
const size = (s) => [...String(s || "").replace(/\s+/g, "")].length;   // 공백·줄바꿈을 뺀 글자 수

async function give(db, userId, kind, postId, commentId, pts, note) {
  const [r] = await db.query("INSERT IGNORE INTO points (user_id, kind, post_id, comment_id, pts, yr, note) VALUES (?, ?, ?, ?, ?, ?, ?)", [userId, kind, postId, commentId || null, pts, year(), String(note || "").slice(0, 200)]);
  return r.affectedRows > 0;
}

// 댓글을 쓰거나 고친 뒤 부른다: 오늘의 질문에서 지목된 사람의 «제대로 된 답»이면 적립, 고쳐서 짧아졌으면 그 댓글로 받은 것을 회수. 받은 점수를 돌려준다(0 = 해당 없음).
async function onComment(db, { postId, commentId, userId, text }) {
  const [[p]] = await db.query("SELECT kind, target_id FROM posts WHERE id = ?", [postId]);
  if (!p || p.kind !== "daily" || p.target_id !== userId) return 0;
  if (size(text) >= RULES.DAILY_MIN) return (await give(db, userId, "daily", postId, commentId, RULES.DAILY, "")) ? RULES.DAILY : 0;
  await db.query("DELETE FROM points WHERE kind = 'daily' AND post_id = ? AND comment_id = ? AND user_id = ?", [postId, commentId, userId]);
  return 0;
}

// 댓글을 지웠을 때: 그 댓글로 받은 점수를 회수하되, 같은 글에 다른 «제대로 된 답»이 남아 있으면 그쪽으로 다시 이어 준다.
async function onGone(db, commentId) {
  const [rows] = await db.query("SELECT user_id, post_id FROM points WHERE kind = 'daily' AND comment_id = ?", [commentId]);
  if (!rows[0]) return;
  const { user_id: uid, post_id: pid } = rows[0];
  await db.query("DELETE FROM points WHERE kind = 'daily' AND comment_id = ?", [commentId]);
  const [cs] = await db.query("SELECT id, body FROM comments WHERE post_id = ? AND author_id = ? AND deleted = 0 AND id <> ? ORDER BY id", [pid, uid, commentId]);
  const ok = cs.find((c) => size(c.body) >= RULES.DAILY_MIN);
  if (ok) await give(db, uid, "daily", pid, ok.id, RULES.DAILY, "");
}

// 이미 올라가 있던 오늘의 질문 답변을 훑어 빠진 점수를 채운다(제도를 시작한 날 한 번, 또는 점검용). dry = 쓰지 않고 목록만.
async function backfillDaily(db, dry) {
  const [cs] = await db.query("SELECT c.id, c.post_id, c.author_id, c.body FROM comments c JOIN posts p ON p.id = c.post_id AND p.kind = 'daily' AND p.target_id = c.author_id WHERE c.deleted = 0 ORDER BY c.id");
  const seen = new Set(), out = [];
  for (const c of cs) {
    const k = c.author_id + ":" + c.post_id;
    if (seen.has(k) || size(c.body) < RULES.DAILY_MIN) continue;
    seen.add(k);
    const [[ex]] = await db.query("SELECT 1 AS x FROM points WHERE user_id = ? AND kind = 'daily' AND post_id = ?", [c.author_id, c.post_id]);
    if (ex) continue;
    out.push({ user: c.author_id, post: c.post_id, comment: c.id });
    if (!dry) await give(db, c.author_id, "daily", c.post_id, c.id, RULES.DAILY, "");
  }
  return out;
}

// 주간 토론 정산. keys = Claude 가 고른 핵심 역할 [{nickname, reason}] (없으면 가산점 없음). 토론에 댓글을 단 사람만 받는다.
// 돌려주는 것: { gave: {userId: {pts, parts:[..]}}, top:[닉네임], key:[{nickname, reason}] } — 푸시·AI 안내 댓글에 쓴다.
async function settleWeek(db, post, keys) {
  const [rows] = await db.query("SELECT c.author_id AS uid, u.nickname, COUNT(*) AS n, SUM(CHAR_LENGTH(REPLACE(REPLACE(c.body, ' ', ''), '\\n', '')) >= ?) AS good FROM comments c JOIN users u ON u.id = c.author_id WHERE c.post_id = ? AND c.deleted = 0 GROUP BY c.author_id, u.nickname", [RULES.TOP_MIN, post.id]);
  const gave = {}, add = (uid, pts, part) => { (gave[uid] = gave[uid] || { pts: 0, parts: [] }); gave[uid].pts += pts; gave[uid].parts.push(part); };
  const topN = Math.max(0, ...rows.map((r) => Number(r.good)));
  const topIds = topN >= 2 ? rows.filter((r) => Number(r.good) === topN).map((r) => r.uid) : [];
  const keyHits = [];
  for (const k of (Array.isArray(keys) ? keys : []).slice(0, 8)) {
    const r = rows.find((x) => x.nickname === String(k && k.nickname || "").trim());
    if (r && !keyHits.some((h) => h.uid === r.uid) && keyHits.length < RULES.KEY_MAX) keyHits.push({ uid: r.uid, nickname: r.nickname, reason: String(k.reason || "").trim().slice(0, 120) });
  }
  for (const r of rows) {
    if (await give(db, r.uid, "w_join", post.id, null, RULES.JOIN, post.title)) add(r.uid, RULES.JOIN, "참여");
    if (topIds.includes(r.uid) && (await give(db, r.uid, "w_top", post.id, null, RULES.TOP, post.title))) add(r.uid, RULES.TOP, "댓글 최다");
  }
  for (const h of keyHits) if (await give(db, h.uid, "w_key", post.id, null, RULES.KEY, h.reason || post.title)) add(h.uid, RULES.KEY, "핵심 역할");
  return { gave, top: rows.filter((r) => topIds.includes(r.uid)).map((r) => r.nickname), key: keyHits.map((h) => ({ nickname: h.nickname, reason: h.reason })) };
}

module.exports = { RULES, KIND, year, size, onComment, onGone, backfillDaily, settleWeek };
