// 회의록 — 비공개. 로그인한 «발표자 5명»(users.presenter)만 볼 수 있다. 내용은 DB(meetings)에만 있고 화면 파일에는 없다.
//   GET /api/minutes        → 회의 목록 [{id, title, heldAt, durationS}]
//   GET /api/minutes?id=N   → 한 회의 {id, title, heldAt, durationS, summary, transcript}
const L = require("./_lib");

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    if (!me.presenter) return L.json(res, 403, { error: "이 페이지를 볼 수 있는 사람이 아니에요." });
    if (req.method !== "GET") return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
    const db = L.db();
    // 마이페이지 «새 소식» 숫자: ?count=1&after=N → 번호가 N 보다 큰 새 회의록 수와 가장 큰 번호. after 가 없으면 숫자는 0(처음 쓰는 기기는 지금까지의 것을 «본 것» 으로 시작).
    if (req.query.count) {
      const [[r]] = await db.query("SELECT COALESCE(MAX(id), 0) AS latest FROM meetings");
      const after = Number(req.query.after);
      if (!Number.isInteger(after) || after < 0) return L.json(res, 200, { count: 0, latest: Number(r.latest) });
      const [[c]] = await db.query("SELECT COUNT(*) AS n FROM meetings WHERE id > ?", [after]);
      return L.json(res, 200, { count: Number(c.n), latest: Number(r.latest) });
    }
    if (!req.query.id) {
      const [rows] = await db.query("SELECT id, title, held_at, duration_s FROM meetings ORDER BY held_at DESC");
      return L.json(res, 200, { meetings: rows.map((r) => ({ id: r.id, title: r.title, heldAt: r.held_at, durationS: r.duration_s })) });
    }
    const id = Number(req.query.id);
    if (!Number.isInteger(id) || id < 1) return L.json(res, 400, { error: "잘못된 요청입니다." });
    const [rows] = await db.query("SELECT id, title, held_at, duration_s, summary, transcript FROM meetings WHERE id = ?", [id]);
    const r = rows[0];
    if (!r) return L.json(res, 404, { error: "회의록을 찾을 수 없어요." });
    return L.json(res, 200, { id: r.id, title: r.title, heldAt: r.held_at, durationS: r.duration_s, summary: JSON.parse(r.summary), transcript: JSON.parse(r.transcript) });
  } catch (e) {
    console.error("minutes", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
