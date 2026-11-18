// 크론 문 — Vercel 크론이 부른다(vercel.json 의 crons). 사람이 직접 부르는 주소가 아니다.
//   GET /api/cron?job=daily  → 평일 아침: 이번 주 토론(그 주의 첫 영업일) + 오늘의 질문(지목) 만들기. 주말·공휴일은 건너뜀(api/_holidays.js)
//   GET /api/cron?job=wrap   → 주간 토론이 100% 면 Claude 가 요약·반문·아티클 정리 (+ 9시 이후 오늘 질문이 없으면 만들기)
// 인증: CRON_SECRET 환경변수가 있으면 Vercel 이 보내는 Authorization: Bearer 와 맞아야 한다. 없으면 vercel-cron 사용자 에이전트만 받는다.
// 어느 단계든 같은 날·같은 상태에서 여러 번 불려도 한 번만 일하도록 만들어 뒀다(api/_routine.js).
const L = require("./_lib");
const R = require("./_routine");

module.exports = async (req, res) => {
  try {
    const sec = process.env.CRON_SECRET;
    const ok = sec ? req.headers.authorization === `Bearer ${sec}` : (!process.env.VERCEL || /vercel-cron/i.test(req.headers["user-agent"] || ""));
    if (!ok) return L.json(res, 401, { error: "허용되지 않은 요청이에요." });
    const job = req.query.job, db = L.db();
    // 부를 때마다 한 줄 남긴다(Vercel 이 정말 부르는지 확인용). 요약만, 2주가 지난 기록은 지운다.
    const log = async (out) => { try { await db.query("INSERT INTO cron_runs (job, note) VALUES (?, ?)", [String(job).slice(0, 10), JSON.stringify(out, (k, v) => (k === "push" ? undefined : v)).slice(0, 290)]); await db.query("DELETE FROM cron_runs WHERE ran_at < DATE_SUB(NOW(), INTERVAL 14 DAY)"); } catch (e) { console.error("cron log", e.message); } };
    if (job === "daily") {
      const k = R.kstNow(), out = {};
      out.weekly = await R.makeWeekly(db);   // 그 주의 첫 영업일이 아니면 알아서 건너뛴다
      out.daily = await R.makeDaily(db);
      await log(out);
      return L.json(res, 200, out);
    }
    if (job === "wrap") {
      // 5분마다 도는 이 작업이 «오늘 아침 질문이 아직 없으면 만들기»도 맡는다(아침 크론이 빠져도 늦게라도 올라오도록). 한국 시각 9시 이후에만.
      const k = R.kstNow(), out = {};
      if (k.getUTCHours() >= 9) { out.weekly = await R.makeWeekly(db); out.daily = await R.makeDaily(db); }
      out.wrap = await R.wrap(db);
      await log(out);
      return L.json(res, 200, out);
    }
    return L.json(res, 400, { error: "job 은 daily 또는 wrap 이에요." });
  } catch (e) {
    console.error("cron", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다." });
  }
};
