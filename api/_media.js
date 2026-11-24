// 사진·동영상 공용: 한도, R2 서명 주소, 파일 지우기. 파일명이 _ 로 시작해 Vercel 이 라우트로 노출하지 않는다.
// 파일은 서버를 거치지 않는다 — 브라우저가 서명 주소(presigned URL)로 R2 에 바로 올린다(Vercel 함수는 본문 4.5MB 가 한계라 300MB 동영상은 못 받는다).
const { PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const L = require("./_lib");

const MAX_VIDEO = 300 * 1024 * 1024;    // 동영상 한 개 최대 300MB
const MAX_IMAGE = 12 * 1024 * 1024;     // 사진은 브라우저가 가로세로 1920px 이하 JPEG 로 줄여 올린다(보통 0.3~1.5MB)
const MAX_THUMB = 1024 * 1024;          // 목록 썸네일(JPEG)
const MAX_FILES = 10, MAX_VIDEOS = 3;   // 글 하나에 붙일 수 있는 파일 수
const C_MAX_VIDEO = 100 * 1024 * 1024;  // 댓글에는 동영상 한 개 최대 100MB
const C_MAX_FILES = 4, C_MAX_VIDEOS = 1; // 댓글 하나에 붙일 수 있는 파일 수
const F_MAX_VIDEO = 100 * 1024 * 1024;  // 피드: 동영상 한 개 최대 100MB
const F_MAX_FILES = 10, F_MAX_VIDEOS = 2; // 피드 글 하나: 사진·동영상 합쳐 10개, 동영상은 그중 2개까지
const VIDEO_MIME = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const IMAGE_MIME = "image/jpeg";
const PUT_SECONDS = 7200, GET_SECONDS = 3600;

const key = (id, v) => `media/${id}/${v === "thumb" ? "thumb.jpg" : "full"}`;
const bucket = () => L.env.R2_BUCKET;
const putUrl = (id, v, type, size) => getSignedUrl(L.r2(), new PutObjectCommand({ Bucket: bucket(), Key: key(id, v), ContentType: type, ContentLength: size }), { expiresIn: PUT_SECONDS });
const getUrl = (id, v) => getSignedUrl(L.r2(), new GetObjectCommand({ Bucket: bucket(), Key: key(id, v) }), { expiresIn: GET_SECONDS });
const head = async (id, v) => { try { return await L.r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key(id, v) })); } catch { return null; } };

// R2 에서 파일 지우기(실패해도 조용히 넘어간다 — 글·표는 이미 정리됐고, 남은 파일은 이름이 id 라 나중에 따로 쓸어낼 수 있다)
async function removeFiles(ids) {
  if (!ids.length) return;
  try {
    await L.r2().send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Quiet: true, Objects: ids.flatMap((id) => [{ Key: key(id, "full") }, { Key: key(id, "thumb") }]) } }));
  } catch (e) { console.error("media remove", e); }
}
const shape = (m) => ({ id: m.id, kind: m.kind, w: m.w, h: m.h, thumb: !!m.has_thumb });

module.exports = { F_MAX_VIDEO, F_MAX_FILES, F_MAX_VIDEOS, C_MAX_VIDEO, C_MAX_FILES, C_MAX_VIDEOS, MAX_VIDEO, MAX_IMAGE, MAX_THUMB, MAX_FILES, MAX_VIDEOS, VIDEO_MIME, IMAGE_MIME, key, putUrl, getUrl, head, removeFiles, shape };
