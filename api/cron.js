// 크론 문 — Vercel 크론이 부른다(vercel.json 의 crons). 사람이 직접 부르는 주소가 아니다.
//   GET /api/cron?job=daily  → 평일 09:30(KST): 이번 주 토론(그 주의 첫 영업일) + 오늘의 질문(지목) 만들기. 주말·공휴일은 건너뜀(api/_holidays.js)
//   GET /api/cron?job=domain → 매일 09:00(KST): 도메인 만료 30일 전부터 운영자 한 사람에게 하루 한 번 알림(api/_notice.js)
//   GET /api/cron?job=wrap   → 주간 토론이 100% 면 Claude 가 요약·반문·아티클 정리 (+ 9시 30분 이후 오늘 질문이 없으면 만들기)
// 인증: CRON_SECRET 환경변수와 Vercel 이 자동으로 보내는 Authorization: Bearer 가 맞아야 한다. Vercel 위에서 CRON_SECRET 이 없으면 아무도 못 부른다
// (사용자 에이전트 문자열은 누구나 위조할 수 있어 믿지 않는다 — 코드가 공개돼도 안전하도록). 로컬(VERCEL 없음)에서만 인증 없이 부를 수 있다.
// 어느 단계든 같은 날·같은 상태에서 여러 번 불려도 한 번만 일하도록 만들어 뒀다(api/_routine.js).
const L = require("./_lib");
const R = require("./_routine");

module.exports = async (req, res) => {
  try {
    const sec = process.env.CRON_SECRET;
    const ok = sec ? req.headers.authorization === `Bearer ${sec}` : !process.env.VERCEL;
    if (!ok) return L.json(res, 401, { error: "허용되지 않은 요청이에요." });
    const job = req.query.job, db = L.db(), t0 = Date.now();
    // 부를 때마다 한 줄 남긴다(Vercel 이 정말 부르는지 확인용). 요약만, 2주가 지난 기록은 지운다.
    const log = async (out) => { try { await db.query("INSERT INTO cron_runs (job, note) VALUES (?, ?)", [String(job).slice(0, 10), JSON.stringify(out, (k, v) => (k === "title" ? undefined : k === "push" ? (v && v.users !== undefined ? `알림 ${v.sent}건 보냄/${v.users}명${v.failed ? ` 실패${v.failed}` : ""}` : v && v.error ? `알림 오류: ${v.error}` : undefined) : v)).slice(0, 290)]); await db.query("DELETE FROM cron_runs WHERE ran_at < DATE_SUB(NOW(), INTERVAL 14 DAY)"); } catch (e) { console.error("cron log", e.message); } };
    if (job === "daily") {
      const k = R.kstNow(), out = {};
      out.weekly = await R.makeWeekly(db);   // 그 주의 첫 영업일이 아니면 알아서 건너뛴다
      out.daily = await R.makeDaily(db);
      await log(out);
      return L.json(res, 200, out);
    }
    if (job === "wrap") {
      // 5분마다 도는 이 작업이 «오늘 아침 질문이 아직 없으면 만들기»도 맡는다(아침 크론이 빠져도 늦게라도 올라오도록). 한국 시각 9시 30분 이후에만.
      const k = R.kstNow(), out = {};
      if (k.getUTCHours() * 60 + k.getUTCMinutes() >= 9 * 60 + 30) { out.weekly = await R.makeWeekly(db); out.daily = await R.makeDaily(db); }
      // 일력 카드는 «그날 첫 방문자가 만들 때까지 기다리게» 두지 않는다 — 오늘 것과 내일 것을 미리 만들어 둔다(없을 때만 만들고, 있으면 SELECT 한 번뿐).
      // 예전엔 자정 뒤 첫 방문자가 Claude 가 문장을 쓰는 몇 초~십수 초를 로딩 화면에서 기다렸다.
      try { const I = require("./_ilryeok"); out.card = { today: (await I.ensure(db, I.kstDate())).source, tomorrow: (await I.ensure(db, I.kstDate(new Date(Date.now() + 864e5)))).source }; } catch (e) { out.card = "실패"; console.error("cron card", e.message); }
      out.wrap = await R.wrap(db);
      // 미드핑의 «반응·후기 탐색»(사람이 올린 글에 가끔 댓글): 정리에 시간을 많이 썼으면(50초 넘게) 이번 차례는 건너뛴다
      if (Date.now() - t0 < 50000) { try { out.react = await require("./_reactor").tick(db); } catch (e) { out.react = { error: e.message }; console.error("react", e); } }
      await log(out);
      return L.json(res, 200, out);
    }
    if (job === "domain") {   // 매일 09:00(KST, 주말 포함): 도메인 만료 30일 전부터 만료일까지 운영자에게 하루 한 번 알림(api/_notice.js)
      const out = await require("./_notice").domainExpiry(db);
      if (!out.skip) await log(out);
      return L.json(res, 200, out);
    }
    return L.json(res, 400, { error: "job 은 daily, wrap, domain 중 하나예요." });
  } catch (e) {
    console.error("cron", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다." });
  }
};
