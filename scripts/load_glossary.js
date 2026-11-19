// HR 용어 사전 적재 — terms.json(법령 확인을 마친 우리 문장)을 TiDB 의 gl_* 표에 넣는다. 다시 돌려도 같은 결과(slug 로 덮어쓰기).
// 실행: node scripts/load_glossary.js <terms.json>            ← 기본은 «검사만»(DB 에 연결하지 않는다)
//       node scripts/load_glossary.js <terms.json> --execute  ← 검사를 통과하면 실제로 넣는다(.env 의 TiDB)
// 먼저 python scripts/init_db.py 로 표를 만들어 둘 것. 형식은 CLAUDE.md «HR 용어 사전» 항목.
const fs = require("fs"), path = require("path");
const { CATS, norm } = require("../api/_gl");

const file = process.argv[2], execute = process.argv.includes("--execute");
if (!file) { console.error("사용법: node scripts/load_glossary.js <terms.json> [--execute]"); process.exit(2); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const STATUS = ["VERIFIED", "DRAFT", "REJECTED"];
const errors = [], warns = [];
const err = (t, m) => errors.push(`${t.slug || t.name || "?"}: ${m}`);
const warn = (t, m) => warns.push(`${t.slug}: ${m}`);

// ── 검사: 하나라도 틀리면 아무것도 넣지 않는다 ──
const catName = Object.fromEntries((data.categories || []).map((c) => [c.key, c.name]));   // terms.json 의 category 는 키(labor 등) — 화면에 나가는 분류 이름으로 바꾼다
for (const t of data.terms) t.category = catName[t.category] ?? t.category;
const slugs = new Set(), owner = new Map();
for (const t of data.terms) {
  if (!t.slug || !t.name) { err(t, "slug·name 이 비었다"); continue; }
  if (slugs.has(t.slug)) err(t, "slug 가 겹친다"); slugs.add(t.slug);
  if (!CATS.includes(t.category)) err(t, `분류 «${t.category}» 가 목록에 없다`);
  if (!STATUS.includes(t.status)) err(t, `status «${t.status}» 가 잘못됐다`);
  if (!t.summary || t.summary.length > 200) err(t, "summary 가 비었거나 200자를 넘는다");
  if (!t.body) err(t, "body 가 비었다");
  for (const a of [t.name, t.abbr, t.en, ...(t.aliases || [])].filter(Boolean)) {   // 별칭은 전체에서 유일 — 겹치면 병합 누락이거나 동음이의어다
    const k = norm(a); if (!k) continue;
    if (owner.has(k) && owner.get(k) !== t.slug) err(t, `별칭 «${a}» 가 ${owner.get(k)} 와 겹친다`); else owner.set(k, t.slug);
  }
  if (t.status === "VERIFIED") {
    if (t.needsLaw && !(t.law || []).length) err(t, "법령 확인이 필요한 용어인데 근거 법령이 없다");
    for (const l of t.law || []) {
      if (!l.name || !l.article || !l.verifiedOn) err(t, "근거 법령에 name·article·verifiedOn 이 빠졌다");
      if (!/^https:\/\/(www\.)?law\.go\.kr\//.test(l.url || "")) err(t, `법령 주소가 법제처가 아니다: ${l.url}`);
    }
    for (const f of t.figures || []) {
      if (!f.label || !f.value || !f.validFrom) err(t, "기준 숫자에 label·value·validFrom 이 빠졌다");
      if (f.lawIdx != null && !(t.law || [])[f.lawIdx]) err(t, `기준 숫자의 lawIdx ${f.lawIdx} 가 근거 법령 범위 밖이다`);
    }
    if (/\d+(\.\d+)?\s*(%|퍼센트|원|만원)/.test(t.body)) warn(t, "body 에 금액·비율 숫자가 있다 — 변하는 숫자는 figures 로");
  }
}
for (const t of data.terms) for (const c of t.confusable || []) if (!slugs.has(c.slug)) err(t, `헷갈리는 짝 «${c.slug}» 가 사전에 없다`);

const by = (k) => data.terms.reduce((m, t) => ((m[t[k]] = (m[t[k]] || 0) + 1), m), {});
console.log(`용어 ${data.terms.length}개 · 상태 ${JSON.stringify(by("status"))} · 분류 ${JSON.stringify(by("category"))}`);
for (const w of warns) console.log("주의  " + w);
if (errors.length) { for (const e of errors) console.error("오류  " + e); console.error(`\n오류 ${errors.length}건 — 아무것도 넣지 않았다.`); process.exit(1); }
if (!execute) { console.log("검사 통과. 실제로 넣으려면 --execute"); process.exit(0); }

// ── 적재 ──
(async () => {
  for (const l of fs.readFileSync(path.resolve(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) { const i = l.indexOf("="); if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
  const L = require("../api/_lib"), conn = await L.db().getConnection();
  try {
    await conn.beginTransaction();
    const ids = {};
    for (const t of data.terms) {
      await conn.query(
        `INSERT INTO gl_term (slug, name, abbr, en, category, summary, body, needs_law, status, check_note, checked_on, version)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name), abbr=VALUES(abbr), en=VALUES(en), category=VALUES(category), summary=VALUES(summary), body=VALUES(body),
           needs_law=VALUES(needs_law), status=VALUES(status), check_note=VALUES(check_note), checked_on=VALUES(checked_on), version=VALUES(version)`,
        [t.slug, t.name, t.abbr || null, t.en || null, t.category, t.summary, t.body, t.needsLaw ? 1 : 0, t.status, t.checkNote || "", (t.law || []).map((l) => l.verifiedOn).sort().pop() || null, data.version || ""]);
      const [[r]] = await conn.query("SELECT id FROM gl_term WHERE slug = ?", [t.slug]);
      ids[t.slug] = r.id;
      for (const tb of ["gl_alias", "gl_link", "gl_law", "gl_figure"]) await conn.query(`DELETE FROM ${tb} WHERE term_id = ?`, [r.id]);
    }
    // 별칭이 다른 용어에 이미 있으면(유니크) 여기서 오류 → 전체 되돌림
    for (const t of data.terms) {
      const id = ids[t.slug], seen = new Set();
      for (const a of [t.name, t.abbr, t.en, ...(t.aliases || [])].filter(Boolean)) { const k = norm(a); if (k && !seen.has(k)) { seen.add(k); await conn.query("INSERT INTO gl_alias (term_id, alias, alias_norm) VALUES (?,?,?)", [id, a, k]); } }
      for (const c of t.confusable || []) await conn.query("INSERT INTO gl_link (term_id, other_id, diff) VALUES (?,?,?)", [id, ids[c.slug], c.diff || ""]);
      for (const [i, l] of (t.law || []).entries()) await conn.query("INSERT INTO gl_law (term_id, seq, law_name, article, url, effective, verified_on) VALUES (?,?,?,?,?,?,?)", [id, i, l.name, l.article, l.url, l.effective || "", l.verifiedOn]);
      for (const f of t.figures || []) await conn.query("INSERT INTO gl_figure (term_id, label, value, unit, valid_from, valid_to, law_seq) VALUES (?,?,?,?,?,?,?)", [id, f.label, f.value, f.unit || "", f.validFrom, f.validTo || null, f.lawIdx ?? null]);
    }
    const [[have]] = await conn.query("SELECT COUNT(*) n FROM gl_term WHERE slug NOT IN (?)", [data.terms.map((t) => t.slug)]);
    await conn.commit();
    console.log(`넣었다: ${data.terms.length}개.` + (have.n ? ` (이 파일에 없는 기존 용어 ${have.n}개는 그대로 둔다)` : ""));
  } catch (e) { await conn.rollback(); console.error("실패 — 전부 되돌렸다:", e.message); process.exitCode = 1; }
  finally { conn.release(); process.exit(); }
})();
