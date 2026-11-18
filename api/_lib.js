// 공용: DB·R2 연결, 세션 쿠키, 비밀번호 해시. 파일명이 _ 로 시작해 Vercel 이 라우트로 노출하지 않는다.
const crypto = require("crypto");
const { promisify } = require("util");
const mysql = require("mysql2/promise");
const { S3Client } = require("@aws-sdk/client-s3");

const env = process.env;
const scrypt = promisify(crypto.scrypt);

let pool, s3;
const db = () => (pool ??= mysql.createPool({
  host: env.TIDB_HOST, port: Number(env.TIDB_PORT), user: env.TIDB_USER, password: env.TIDB_PASSWORD,
  database: env.TIDB_DATABASE, ssl: { minVersion: "TLSv1.2" }, connectionLimit: 2, charset: "utf8mb4",
  timezone: "Z", // TiDB 는 UTC 로 시각을 돌려준다 — 서버(Vercel=UTC)나 내 PC(KST)나 같게 해석하도록 고정
}));
const r2 = () => (s3 ??= new S3Client({
  region: "auto", endpoint: env.R2_ENDPOINT,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
}));

const json = (res, code, obj) => { res.statusCode = code; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(obj)); };
// 상태를 바꾸는 요청은 JSON 만 받는다 — 다른 사이트의 <form> 전송(CSRF)을 막는 두 번째 방어선(첫째는 SameSite=Lax).
const isJson = (req) => /^application\/json/i.test(req.headers["content-type"] || "");
const readBody = (req) => (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

// 비밀번호: scrypt (salt 16B). 형식 s1$salt$hash
async function hashPw(pw) { const salt = crypto.randomBytes(16); const h = await scrypt(pw, salt, 64); return `s1$${salt.toString("base64")}$${h.toString("base64")}`; }
async function checkPw(pw, stored) {
  const [v, s, h] = String(stored || "").split("$");
  if (v !== "s1" || !s || !h) return false;
  return crypto.timingSafeEqual(await scrypt(pw, Buffer.from(s, "base64"), 64), Buffer.from(h, "base64"));
}

// 세션: base64url(JSON{uid,exp}).HMAC — DB 조회 없이 위조를 막고, 사용자 정보는 요청마다 DB 에서 읽는다.
const mac = (body) => crypto.createHmac("sha256", env.SESSION_SECRET).update(body).digest("base64url");
const parseCookies = (req) => Object.fromEntries((req.headers.cookie || "").split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
function readSession(req) {
  const [body, sig] = (parseCookies(req).tt_s || "").split(".");
  if (!body || !sig || !same(sig, mac(body))) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url")); return p.exp > Date.now() ? p : null; } catch { return null; }
}
const secure = (req) => req.headers["x-forwarded-proto"] === "https" || !!env.VERCEL;
function setSession(req, res, uid) {
  const body = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 30 * 864e5 })).toString("base64url");
  res.setHeader("Set-Cookie", `tt_s=${body}.${mac(body)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${30 * 86400}${secure(req) ? "; Secure" : ""}`);
}
const clearSession = (req, res) => res.setHeader("Set-Cookie", `tt_s=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure(req) ? "; Secure" : ""}`);

async function currentUser(req) {
  const s = readSession(req); if (!s) return null;
  const [rows] = await db().query("SELECT id, email, nickname, bio, photo_v, cover_v, presenter FROM users WHERE id = ?", [s.uid]);
  return rows[0] || null;
}
const photoUrl = (u) => (u.photo_v > 0 ? `/api/photo?u=${u.id}&v=${u.photo_v}` : null);
const coverUrl = (u) => (u.cover_v > 0 ? `/api/photo?u=${u.id}&k=cover&v=${u.cover_v}` : null);
const publicUser = (u) => ({ id: u.id, email: u.email, nickname: u.nickname, bio: u.bio || "", photoUrl: photoUrl(u), coverUrl: coverUrl(u), presenter: !!u.presenter });
const len = (s) => [...String(s)].length; // 이모지도 1글자로 센다

// 초대장 정책 — 숫자 하나로 조정한다
const INVITE_DAYS = 7;       // 만들고 나서 이 기간 안에 써야 한다
const INVITE_MAX_ACTIVE = 3; // 한 사람이 동시에 가질 수 있는 쓰지 않은 초대장 수
const CATS = ["채용", "온보딩", "조직문화", "평가·보상", "교육", "커리어", "자유"]; // 아티클 분류
const normCode = (c) => String(c || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

module.exports = { env, db, r2, json, isJson, readBody, same, hashPw, checkPw, setSession, clearSession, currentUser, publicUser, photoUrl, coverUrl, len, CATS, INVITE_DAYS, INVITE_MAX_ACTIVE, normCode };
