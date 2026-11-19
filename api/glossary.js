// HR 용어 사전 API — 로그인한 사람만. 법령 확인을 통과한 용어(status = VERIFIED)만 내려 주고, 검색은 화면에서 한다(100개 안팎이라 한 번에 받는 게 빠르다).
//   GET /api/glossary → { version, categories, terms:[{slug,name,abbr,en,category,summary,body,aliases,confusable,law,figures,checkedOn}] }
// 표는 scripts/init_db.py 가 만든다. 아직 안 만들어졌으면 빈 목록을 준다(배포가 먼저 나가도 화면이 깨지지 않게).
const L = require("./_lib");
const G = require("./_gl");

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const group = (rows) => rows.reduce((m, r) => ((m[r.term_id] ??= []).push(r), m), {});

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    if (req.method !== "GET") return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
    const db = L.db();
    const [terms] = await db.query("SELECT id, slug, name, abbr, en, category, summary, body, checked_on, version FROM gl_term WHERE status = 'VERIFIED'");
    const ok = "term_id IN (SELECT id FROM gl_term WHERE status = 'VERIFIED')";
    const [[al], [cf], [law], [fig]] = await Promise.all([
      db.query(`SELECT term_id, alias FROM gl_alias WHERE ${ok}`),
      db.query(`SELECT l.term_id, o.slug, o.name, l.diff FROM gl_link l JOIN gl_term o ON o.id = l.other_id AND o.status = 'VERIFIED' WHERE ${ok.replace("term_id", "l.term_id")}`),
      db.query(`SELECT term_id, seq, law_name, article, url, effective, verified_on FROM gl_law WHERE ${ok} ORDER BY seq`),
      db.query(`SELECT term_id, label, value, unit, valid_from, valid_to, law_seq FROM gl_figure WHERE ${ok} ORDER BY id`),
    ]);
    const A = group(al), C = group(cf), W = group(law), F = group(fig);
    res.setHeader("Cache-Control", "private, max-age=300");
    return L.json(res, 200, {
      version: terms.reduce((v, t) => (t.version > v ? t.version : v), ""),
      categories: G.CATS,
      terms: terms.sort((a, b) => a.name.localeCompare(b.name, "ko")).map((t) => ({
        slug: t.slug, name: t.name, abbr: t.abbr, en: t.en, category: t.category, summary: t.summary, body: t.body, checkedOn: day(t.checked_on),
        aliases: (A[t.id] || []).map((a) => a.alias),
        confusable: (C[t.id] || []).map((c) => ({ slug: c.slug, name: c.name, diff: c.diff })),
        law: (W[t.id] || []).map((w) => ({ name: w.law_name, article: w.article, url: w.url, effective: w.effective, verifiedOn: day(w.verified_on) })),
        figures: (F[t.id] || []).map((f) => ({ label: f.label, value: f.value, unit: f.unit, validFrom: day(f.valid_from), validTo: day(f.valid_to), law: f.law_seq })),
      })),
    });
  } catch (e) {
    if (e && e.errno === 1146) return L.json(res, 200, { version: "", categories: G.CATS, terms: [] });   // 표가 아직 없음
    console.error("glossary", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
