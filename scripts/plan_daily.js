// 어느 날의 «오늘의 질문»을 미리 정해 둔다(그날 한국 시각 09:00 크론이 이대로 올리고 지목된 사람에게 푸시한다).
// 실행: node scripts/plan_daily.js 2026-11-19 [--user 닉네임] [--cat 커리어] --q "질문" [--body "배경 설명"]
//   --user 를 빼면 «이번 주에 안 걸린 사람 중 가장 오래 안 걸린 사람»을 자동으로 뽑는다(api/_routine.js pickMember).
//   이미 그날 질문 글이 올라갔다면 바꿀 수 없다. 예약만 지우려면 --clear.
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
for (const l of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) { const i = l.indexOf("="); if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const L = require("../api/_lib"), R = require("../api/_routine");
const a = process.argv.slice(2), date = a.shift(), flag = (n) => { const i = a.indexOf("--" + n); return i >= 0 ? a[i + 1] : undefined; };
(async () => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("날짜를 YYYY-MM-DD 로 적어 주세요.");
  const db = L.db(), [ex] = await db.query("SELECT id FROM posts WHERE kind = 'daily' AND qdate = ?", [date]);
  if (ex[0]) throw new Error(`그날 질문이 이미 올라가 있어요(글 #${ex[0].id}).`);
  if (a.includes("--clear")) { await db.query("DELETE FROM daily_plan WHERE qdate = ?", [date]); console.log("예약을 지웠어요."); return; }
  const u = flag("user");
  let who;
  if (u) { [[who]] = await db.query("SELECT id, nickname FROM users WHERE nickname = ? OR id = ?", [u, Number(u) || 0]); if (!who) throw new Error("그런 가입자가 없어요."); }
  else who = await R.pickMember(db, date);
  if (!who) throw new Error("가입자가 없어요.");
  const title = flag("q"), body = flag("body") || "편하게 3~5문장으로 답해 주세요. 정답은 없어요.", category = flag("cat") || "자유";
  if (!title || L.len(title) < 2 || L.len(title) > 80) throw new Error('--q "질문"(2~80자)이 필요해요.');
  if (!L.CATS.includes(category)) throw new Error("분류는 " + L.CATS.join("/") + " 중 하나예요.");
  const [[sub]] = await db.query("SELECT COUNT(*) AS n FROM push_subs WHERE user_id = ?", [who.id]);
  await db.query("REPLACE INTO daily_plan (qdate, target_id, category, title, body) VALUES (?, ?, ?, ?, ?)", [date, who.id, category, title, body]);
  console.log(`예약 완료 — ${date} 한국 시각 09:00 · 지목: ${who.nickname} · 폰 알림 ${sub.n ? "켜져 있음(" + sub.n + "대)" : "꺼져 있음(알림이 안 울려요!)"}\n질문: ${title}`);
  process.exit(0);
})().catch((e) => { console.error("오류:", e.message); process.exit(1); });
