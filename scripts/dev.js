// 로컬 확인용: index.html 과 api/*.js 를 Vercel 처럼 붙여서 띄운다. 실행: node scripts/dev.js  (.env 필요, 포트 8791)
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
for (const l of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) { const i = l.indexOf("="); if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const m = /^\/api\/([a-z]+)$/.exec(u.pathname);
  if (m && fs.existsSync(path.join(root, "api", m[1] + ".js"))) {
    req.query = Object.fromEntries(u.searchParams);
    let raw = ""; for await (const c of req) raw += c;
    req.body = raw && /json/.test(req.headers["content-type"] || "") ? JSON.parse(raw) : raw;
    return require(path.join(root, "api", m[1] + ".js"))(req, res);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(fs.readFileSync(path.join(root, "index.html")));
}).listen(8791, "127.0.0.1", () => console.log("dev http://127.0.0.1:8791"));
