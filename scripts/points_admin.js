// 포인트 운영 도구(실제 TiDB 에 붙는다 — .env).
//   node scripts/points_admin.js show                       → 올해·누적 점수표
//   node scripts/points_admin.js backfill [--apply]         → 이미 올라와 있던 «오늘의 질문 답변»의 빠진 점수 채우기(기본은 목록만, --apply 로 기록)
//   node scripts/points_admin.js settle <토론글번호> [닉네임 ...] → 주간 토론 정산을 다시(없던 것만 적립, 닉네임 = 핵심 역할 가산점 대상)
// 같은 일로 두 번 적립되지 않으니(유니크 키) 여러 번 돌려도 안전하다.
const fs = require("fs"), path = require("path");
for (const l of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) { const i = l.indexOf("="); if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const L = require("../api/_lib");
const P = require("../api/_points");

(async () => {
  const db = L.db(), [cmd, a, ...rest] = process.argv.slice(2);
  if (cmd === "show") {
    const [rows] = await db.query("SELECT u.nickname, COALESCE(SUM(CASE WHEN t.yr = ? THEN t.pts END), 0) AS yr_pts, COALESCE(SUM(t.pts), 0) AS total FROM users u LEFT JOIN points t ON t.user_id = u.id GROUP BY u.id, u.nickname ORDER BY yr_pts DESC, total DESC", [P.year()]);
    console.table(rows.map((r) => ({ 닉네임: r.nickname, [`${P.year()}년`]: Number(r.yr_pts), 누적: Number(r.total) })));
  } else if (cmd === "backfill") {
    const out = await P.backfillDaily(db, a !== "--apply");
    console.log(a === "--apply" ? "적립함:" : "적립할 것(목록만, --apply 로 기록):", out);
  } else if (cmd === "settle") {
    const [[post]] = await db.query("SELECT id, title, kind, stage FROM posts WHERE id = ?", [Number(a)]);
    if (!post || post.kind !== "weekly") throw new Error("주간 토론 글 번호가 아니에요.");
    console.log(await P.settleWeek(db, post, rest.map((n) => ({ nickname: n, reason: "" }))));
  } else console.log("show | backfill [--apply] | settle <글번호> [닉네임…]");
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
