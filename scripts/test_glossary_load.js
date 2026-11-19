// 적재 검사(load_glossary.js)가 나쁜 입력을 막는지 — DB 없이 돈다. 실행: node scripts/test_glossary_load.js <정상 terms.json>
const { spawnSync } = require("child_process"), fs = require("fs"), os = require("os"), path = require("path");
const good = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const run = (mut) => {
  const d = JSON.parse(JSON.stringify(good)); mut(d);
  const f = path.join(os.tmpdir(), "gl_test.json"); fs.writeFileSync(f, JSON.stringify(d));
  const r = spawnSync("node", [path.join(__dirname, "load_glossary.js"), f], { encoding: "utf8" });
  return { code: r.status, out: r.stdout + r.stderr };
};
const T = (d, s) => d.terms.find((t) => t.slug === s);
const cases = [
  ["정상", () => {}, 0, ""],
  ["별칭 충돌", (d) => T(d, "kpi").aliases.push("JD"), 1, "겹친다"],
  ["법령 근거 없음", (d) => (T(d, "통상임금").law = []), 1, "근거 법령이 없다"],
  ["법제처가 아닌 주소", (d) => (T(d, "통상임금").law[0].url = "https://example.com/x"), 1, "법제처가 아니다"],
  ["없는 헷갈리는 짝", (d) => T(d, "kpi").confusable.push({ slug: "없음", diff: "x" }), 1, "사전에 없다"],
  ["분류 오타", (d) => (T(d, "kpi").category = "기타"), 1, "목록에 없다"],
  ["기준 숫자의 법령 번호", (d) => (T(d, "국민연금").figures[0].lawIdx = 5), 1, "범위 밖"],
];
let bad = 0;
for (const [name, mut, code, msg] of cases) { const r = run(mut), ok = r.code === code && r.out.includes(msg); if (!ok) bad++; console.log((ok ? "OK   " : "FAIL ") + name); }
process.exit(bad ? 1 : 0);
