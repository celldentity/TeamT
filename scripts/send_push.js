// 운영용 알림 보내기 — 알림을 켠 팀원에게 직접 보낸다(서버·로그인 없이 DB·웹푸시 키로).
// 실행: node scripts/send_push.js "<제목>" "<내용>" [주소=/] [--user <id>]     예) node scripts/send_push.js "안녕하세요 티니핑 여러분" "알림 테스트입니다."
// 받는 사람 수를 먼저 보여 주고 보낸다. 앱 아이콘 숫자는 건드리지 않는다.
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
for (const l of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) { const i = l.indexOf("="); if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const L = require("../api/_lib"), P = require("../api/_push");
const a = process.argv.slice(2), ui = a.indexOf("--user"), only = ui >= 0 ? Number(a.splice(ui, 2)[1]) : 0;
const [title, body, url] = a;
if (!title || !body) { console.error('쓰는 법: node scripts/send_push.js "<제목>" "<내용>" [주소] [--user <id>]'); process.exit(1); }
(async () => {
  const [[c]] = await L.db().query("SELECT COUNT(DISTINCT user_id) AS users, COUNT(*) AS subs FROM push_subs" + (only ? " WHERE user_id = ?" : ""), only ? [only] : []);
  console.log(`알림을 켠 팀원 ${c.users}명(기기 ${c.subs}대)에게 보냅니다 — "${title}" / "${body}"`);
  const r = await P.notify(only ? [only] : null, () => ({ title, body, url: url || "/", tag: "broadcast-" + Date.now() }));
  console.log(`결과: 보냄 ${r.sent}대 · 실패 ${r.failed}대 (받는 사람 ${r.users}명)`);
  process.exit(0);
})().catch((e) => { console.error("오류", e.message); process.exit(1); });
