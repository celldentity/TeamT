// 회의록의 «참석자 C/D/E» 같은 발언자 이름을 정한다.
// 실행: node scripts/set_speakers.js <회의록 번호> C=이름 D=이름 E=이름      (이름을 비우려면 C=)
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
for (const l of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) { const i = l.indexOf("="); if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const L = require("../api/_lib");
const [id, ...pairs] = process.argv.slice(2);
if (!Number(id) || !pairs.length) { console.error("쓰는 법: node scripts/set_speakers.js <회의록 번호> C=이름 D=이름 …"); process.exit(1); }
(async () => {
  const db = L.db(), [rows] = await db.query("SELECT summary FROM meetings WHERE id = ?", [Number(id)]);
  if (!rows[0]) throw new Error("그 번호의 회의록이 없어요.");
  const s = JSON.parse(rows[0].summary);
  for (const p of pairs) {
    const [k, ...v] = p.split("="), name = v.join("=").trim(), sp = s.speakers.find((x) => x.key === k);
    if (!sp) { console.log(`건너뜀: 발언자 ${k} 없음`); continue; }
    sp.name = name || "참석자 " + k; sp.named = !!name; console.log(`${k} → ${sp.name}`);
  }
  await db.query("UPDATE meetings SET summary = ? WHERE id = ?", [JSON.stringify(s), Number(id)]);
  process.exit(0);
})().catch((e) => { console.error("오류", e.message); process.exit(1); });
