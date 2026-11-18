// 한국 공휴일(대체공휴일·선거일 포함). 오늘의 질문·이번 주 토론이 «주말과 공휴일에는 쉬도록» 하는 데만 쓴다. 파일명이 _ 로 시작해 라우트로 노출되지 않는다.
// 출처: 한국천문연구원 «월력요항» 안내 페이지의 «국경일과 공휴일» 표(2026·2027 모두 확인, 2026-11-19). 두 페이지 모두 «공식 고시는 월력요항»이라고 밝히고 있다.
// 판단한 것: ① 2026-05-01 노동절은 2026 표에 공휴일로 없다(근로자의 날로만 표기) → 평일로 본다. ② 제헌절(7/17)은 표에 있고 2027 에 대체공휴일(7/19)이 붙어 공휴일로 보며 2026-07-17 도 쉰다.
//   ③ 2026-06-03 전국동시지방선거는 표에 있어 쉰다.
// ⚠ 2028 년 이후는 표가 없다 — 2027 년 말 전에 이 파일에 다음 해를 추가할 것(없으면 주말만 쉬고, cron 기록에 «공휴일 정보 없음»이 남는다).
const H = {
  2026: ["01-01", "02-16", "02-17", "02-18", "03-01", "03-02", "05-05", "05-24", "05-25", "06-03", "06-06", "07-17", "08-15", "08-17", "09-24", "09-25", "09-26", "10-03", "10-05", "10-09", "12-25"],
  2027: ["01-01", "02-06", "02-07", "02-08", "02-09", "03-01", "05-01", "05-03", "05-05", "05-13", "06-06", "07-17", "07-19", "08-15", "08-16", "09-14", "09-15", "09-16", "10-03", "10-04", "10-09", "10-11", "12-25", "12-27"],
};
const SETS = Object.fromEntries(Object.entries(H).map(([y, a]) => [y, new Set(a.map((d) => `${y}-${d}`))]));

const covered = (ymd) => !!SETS[ymd.slice(0, 4)];
const isHoliday = (ymd) => !!SETS[ymd.slice(0, 4)] && SETS[ymd.slice(0, 4)].has(ymd);
const dow = (ymd) => new Date(ymd + "T00:00:00Z").getUTCDay();   // 0 = 일요일
const isWeekend = (ymd) => dow(ymd) === 0 || dow(ymd) === 6;
const isBusinessDay = (ymd) => !isWeekend(ymd) && !isHoliday(ymd);
const addDays = (ymd, n) => new Date(new Date(ymd + "T00:00:00Z").getTime() + n * 864e5).toISOString().slice(0, 10);
const mondayOf = (ymd) => addDays(ymd, -((dow(ymd) + 6) % 7));
// 그 주(월요일 기준)에서 오늘이 «첫 영업일»인가 — 월요일이 공휴일이면 화요일이 첫 영업일
const isFirstBusinessDay = (ymd) => { if (!isBusinessDay(ymd)) return false; for (let d = mondayOf(ymd); d < ymd; d = addDays(d, 1)) if (isBusinessDay(d)) return false; return true; };

module.exports = { covered, isHoliday, isWeekend, isBusinessDay, isFirstBusinessDay, mondayOf, addDays, dow };
