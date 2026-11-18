// 질문 은행 점검 — node scripts/check_questions.js  (실패하면 종료 코드 1)
// 중복(제목·같은 문장) · 길이(제목 2~80자, 본문 비어 있지 않음, 토론 본문 ≤ 3000자) · 분류 · 민감한 소재 · 종류별 개수.
const Q = require("../api/_qbank");
const L = require("../api/_lib");
const len = (s) => [...String(s)].length;
const bad = [], note = (m) => bad.push(m);
const SENSITIVE = ["연봉", "월급", "몇 살", "나이", "결혼", "이혼", "종교", "정당", "대통령", "임신", "질병", "우울", "가족", "부모님"];
const TYPES = { HR: 36, 커리어: 20, 상식: 15, 일상: 15 };   // 요일마다 한 번씩 쓰이므로 종류별 최소 개수(요일 주기로 ≥ 15주)

const seen = new Map();
for (const [kind, list] of [["daily", Q.DAILY], ["weekly", Q.WEEKLY]]) {
  for (const q of list) {
    const key = q.title.replace(/\s+/g, "");
    if (seen.has(key)) note(`중복: ${q.title}`); seen.set(key, 1);
    if (len(q.title) < 2 || len(q.title) > 80) note(`제목 길이 ${len(q.title)}: ${q.title}`);
    if (!q.body || len(q.body) < 10) note(`본문이 짧아요: ${q.title}`);
    if (kind === "weekly" && len(q.body) > 3000) note(`토론 본문이 너무 길어요(${len(q.body)}): ${q.title}`);
    if (!L.CATS.includes(q.category)) note(`분류 오류(${q.category}): ${q.title}`);
    if (!/[?？]$/.test(q.title) && !/(주세요|세요|까요|나요|요)[.?]?$/.test(q.title)) note(`질문 어미가 아닌 듯해요: ${q.title}`);
    if (kind === "daily") {
      if (!TYPES[q.type]) note(`종류 오류(${q.type}): ${q.title}`);
      for (const w of SENSITIVE) if ((q.title + q.body).includes(w)) note(`민감어 «${w}»: ${q.title}`);
    }
  }
}
const n = {}; for (const q of Q.DAILY) n[q.type] = (n[q.type] || 0) + 1;
for (const [t, min] of Object.entries(TYPES)) if ((n[t] || 0) < min) note(`${t} 질문이 ${n[t] || 0}개뿐이에요(최소 ${min})`);

console.log(`오늘의 질문 ${Q.DAILY.length}개 ${JSON.stringify(n)} · 이번 주 토론 ${Q.WEEKLY.length}개`);
if (bad.length) { console.log("\n문제 " + bad.length + "건\n- " + bad.join("\n- ")); process.exit(1); }
console.log("문제 없음");
