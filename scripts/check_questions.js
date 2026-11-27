// 질문 은행 점검 — node scripts/check_questions.js  (실패하면 종료 코드 1)
// 중복(제목·같은 문장) · 길이(제목 2~80자, 본문 비어 있지 않음, 토론 본문 ≤ 3000자) · 분류 · 민감한 소재 · 종류별 개수 · 그림 장면(id 별).
const Q = require("../api/_qbank");
const L = require("../api/_lib");
const len = (s) => [...String(s)].length;
const bad = [], note = (m) => bad.push(m);
const SENSITIVE = ["몇 살", "나이", "결혼", "이혼", "종교", "정당", "대통령", "임신", "질병", "우울", "가족", "부모님"];   // 연봉·월급 은 보상 «제도» 질문에 쓰인다(내 연봉이 얼마 같은 구체적 액수는 질문 검수에서 거른다)
const TYPES = { HR: 36, 커리어: 18, 상식: 18, 일상: 18 };   // 3개월치(2026-11-26): 요일마다 한 번씩 쓰이므로 종류별 최소 개수(요일 주기로 18주 = 오늘의 질문 90개)

const scenes = require("./qimg/scenes.json");   // 질문마다 일러스트 장면(영어)이 있어야 한다
const ids = new Set();
const seen = new Map();
for (const [kind, list] of [["daily", Q.DAILY], ["weekly", Q.WEEKLY]]) {
  for (const q of list) {
    if (ids.has(q.id)) note(`id 중복: ${q.id}`); ids.add(q.id);
    if (!scenes[q.id]) note(`그림 장면(scenes.json)이 없어요: ${q.id} ${q.title}`);
    const key = q.title.replace(/\s+/g, "");
    if (seen.has(key)) note(`중복: ${q.title}`); seen.set(key, 1);
    if (len(q.title) < 2 || len(q.title) > 80) note(`제목 길이 ${len(q.title)}: ${q.title}`);
    if (!q.body || len(q.body) < 10) note(`본문이 짧아요: ${q.title}`);
    if (kind === "weekly" && len(q.body) > 3000) note(`토론 본문이 너무 길어요(${len(q.body)}): ${q.title}`);
    if (!L.CATS.includes(q.category)) note(`분류 오류(${q.category}): ${q.title}`);
    if (!/[?？]$/.test(q.title) && !/(주세요|세요|까요|나요|요)[.?]?$/.test(q.title)) note(`질문 어미가 아닌 듯해요: ${q.title}`);
    if (kind === "daily") {
      if (!TYPES[q.type]) note(`종류 오류(${q.type}): ${q.title}`);
      for (const w of SENSITIVE) if ((q.title + q.body).replace(/정당(한|성|화)/g, "").includes(w)) note(`민감어 «${w}»: ${q.title}`);   // «정당한 거부» 같은 쓰임은 정치 얘기가 아니다
    }
  }
}
const n = {}; for (const q of Q.DAILY) n[q.type] = (n[q.type] || 0) + 1;
for (const [t, min] of Object.entries(TYPES)) if ((n[t] || 0) < min) note(`${t} 질문이 ${n[t] || 0}개뿐이에요(최소 ${min})`);

console.log(`오늘의 질문 ${Q.DAILY.length}개 ${JSON.stringify(n)} · 이번 주 토론 ${Q.WEEKLY.length}개`);
if (bad.length) { console.log("\n문제 " + bad.length + "건\n- " + bad.join("\n- ")); process.exit(1); }
console.log("문제 없음");
