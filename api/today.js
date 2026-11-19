// HR 일력 — 로그인한 사람만. GET /api/today[?days=N] → 오늘 카드(없으면 만든다)와 지난 카드(있는 것만, 최근 N-1장, 기본 7장·최대 400장 — 올해 지난 장을 모두 넘겨 볼 수 있다)
const L = require("./_lib");
const I = require("./_ilryeok");

const shape = (r) => ({ date: new Date(r.qdate).toISOString().slice(0, 10), category: r.category, quote: r.quote, note: r.note, question: r.question });

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    if (req.method !== "GET") return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
    const db = L.db(), days = Math.min(400, Math.max(1, Number(req.query.days) || 7)), today = I.kstDate();
    const t = await I.ensure(db, today);
    const [rows] = await db.query("SELECT qdate, category, quote, note, question FROM daily_cards WHERE qdate < ? ORDER BY qdate DESC LIMIT ?", [today, days - 1]);
    return L.json(res, 200, { today: shape(t), past: rows.map(shape) });
  } catch (e) {
    console.error("today", e);
    return L.json(res, 500, { error: "일력을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요." });
  }
};
