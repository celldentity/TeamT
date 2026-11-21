// 질문 일러스트를 R2 qimg/ 에 올린다 — node scripts/qimg/upload_qimg.js [--check]
// (환경변수 QIMG_DIR 폴더, 없으면 .cache/teamt-qimg)의 <id>.jpg·<id>.t.jpg → 버킷 teamt 의 qimg/<id>.jpg·qimg/<id>.t.jpg. 이미 같은 크기로 있으면 건너뛰므로 몇 번이고 다시 돌려도 된다.
// --check : 올리지 않고 올라간 개수만 센다. 런타임 키(.env, teamt 버킷 한정)를 쓴다 — 값은 화면에 찍지 않는다.
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "../..");
for (const l of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) { const i = l.indexOf("="); if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim(); }
const L = require("../../api/_lib");
const { PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const DIR = process.env.QIMG_DIR || path.join(root, ".cache/teamt-qimg"), check = process.argv.includes("--check");
(async () => {
  const files = fs.readdirSync(DIR).filter((f) => /^[dw]\d+(\.t)?\.jpg$/.test(f)).sort();
  let up = 0, same = 0, miss = 0, i = 0;
  const one = async (f) => {
    const Key = "qimg/" + f, body = fs.readFileSync(path.join(DIR, f));
    const h = await L.r2().send(new HeadObjectCommand({ Bucket: L.env.R2_BUCKET, Key })).catch(() => null);
    if (h && h.ContentLength === body.length) return same++;
    if (check) return miss++;
    await L.r2().send(new PutObjectCommand({ Bucket: L.env.R2_BUCKET, Key, Body: body, ContentType: "image/jpeg", CacheControl: "private, max-age=31536000" }));
    up++;
  };
  await Promise.all(Array.from({ length: 6 }, async () => { while (i < files.length) await one(files[i++]); }));
  console.log(`파일 ${files.length}개 — 새로 올림 ${up} · 이미 있음 ${same}` + (check ? ` · 아직 안 올라감 ${miss}` : ""));
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
