// 로컬 확인용: 페이지(/·/articles·/team·/me·/join), assets/, api/*.js 를 Vercel 처럼 붙여서 띄운다.
// 실행: node scripts/dev.js  (.env 필요, 포트 8791)
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
for (const l of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) { const i = l.indexOf("="); if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const TYPES = { ".webmanifest": "application/manifest+json", ".png": "image/png", ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const api = /^\/api\/([a-z-]+)$/.exec(u.pathname);
  if (api && fs.existsSync(path.join(root, "api", api[1] + ".js"))) {
    req.query = Object.fromEntries(u.searchParams);
    let raw = ""; for await (const c of req) raw += c;
    req.body = raw && /json/.test(req.headers["content-type"] || "") ? JSON.parse(raw) : raw;
    return require(path.join(root, "api", api[1] + ".js"))(req, res);
  }
  // cleanUrls: /me → me.html, / → index.html
  const rel = u.pathname === "/" ? "index.html" : u.pathname.replace(/^\/+/, "");
  const file = [rel, rel + ".html"].map((r) => path.join(root, r)).find((f) => f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile() && !/\.(env|json)$/.test(f) && !/node_modules|\.git/.test(f));
  if (!file) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
  res.end(fs.readFileSync(file));
}).listen(8791, "127.0.0.1", () => console.log("dev http://127.0.0.1:8791"));
