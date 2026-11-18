// T조 AI 로 글 올리기(운영 서버의 /api/ai-post 로) — 올리면 알림을 켠 모든 팀원에게 폰 알림이 간다.
// 실행: node scripts/post_ai.js <분류> "<제목>" "<본문>"      토큰만 보려면: node scripts/post_ai.js --token
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const root = path.resolve(__dirname, "..");
for (const l of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) { const i = l.indexOf("="); if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const token = crypto.createHmac("sha256", process.env.SESSION_SECRET).update("ai-post-token").digest("base64url");
const [cat, title, body] = process.argv.slice(2);
if (cat === "--token") { console.log(token); process.exit(0); }
if (!cat || !title || !body) { console.error('쓰는 법: node scripts/post_ai.js <분류> "<제목>" "<본문>"'); process.exit(1); }
fetch((process.env.SITE || "https://t-niping.vercel.app") + "/api/ai-post", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ category: cat, title, body }) })
  .then(async (r) => { console.log(r.status, await r.text()); });
