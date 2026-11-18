// GET /api/photo?u=<id>&v=<버전>  → 프로필 사진(R2 에서 읽어 전달, 로그인한 사람만)
// POST /api/photo {image: "data:image/jpeg;base64,..."} → 내 사진 교체 (브라우저가 256px 로 줄여서 보낸다)
const { GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const L = require("./_lib");

const MAX = 300 * 1024; // 줄인 사진은 보통 20~40KB. 300KB 가 넘으면 거절
const keyOf = (id) => `avatars/${Number(id)}.jpg`;

module.exports = async (req, res) => {
  try {
    const u = await L.currentUser(req);
    if (!u) return L.json(res, 401, { error: "로그인이 필요합니다." });

    if (req.method === "GET") {
      const id = Number(req.query.u);
      if (!Number.isInteger(id) || id < 1) return L.json(res, 400, { error: "잘못된 요청입니다." });
      try {
        const o = await L.r2().send(new GetObjectCommand({ Bucket: L.env.R2_BUCKET, Key: keyOf(id) }));
        res.statusCode = 200;
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "private, max-age=31536000, immutable"); // 바뀌면 v 가 바뀐다
        return res.end(Buffer.from(await o.Body.transformToByteArray()));
      } catch (e) {
        if (e.name === "NoSuchKey") return L.json(res, 404, { error: "사진이 없습니다." });
        throw e;
      }
    }

    if (req.method === "POST") {
      if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });
      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(L.readBody(req).image || ""));
      if (!m) return L.json(res, 400, { error: "JPEG 사진만 올릴 수 있습니다." });
      const buf = Buffer.from(m[1], "base64");
      if (buf.length > MAX) return L.json(res, 413, { error: "사진이 너무 큽니다." });
      if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) return L.json(res, 400, { error: "올바른 JPEG 가 아닙니다." });
      await L.r2().send(new PutObjectCommand({ Bucket: L.env.R2_BUCKET, Key: keyOf(u.id), Body: buf, ContentType: "image/jpeg" }));
      await L.db().query("UPDATE users SET photo_v = photo_v + 1 WHERE id = ?", [u.id]);
      return L.json(res, 200, { user: L.publicUser({ ...u, photo_v: u.photo_v + 1 }) });
    }
    return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
  } catch (e) {
    console.error("photo", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
