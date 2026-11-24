// 글쓰기의 사진·동영상: 브라우저에서 사진은 줄이고 썸네일을 만들고, 동영상은 대표 장면을 뽑은 뒤 R2 에 바로 올린다(서버를 거치지 않는다).
// 쓰는 곳: write.html.  TT.media.prepare(file) → 올릴 준비, TT.media.upload(item, onProgress) → 올리고 {id,kind,w,h,thumb} 돌려줌
(() => {
  const FULL = 1920, THUMB = 320;                    // 사진 긴 변 최대 1920px, 썸네일 320px 정사각형(목록에선 88px 로 보이니 2~3배 선명)
  const MAX_VIDEO = 300 * 1024 * 1024;               // 서버(api/_media.js)와 같은 한도
  const VIDEO_EXT = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm" };
  const IMAGE_EXT = /^(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/;
  const fail = (message) => Object.assign(new Error(message), { friendly: true });
  const toBlob = (c, q) => new Promise((ok) => c.toBlob(ok, "image/jpeg", q));
  const square = (src, sw, sh) => {
    const c = document.createElement("canvas"); c.width = c.height = THUMB;
    const x = c.getContext("2d"), s = Math.min(sw, sh);
    x.fillStyle = "#fff"; x.fillRect(0, 0, THUMB, THUMB); x.drawImage(src, (sw - s) / 2, (sh - s) / 2, s, s, 0, 0, THUMB, THUMB);
    return c;
  };

  function classify(file) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (/^image\//.test(file.type) || IMAGE_EXT.test(ext)) return { kind: "image" };
    const mime = VIDEO_EXT[ext] || (["video/mp4", "video/quicktime", "video/webm"].includes(file.type) ? file.type : null);
    return mime ? { kind: "video", mime } : null;
  }

  async function decode(file) {
    if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* 아래 <img> 로 다시 시도 */ } }
    return new Promise((ok, no) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); ok(im); };
      im.onerror = () => { URL.revokeObjectURL(u); no(fail("이 사진은 열 수 없어요. JPG·PNG·WEBP 사진으로 해 보세요.")); };
      im.src = u;
    });
  }

  async function prepareImage(file) {
    const src = await decode(file), sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
    if (!sw || !sh) throw fail("이 사진은 열 수 없어요.");
    const k = Math.min(1, FULL / Math.max(sw, sh)), w = Math.round(sw * k), h = Math.round(sh * k);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(src, 0, 0, w, h);   // 투명 PNG 는 흰 바탕 위에
    const main = await toBlob(c, 0.86), thumb = await toBlob(square(src, sw, sh), 0.8);
    if (src.close) src.close();
    if (!main || !thumb) throw fail("사진을 줄이지 못했어요. 다른 사진으로 해 보세요.");
    return { kind: "image", mime: "image/jpeg", main, thumb, w, h, preview: URL.createObjectURL(thumb) };
  }

  async function prepareVideo(file, mime, maxVideo = MAX_VIDEO) {
    if (file.size > maxVideo) throw fail(`동영상은 ${Math.round(maxVideo / 1048576)}MB 까지 올릴 수 있어요.`);
    const url = URL.createObjectURL(file), v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    const once = (ev, ms) => new Promise((ok) => { const t = setTimeout(() => ok(false), ms); v.addEventListener(ev, () => { clearTimeout(t); ok(true); }, { once: true }); });
    let w = 0, h = 0, thumb = null;
    try {
      if (await once("loadedmetadata", 10000)) {
        w = v.videoWidth; h = v.videoHeight;
        if (w && (await once("loadeddata", 8000))) {                    // 대표 장면: 처음 1초 안쪽(길이가 짧으면 앞부분)
          v.currentTime = Math.min(1, (v.duration || 1) * 0.1);
          if (await once("seeked", 6000)) thumb = await toBlob(square(v, w, h), 0.8);
        }
      }
    } catch { /* 대표 장면을 못 뽑아도 올릴 수는 있다 */ }
    v.removeAttribute("src"); v.load(); URL.revokeObjectURL(url);
    return { kind: "video", mime, main: file, thumb, w, h, preview: thumb ? URL.createObjectURL(thumb) : null };
  }

  async function prepare(file, opts = {}) {   // opts.maxVideo: 동영상 한도(바이트, 댓글은 100MB)
    const c = classify(file);
    if (!c) throw fail("사진(JPG·PNG·WEBP)과 동영상(MP4·MOV·WEBM)만 올릴 수 있어요.");
    if (!file.size) throw fail("빈 파일이에요.");
    return c.kind === "image" ? prepareImage(file) : prepareVideo(file, c.mime, opts.maxVideo);
  }

  function put(item, url, type, blob, onBytes) {
    return new Promise((ok, no) => {
      const x = new XMLHttpRequest(); item.xhr = x;
      x.open("PUT", url); x.setRequestHeader("Content-Type", type);
      x.upload.onprogress = (e) => e.lengthComputable && onBytes(e.loaded);
      x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : no(fail("올리지 못했어요. 다시 시도해 주세요.")));
      x.onerror = () => no(fail("인터넷이 끊겼어요. 연결을 확인하고 다시 시도해 주세요."));
      x.onabort = () => no(Object.assign(new Error("취소"), { aborted: true }));
      x.send(blob);
    });
  }

  async function upload(item, onProgress, scope) {   // scope: "comment"·"feed" 면 서버가 동영상 100MB 한도로 받는다
    const total = item.main.size + (item.thumb ? item.thumb.size : 0);
    const r = await TT.call("/api/media?a=init", "POST", { kind: item.kind, mime: item.mime, size: item.main.size, w: item.w, h: item.h, thumbSize: item.thumb ? item.thumb.size : 0, scope });
    item.id = r.id; let done = 0;
    if (item.thumb) { await put(item, r.thumb.url, r.thumb.type, item.thumb, (l) => onProgress((done + l) / total)); done += item.thumb.size; }
    await put(item, r.full.url, r.full.type, item.main, (l) => onProgress((done + l) / total));
    let d; try { d = await TT.call("/api/media?a=done", "POST", { id: r.id }); } catch { await new Promise((ok) => setTimeout(ok, 1200)); d = await TT.call("/api/media?a=done", "POST", { id: r.id }); }
    return d.media;
  }

  // 올리다 말고 뺀 파일은 서버에서도 치운다(실패해도 조용히 — 하루 뒤 서버가 알아서 정리한다)
  const discard = (id) => TT.call("/api/media?a=remove", "POST", { id }).catch(() => {});

  window.TT.media = { prepare, upload, discard, classify, MAX_FILES: 10, MAX_VIDEOS: 3, C_MAX_VIDEO: 100 * 1024 * 1024, C_MAX_FILES: 4, C_MAX_VIDEOS: 1, F_MAX_VIDEO: 100 * 1024 * 1024, F_MAX_FILES: 10, F_MAX_VIDEOS: 2 };   // F_: 피드(api/_media.js 와 같은 한도)
})();
