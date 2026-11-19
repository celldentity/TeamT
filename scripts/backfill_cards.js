// HR 일력 지난 장 채우기 — node scripts/backfill_cards.js 2026-01-01 2026-11-18   (시작일 끝일, 둘 다 포함)
// 이미 있는 날은 건너뛴다(daily_cards.qdate 기본키). 여러 날을 한 번에(6일씩) Claude 에게 쓰게 하고, 겹치거나 형식이 틀린 건 버려 모자란 날만 다시 요청한다.
// ANTHROPIC_API_KEY 가 환경에 있어야 한다. 끝까지 못 채운 날은 문구 은행(api/_ilryeok.js BANK)에서 안 쓴 것으로 채운다.
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
for (const l of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) { const i = l.indexOf("="); if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const L = require("../api/_lib"), AI = require("../api/_ai"), I = require("../api/_ilryeok");
const [from, to] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "")) { console.error("사용법: node scripts/backfill_cards.js 시작일 끝일"); process.exit(1); }
const WD = ["일", "월", "화", "수", "목", "금", "토"], len = (s) => [...s].length;
const days = []; for (let d = new Date(from + "T00:00:00Z"); d <= new Date(to + "T00:00:00Z"); d = new Date(d.getTime() + 864e5)) days.push(d.toISOString().slice(0, 10));
const SYS = "당신은 HR 스터디 모임 «T조»의 «HR 일력» 작가입니다. 하루 한 장씩 떼어 보는 일력에 들어갈 글을 한국어로 씁니다. HR·사무직 직장 생활(일하는 방식, 사람, 소통, 성장, 쉼)에 관한 짧은 문장 하나와 해설, 생각해 볼 질문입니다. 책이나 유명인의 문장을 옮기지 말고 전부 직접 새로 쓰세요. 사람 이름·회사 이름·개인정보와 민감한 소재(급여 액수, 나이, 결혼·가족, 종교, 정치, 건강)는 쓰지 않습니다. 날짜마다 서로 다른 주제여야 하고, 그 달의 직장 풍경(새해 목표, 연말정산, 신입 입사, 휴가철, 연말 평가 등)을 가볍게 반영해도 좋지만 억지로 넣지는 마세요. 마크다운 없이 JSON 배열 하나만 출력하세요. 각 원소: {\"date\":\"YYYY-MM-DD\",\"category\":\"일|사람|소통|성장|쉼 중 하나\",\"quote\":\"오늘의 한 줄(15~45자, 마침표로 끝나는 문장)\",\"note\":\"해설 2~3문장(60~140자)\",\"question\":\"생각해 볼 질문 한 줄(40자 이내, 물음표로 끝남)\"}";
const SENS = ["연봉", "월급", "나이", "결혼", "이혼", "종교", "정당", "대통령", "임신", "질병", "우울", "가족"];
const okCard = (c) => I.CATS.includes(c.category) && len(c.quote) >= 8 && len(c.quote) <= 70 && len(c.note) >= 30 && len(c.note) <= 260 && len(c.question) >= 5 && len(c.question) <= 70 && /[?？]$/.test(c.question) && !SENS.some((w) => (c.quote + c.note + c.question).includes(w));

(async () => {
  const db = L.db();
  const [have] = await db.query("SELECT qdate, quote FROM daily_cards"); const done = new Set(have.map((r) => new Date(r.qdate).toISOString().slice(0, 10))), used = new Set(have.map((r) => r.quote));
  let todo = days.filter((d) => !done.has(d)); console.log(`채울 날 ${todo.length}일 (이미 있는 ${days.length - todo.length}일)`);
  const batch = async (ds) => {
    const text = await AI.ask({ system: SYS, max: 4500, timeout: 90000, user: `다음 ${ds.length}일의 카드를 각각 한 장씩 쓰세요(날짜 순서대로, 날짜마다 다른 주제):\n${ds.map((d) => `- ${d} (${WD[new Date(d + "T00:00:00Z").getUTCDay()]}요일)`).join("\n")}\n\n이미 쓴 문장(겹치면 안 됨, 일부):\n${[...used].slice(-25).map((q) => "- " + q).join("\n") || "(없음)"}\n\n설명 없이 JSON 배열만 출력하세요.` });
    const a = text.indexOf("["), b = text.lastIndexOf("]"); if (a < 0 || b <= a) throw new Error("JSON 배열 없음");
    let n = 0;
    for (const c0 of JSON.parse(text.slice(a, b + 1))) {
      const c = { date: String(c0.date || ""), category: String(c0.category || "").trim(), quote: String(c0.quote || "").trim(), note: String(c0.note || "").trim(), question: String(c0.question || "").trim() };
      if (!ds.includes(c.date) || done.has(c.date) || used.has(c.quote) || !okCard(c)) continue;
      try { await db.query("INSERT INTO daily_cards (qdate, category, quote, note, question, source) VALUES (?, ?, ?, ?, ?, 'claude')", [c.date, c.category, c.quote, c.note, c.question]); done.add(c.date); used.add(c.quote); n++; } catch (e) { if (e.code !== "ER_DUP_ENTRY") throw e; }
    }
    return n;
  };
  for (let pass = 1; pass <= 4 && todo.length; pass++) {
    const chunks = []; for (let i = 0; i < todo.length; i += 6) chunks.push(todo.slice(i, i + 6));
    let next = 0, got = 0;
    await Promise.all([0, 1, 2].map(async () => { for (;;) { const ds = chunks[next++]; if (!ds) return; try { const n = await batch(ds); got += n; console.log(`[${pass}차] ${ds[0]}~${ds[ds.length - 1]} → ${n}/${ds.length}장 (누적 ${days.length - todo.length + got})`); } catch (e) { console.error(`[${pass}차] ${ds[0]} 실패: ${e.message}`); } } }));
    todo = days.filter((d) => !done.has(d)); console.log(`${pass}차 끝: 남은 날 ${todo.length}일`);
  }
  if (todo.length) {   // 끝까지 못 채운 날은 문구 은행에서
    const free = I.BANK.filter((b) => !used.has(b.quote)); let k = 0;
    for (const d of todo) { const b = free[k++ % free.length]; await db.query("INSERT IGNORE INTO daily_cards (qdate, category, quote, note, question, source) VALUES (?, ?, ?, ?, ?, 'bank')", [d, b.category, b.quote, b.note, b.question]); console.log("은행으로 채움", d); }
  }
  const [[c]] = await db.query("SELECT COUNT(*) n FROM daily_cards WHERE qdate BETWEEN ? AND ?", [from, to]); console.log(`완료: ${from}~${to} 카드 ${c.n}/${days.length}장`);
  process.exit(0);
})().catch((e) => { console.error("오류", e); process.exit(1); });
