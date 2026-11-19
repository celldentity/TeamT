// 질문 은행 합치기(한 번 돌린 기록용) — node scripts/qimg/merge_qbank.js <새 질문 폴더>
// scripts/qimg/existing.json(기존 165개, id 부여됨) + 새 질문 JSON 들 → api/_qbank.json(런타임) + scripts/qimg/scenes.json(그림 장면, 종류별로 골고루 섞은 순서).
// 새 id 는 기존 마지막 번호 다음부터. 같은 입력을 다시 돌리면 같은 id 가 나온다(파일 이름 순서·배열 순서 고정).
const fs = require("fs"), path = require("path");
const dir = process.argv[2];
const ex = require("./existing.json");
const scenesEx = JSON.parse(fs.readFileSync(path.join(dir, "scenes_existing.json"), "utf8"));
const CATS = require("../../api/_lib").CATS;
const SENS = ["연봉", "월급", "몇 살", "나이", "결혼", "이혼", "종교", "정당", "대통령", "임신", "질병", "우울", "가족", "부모님"];
const len = (s) => [...String(s)].length;
const key = (s) => s.replace(/[\s«»"'?？.,]/g, "");
const bi = (s) => { const k = key(s), o = new Set(); for (let i = 0; i < k.length - 1; i++) o.add(k.slice(i, i + 2)); return o; };
const sim = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n); };

const files = fs.readdirSync(dir).filter((f) => /^(HR|CA|SA|DA|WK)(_.)?\.json$/.test(f)).sort();
const daily = ex.daily.slice(), weekly = ex.weekly.slice(), scenes = { ...scenesEx };
const skipped = [];
const all = [...daily, ...weekly].map((q) => ({ q, b: bi(q.title) }));
let dn = daily.length, wn = weekly.length;
for (const f of files) {
  for (const r of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) {
    const why = [];
    const type = r.type, title = String(r.title || "").trim(), hint = String(r.hint || "").trim(), scene = String(r.scene || "").trim();
    if (!["HR", "커리어", "상식", "일상", "토론"].includes(type)) why.push("종류");
    if (!CATS.includes(r.category)) why.push("분류");
    if (len(title) < 2 || len(title) > 80) why.push("제목 길이");
    if (!/[?？]$/.test(title)) why.push("물음표");
    if (len(hint) < 10) why.push("hint 짧음");
    if (type === "토론" ? len(hint) < 80 || len(hint) > 2500 : len(hint) > 300) why.push("hint 길이");
    if (len(scene) < 40) why.push("scene 없음");
    if (/[ㄱ-ㆎ가-힣]/.test(scene)) why.push("scene 에 한글");
    for (const w of SENS) if ((title + hint).includes(w)) why.push("민감어 " + w);
    const b = bi(title);
    const dup = all.find((x) => sim(b, x.b) >= 0.6);
    if (dup) why.push("겹침: " + dup.q.title);
    if (why.length) { skipped.push(`${f} ${title} → ${why.join(", ")}`); continue; }
    const q = type === "토론" ? { id: "w" + String(++wn).padStart(3, "0"), type, category: r.category, title, hint } : { id: "d" + String(++dn).padStart(4, "0"), type, category: r.category, title, hint };
    (type === "토론" ? weekly : daily).push(q); scenes[q.id] = scene; all.push({ q, b });
  }
}
fs.writeFileSync(path.join(__dirname, "../../api/_qbank.json"), JSON.stringify({ daily, weekly }));
// 그림 만드는 순서: 종류마다 비율대로 섞어 어느 시점에 멈춰도 모든 종류가 고르게 있게
const order = [...daily, ...weekly].map((q) => ({ id: q.id, t: q.type })), cnt = {};
for (const o of order) cnt[o.t] = (cnt[o.t] || 0) + 1;
const seen = {}; for (const o of order) o.k = (seen[o.t] = (seen[o.t] || 0) + 1) / cnt[o.t];
order.sort((a, b) => a.k - b.k || a.id.localeCompare(b.id));
const miss = order.filter((o) => !scenes[o.id]);
if (miss.length) throw new Error("scene 없는 id: " + miss.map((o) => o.id).join(","));
fs.writeFileSync(path.join(__dirname, "scenes.json"), JSON.stringify(Object.fromEntries(order.map((o) => [o.id, scenes[o.id]])), null, 0).replace(/","/g, '",\n"'));
const n = {}; for (const q of daily) n[q.type] = (n[q.type] || 0) + 1;
console.log(`daily ${daily.length} ${JSON.stringify(n)} · weekly ${weekly.length} · 합계 ${daily.length + weekly.length}\n제외 ${skipped.length}건\n` + skipped.join("\n"));
