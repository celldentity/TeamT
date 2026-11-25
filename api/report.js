// 주간 토론 정리 리포트(PDF) 내려받기 — 로그인한 사람만.
//   GET /api/report?id=<주간 토론 글 번호> → 리포트가 올라와 있으면(stage 'report') 파일 이름이 붙은 임시 주소(10분)로 302, 아니면 404.
// 리포트는 운영자가 지시해서 scripts/make_report.js 로 만들어 올린다(자동 생성 아님).
const L = require("./_lib");
const M = require("./_media");

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    if (req.method !== "GET") return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
    const id = Number(req.query.id);
    if (!Number.isInteger(id) || id < 1) return L.json(res, 400, { error: "잘못된 요청입니다." });
    const [rows] = await L.db().query("SELECT title, qdate FROM posts WHERE id = ? AND kind = 'weekly' AND stage = 'report'", [id]);
    if (!rows[0]) return L.json(res, 404, { error: "아직 올라온 리포트가 없어요." });
    const day = rows[0].qdate ? new Date(rows[0].qdate).toISOString().slice(0, 10) : "";
    const name = `HR T 토론 정리${day ? " " + day : ""} - ${String(rows[0].title).replace(/[\\/:*?"<>|\r\n]+/g, " ").trim().slice(0, 40)}.pdf`;
    res.statusCode = 302;
    res.setHeader("Location", await M.reportUrl(id, name));
    res.setHeader("Cache-Control", "private, no-store");
    return res.end();
  } catch (e) {
    console.error("report", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
