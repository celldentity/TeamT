// 질문 일러스트를 글에 붙인다 — R2 qimg/<질문id>.jpg(+ .t.jpg 썸네일)를 media/<새 id>/full·thumb.jpg 로 복사하고 post_media 행을 만든다.
// (글에 사진을 붙이는 기존 구조를 그대로 쓴다: api/media.js 가 읽어 주고 목록 카드·글 보기에 나온다.) 파일명이 _ 로 시작해 라우트로 노출되지 않는다.
// 그림은 못 붙여도 글은 이미 올라가 있다 — 실패하면 로그만 남기고 null 을 돌려준다.
const { CopyObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const L = require("./_lib");
const M = require("./_media");
const Q = require("./_qbank");

const BUCKET = () => L.env.R2_BUCKET;
const W = 768, H = 576;   // scripts/qimg/gen_qimg.py 가 만드는 크기
const head = async (k) => { try { return await L.r2().send(new HeadObjectCommand({ Bucket: BUCKET(), Key: k })); } catch { return null; } };
const copy = (from, to) => L.r2().send(new CopyObjectCommand({ Bucket: BUCKET(), CopySource: `${BUCKET()}/${from}`, Key: to, ContentType: "image/jpeg", MetadataDirective: "REPLACE" }));

// from = {full, thumb(선택)} R2 키. 성공하면 post_media id.
async function attachKeys(db, postId, from, w = W, h = H) {
  const f = await head(from.full);
  if (!f) return null;
  const hasThumb = from.thumb && (await head(from.thumb)) ? 1 : 0;
  const [r] = await db.query("INSERT INTO post_media (post_id, owner_id, kind, mime, size, has_thumb, w, h, pos, status) VALUES (?, 0, 'image', 'image/jpeg', ?, ?, ?, ?, 0, 0)", [postId, f.ContentLength, hasThumb, w, h]);
  const id = r.insertId;
  try {
    await copy(from.full, M.key(id, "full"));
    if (hasThumb) await copy(from.thumb, M.key(id, "thumb"));
    await db.query("UPDATE post_media SET status = 1 WHERE id = ?", [id]);
    return id;
  } catch (e) {
    console.error("qimg copy", e.message);
    await db.query("DELETE FROM post_media WHERE id = ?", [id]).catch(() => {});
    await M.removeFiles([id]);
    return null;
  }
}
const keysOf = (qid) => ({ full: `qimg/${qid}.jpg`, thumb: `qimg/${qid}.t.jpg` });

// 이 질문(q: {title, category, id?})에 맞는 그림을 붙인다. 은행 질문이면 자기 그림, 아니면(Claude 가 즉석에서 만든 질문) 같은 분류의 다른 그림 하나.
async function attachFor(db, postId, q, kind) {
  try {
    const bank = kind === "weekly" ? Q.WEEKLY : Q.DAILY;
    const own = q.id ? bank.find((x) => x.id === q.id) : bank.find((x) => x.title === q.title);
    if (own) { const id = await attachKeys(db, postId, keysOf(own.id)); if (id) return id; }
    // 대신 붙일 그림: 같은 분류(없으면 같은 종류 전체)에서 무작위로, 아직 안 올라온 그림은 건너뛰며 몇 번만 찾는다
    const same = bank.filter((x) => x.category === q.category), pool = same.length ? same : bank;
    for (let i = 0; i < 6; i++) {
      const c = pool[Math.floor(Math.random() * pool.length)];
      const id = await attachKeys(db, postId, keysOf(c.id));
      if (id) return id;
    }
  } catch (e) { console.error("qimg attach", e.message); }
  return null;
}

// 토론을 정리한 글(digest)에는 그 토론 글의 그림을 그대로 붙인다.
async function attachFromPost(db, postId, srcPostId) {
  try {
    const [[m]] = await db.query("SELECT id, w, h FROM post_media WHERE post_id = ? AND status = 1 ORDER BY pos, id LIMIT 1", [srcPostId]);
    if (m) return await attachKeys(db, postId, { full: M.key(m.id, "full"), thumb: M.key(m.id, "thumb") }, m.w, m.h);
  } catch (e) { console.error("qimg digest", e.message); }
  return null;
}

module.exports = { attachFor, attachFromPost };
