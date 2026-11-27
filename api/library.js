// 자료실 API — 로그인한 사람만. 유튜브·인스타그램·스레드 링크를 붙여넣으면 미리보기 카드가 만들어진다.
//   GET    /api/library             → 최신순 목록(최대 100) — 올린 사람·시각·제목·원작성자·미리보기 여부
//   GET    /api/library?img=N       → 미리보기 이미지(R2 의 비공개 파일을 1시간짜리 서명 주소로 302)
//   POST   /api/library {url,cid?}  → 링크 추가(같은 글이 이미 있으면 {id, dup:true}). 제목·이미지는 서버가 가져온다.
//   DELETE /api/library?id=N        → 올린 사람만 지운다
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const L = require("./_lib");
const O = require("./_oembed");

const key = (id) => `library/${id}.jpg`;
const bucket = () => process.env.R2_BUCKET || L.env.R2_BUCKET;
const shape = (r, me) => ({
  id: r.id, platform: r.platform, extId: r.ext_id, url: r.url, title: r.title, author: r.author, thumb: !!r.has_thumb,
  by: { id: r.user_id, nickname: r.nickname, photoUrl: L.photoUrl({ id: r.user_id, photo_v: r.photo_v }) }, createdAt: r.created_at, mine: r.user_id === me.id,
});
const SELECT = "SELECT l.id, l.user_id, l.platform, l.ext_id, l.url, l.title, l.author, l.has_thumb, l.created_at, u.nickname, u.photo_v FROM library l JOIN users u ON u.id = l.user_id";

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    const db = L.db();

    if (req.method === "GET") {
      // 하단 «자료실» 새 링크 숫자: ?count=1&after=<이전에 받은 now> → 그 뒤에 남이 올린 링크 수와 지금 DB 시각(now). after 가 없으면 0(처음 쓰는 기기는 지금까지의 것을 «본 것» 으로 시작).
      if (req.query.count) {
        const [[t]] = await db.query("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS now"), after = String(req.query.after || "");
        if (!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(after)) return L.json(res, 200, { count: 0, now: t.now });
        const [[c]] = await db.query("SELECT COUNT(*) AS n FROM library WHERE created_at > ? AND user_id <> ?", [after, me.id]);
        return L.json(res, 200, { count: Number(c.n), now: t.now });
      }
      if (req.query.img) {
        const id = Number(req.query.img); if (!Number.isInteger(id) || id < 1) return L.json(res, 400, { error: "잘못된 요청입니다." });
        const url = await getSignedUrl(L.r2(), new GetObjectCommand({ Bucket: bucket(), Key: key(id) }), { expiresIn: 3600 });
        res.statusCode = 302; res.setHeader("Location", url); res.setHeader("Cache-Control", "private, max-age=1800"); return res.end();
      }
      const [rows] = await db.query(`${SELECT} ORDER BY l.id DESC LIMIT 100`);
      return L.json(res, 200, { items: rows.map((r) => shape(r, me)) });
    }

    if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });

    if (req.method === "POST") {
      const p = O.parse(L.readBody(req).url);
      if (!p) return L.json(res, 400, { error: "유튜브·인스타그램·스레드의 게시물 링크만 붙여넣을 수 있어요." });
      const [ex] = await db.query("SELECT id FROM library WHERE platform = ? AND ext_id = ?", [p.platform, p.extId]);
      if (ex[0]) return L.json(res, 200, { id: ex[0].id, dup: true });
      let m = { title: "", author: "", thumbs: [] }, img = null;
      try { m = await O.meta(p); img = m.thumbs.length ? await O.thumb(m.thumbs) : null; } catch (e) { console.error("library meta", e.message); }   // 못 가져와도 링크 카드는 만든다
      let r;
      try { [r] = await db.query("INSERT INTO library (user_id, platform, ext_id, url, title, author, has_thumb) VALUES (?, ?, ?, ?, ?, ?, ?)", [me.id, p.platform, p.extId, p.url, m.title, m.author, img ? 1 : 0]); }
      catch (e) { if (e.code === "ER_DUP_ENTRY") { const [d] = await db.query("SELECT id FROM library WHERE platform = ? AND ext_id = ?", [p.platform, p.extId]); if (d[0]) return L.json(res, 200, { id: d[0].id, dup: true }); } throw e; }
      if (img) { try { await L.r2().send(new PutObjectCommand({ Bucket: bucket(), Key: key(r.insertId), Body: img.buf, ContentType: img.type })); } catch (e) { console.error("library thumb put", e.message); await db.query("UPDATE library SET has_thumb = 0 WHERE id = ?", [r.insertId]); } }
      return L.json(res, 201, { id: r.insertId });
    }

    if (req.method === "DELETE") {
      const id = Number(req.query.id); if (!Number.isInteger(id) || id < 1) return L.json(res, 400, { error: "잘못된 요청입니다." });
      const [rows] = await db.query("SELECT user_id FROM library WHERE id = ?", [id]);
      if (!rows[0]) return L.json(res, 404, { error: "이미 지워졌어요." });
      if (rows[0].user_id !== me.id) return L.json(res, 403, { error: "내가 올린 것만 지울 수 있어요." });
      await db.query("DELETE FROM library WHERE id = ?", [id]);
      await L.r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key(id) })).catch((e) => console.error("library thumb del", e.message));
      return L.json(res, 200, { ok: true });
    }
    return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
  } catch (e) {
    console.error("library", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
