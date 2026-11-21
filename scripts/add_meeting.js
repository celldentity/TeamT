// 회의록을 DB(meetings)에 넣는다. 같은 시작 시각의 회의록이 이미 있으면 덮어쓴다.
// 실행: node scripts/add_meeting.js <회의록 JSON 파일 경로>   (JSON 은 저장소 밖에 둔다)
// JSON 모양: {title, heldAt(ISO, UTC), durationS, summary:{…}, transcript:[{s,e,sp,t}]}  — 회의 내용은 저장소가 아니라 DB 에만 둔다.
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
for (const l of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) { const i = l.indexOf("="); if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const L = require("../api/_lib");
const file = process.argv[2];
if (!file) { console.error('쓰는 법: node scripts/add_meeting.js "<회의록.json>"'); process.exit(1); }
(async () => {
  const m = JSON.parse(fs.readFileSync(file, "utf8")), db = L.db();
  const held = new Date(m.heldAt);
  if (!m.title || isNaN(held) || !m.summary || !Array.isArray(m.transcript)) throw new Error("JSON 모양이 맞지 않아요.");
  await db.query("DELETE FROM meetings WHERE held_at = ?", [held]);
  const [r] = await db.query("INSERT INTO meetings (title, held_at, duration_s, summary, transcript) VALUES (?, ?, ?, ?, ?)",
    [m.title, held, Math.round(m.durationS || 0), JSON.stringify(m.summary), JSON.stringify(m.transcript)]);
  console.log(`회의록 #${r.insertId} 저장: ${m.title} (전사 ${m.transcript.length}줄, 요약 ${Math.round(JSON.stringify(m.summary).length / 1024)}KB)`);
  process.exit(0);
})().catch((e) => { console.error("오류", e.message); process.exit(1); });
