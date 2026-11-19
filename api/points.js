// GET /api/points → 포인트 현황(로그인한 사람만): 내 올해·누적·연도별, 올해 순위표(닉네임·사진·점수만), 내 최근 적립, 규칙 숫자.
// 점수 규칙과 적립은 api/_points.js. 이 문은 읽기만 한다.
const L = require("./_lib");
const P = require("./_points");

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    if (req.method !== "GET") return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
    const db = L.db(), yr = P.year();
    const [users] = await db.query("SELECT id, nickname, photo_v FROM users ORDER BY id");
    const [sums] = await db.query("SELECT user_id, SUM(pts) AS total, SUM(CASE WHEN yr = ? THEN pts ELSE 0 END) AS year_pts FROM points GROUP BY user_id", [yr]);
    const by = new Map(sums.map((s) => [s.user_id, { total: Number(s.total), year: Number(s.year_pts) }]));
    const board = users.map((u) => ({ id: u.id, nickname: u.nickname, photoUrl: L.photoUrl(u), year: (by.get(u.id) || {}).year || 0, total: (by.get(u.id) || {}).total || 0, me: u.id === me.id }))
      .sort((a, b) => b.year - a.year || b.total - a.total || a.id - b.id);
    board.forEach((b, i) => { b.rank = i > 0 && b.year === board[i - 1].year ? board[i - 1].rank : i + 1; });   // 같은 점수는 같은 순위
    const [years] = await db.query("SELECT yr, SUM(pts) AS pts FROM points WHERE user_id = ? GROUP BY yr ORDER BY yr DESC", [me.id]);
    const [recent] = await db.query("SELECT t.kind, t.pts, t.post_id, t.created_at, p.title FROM points t LEFT JOIN posts p ON p.id = t.post_id WHERE t.user_id = ? ORDER BY t.id DESC LIMIT 8", [me.id]);
    const mine = board.find((b) => b.me) || { year: 0, total: 0, rank: board.length };
    return L.json(res, 200, {
      year: yr, me: { year: mine.year, total: mine.total, rank: mine.rank },
      years: years.map((y) => ({ year: y.yr, pts: Number(y.pts) })), board,
      recent: recent.map((r) => ({ kind: r.kind, label: P.KIND[r.kind] || r.kind, pts: r.pts, postId: r.post_id, title: r.title || "", at: r.created_at })),
      rules: P.RULES,
    });
  } catch (e) {
    console.error("points", e);
    return L.json(res, 500, { error: "포인트를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요." });
  }
};
