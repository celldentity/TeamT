// 글에 붙이는 사진·동영상 — 로그인한 사람만.
//   POST /api/media?a=init   {kind:"image"|"video", mime, size, w, h, thumbSize?}
//        → {id, full:{url,type}, thumb:{url,type}|null}   브라우저가 이 주소들로 R2 에 PUT 한다(서버를 거치지 않는다)
//   POST /api/media?a=done   {id}      → 다 올렸다고 알림. 크기를 R2 에서 직접 확인하고 {media} 를 돌려준다
//   POST /api/media?a=remove {id}      → 아직 글에 안 붙은 내 파일 지우기
//   GET  /api/media?id=N&v=thumb|full  → 비공개 버킷의 파일로 보내 주는 임시 주소(1시간)로 302. 사진은 <img>, 동영상은 <video> 가 그대로 쓴다
const L = require("./_lib");
const M = require("./_media");

const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

module.exports = async (req, res) => {
  try {
    const me = await L.currentUser(req);
    if (!me) return L.json(res, 401, { error: "로그인이 필요합니다." });
    const db = L.db();

    if (req.method === "GET") {
      const id = Number(req.query.id), v = req.query.v === "thumb" ? "thumb" : "full";
      if (!Number.isInteger(id) || id < 1) return L.json(res, 400, { error: "잘못된 요청입니다." });
      const [rows] = await db.query("SELECT owner_id, status, has_thumb FROM post_media WHERE id = ?", [id]);
      const m = rows[0];
      if (!m || (m.status !== 1 && m.owner_id !== me.id) || (v === "thumb" && !m.has_thumb)) return L.json(res, 404, { error: "파일을 찾을 수 없어요." });
      res.statusCode = 302;
      res.setHeader("Location", await M.getUrl(id, v));
      res.setHeader("Cache-Control", "private, max-age=900");   // 임시 주소는 1시간이라 15분 동안 다시 묻지 않는다
      return res.end();
    }

    if (req.method !== "POST") return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
    if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });
    const a = req.query.a, b = L.readBody(req);

    if (a === "init") {
      const kind = b.kind === "video" ? "video" : b.kind === "image" ? "image" : null;
      const mime = String(b.mime || "").toLowerCase(), size = int(b.size, 1e12), thumbSize = b.thumbSize == null ? 0 : int(b.thumbSize, 1e9);
      const w = int(b.w, 20000), h = int(b.h, 20000);
      if (!kind || size === null || size < 1 || thumbSize === null || w === null || h === null) return L.json(res, 400, { error: "올릴 파일 정보가 올바르지 않아요." });
      if (kind === "image" && mime !== M.IMAGE_MIME) return L.json(res, 400, { error: "사진은 JPG 로 바꿔 올려져요. 다른 사진으로 해 보세요." });
      if (kind === "video" && !M.VIDEO_MIME.has(mime)) return L.json(res, 400, { error: "동영상은 MP4·MOV·WEBM 만 올릴 수 있어요." });
      if (kind === "image" && size > M.MAX_IMAGE) return L.json(res, 400, { error: "사진 용량이 너무 커요." });
      const forComment = b.scope === "comment";   // 댓글에 붙일 파일은 동영상 한도가 100MB
      if (kind === "video" && size > (forComment ? M.C_MAX_VIDEO : M.MAX_VIDEO)) return L.json(res, 400, { error: forComment ? "댓글에는 동영상을 100MB 까지 올릴 수 있어요." : "동영상은 300MB 까지 올릴 수 있어요." });
      if (thumbSize > M.MAX_THUMB) return L.json(res, 400, { error: "썸네일이 너무 커요." });

      // 글에 안 붙은 채 하루 넘게 남은 내 파일은 이때 정리한다(글쓰기를 중간에 그만둔 경우)
      const [stale] = await db.query("SELECT id FROM post_media WHERE owner_id = ? AND post_id IS NULL AND comment_id IS NULL AND created_at < DATE_SUB(NOW(), INTERVAL 1 DAY)", [me.id]);
      if (stale.length) { await db.query("DELETE FROM post_media WHERE id IN (?)", [stale.map((s) => s.id)]); await M.removeFiles(stale.map((s) => s.id)); }
      const [[{ n }]] = await db.query("SELECT COUNT(*) AS n FROM post_media WHERE owner_id = ? AND post_id IS NULL AND comment_id IS NULL", [me.id]);
      if (n >= 30) return L.json(res, 429, { error: "올려 둔 파일이 너무 많아요. 글을 올리거나 지운 뒤 다시 해 주세요." });

      const [r] = await db.query("INSERT INTO post_media (owner_id, kind, mime, size, has_thumb, w, h) VALUES (?, ?, ?, ?, ?, ?, ?)", [me.id, kind, mime, size, thumbSize ? 1 : 0, w, h]);
      const id = r.insertId;
      return L.json(res, 201, {
        id,
        full: { url: await M.putUrl(id, "full", mime, size), type: mime },
        thumb: thumbSize ? { url: await M.putUrl(id, "thumb", "image/jpeg", thumbSize), type: "image/jpeg" } : null,
      });
    }

    const id = Number(b.id);
    if (a === "done" || a === "remove") {
      if (!Number.isInteger(id) || id < 1) return L.json(res, 400, { error: "잘못된 요청입니다." });
      const [rows] = await db.query("SELECT * FROM post_media WHERE id = ? AND owner_id = ?", [id, me.id]);
      const m = rows[0];
      if (!m) return L.json(res, 404, { error: "파일을 찾을 수 없어요." });

      if (a === "remove") {
        if (m.post_id || m.comment_id) return L.json(res, 409, { error: "글·댓글에 붙은 파일은 글이나 댓글을 고쳐서 빼 주세요." });
        await db.query("DELETE FROM post_media WHERE id = ?", [id]); await M.removeFiles([id]);
        return L.json(res, 200, { ok: true });
      }

      // done: R2 에 실제로 올라온 크기를 확인한다. 약속한 크기와 다르거나 한도를 넘으면 파일을 지운다(서명 주소를 받아 간 뒤 다른 파일을 올린 경우).
      const f = await M.head(id, "full"), t = m.has_thumb ? await M.head(id, "thumb") : true;
      if (!f || !t) return L.json(res, 409, { error: "올리기가 아직 끝나지 않았어요. 잠시 뒤 다시 시도해 주세요." });
      const limit = m.kind === "video" ? M.MAX_VIDEO : M.MAX_IMAGE;
      if (Number(f.ContentLength) !== Number(m.size) || Number(f.ContentLength) > limit || (t !== true && Number(t.ContentLength) > M.MAX_THUMB)) {
        await db.query("DELETE FROM post_media WHERE id = ?", [id]); await M.removeFiles([id]);
        return L.json(res, 400, { error: "올린 파일이 약속한 크기와 달라요. 다시 올려 주세요." });
      }
      await db.query("UPDATE post_media SET status = 1 WHERE id = ?", [id]);
      return L.json(res, 200, { media: M.shape(m) });
    }
    return L.json(res, 400, { error: "알 수 없는 요청입니다." });
  } catch (e) {
    console.error("media", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
