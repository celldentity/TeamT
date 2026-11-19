// 자료실(/library) 링크 해석: 유튜브·인스타그램·스레드 주소를 알아보고(parse), 제목·올린 사람·미리보기 이미지를 가져온다(meta·thumb).
// 파일명이 _ 로 시작해 라우트로 노출되지 않는다. 가져오는 곳은 아래 허용 목록의 호스트뿐이다(서버가 임의 주소로 요청을 보내는 SSRF 를 막으려고).
// 유튜브: 공개 oEmbed + 공식 썸네일. 인스타그램·스레드: 공개 페이지의 OG 태그(링크 미리보기 봇이 읽는 것)를 «최선을 다해» 읽는다 — 막히면 제목·이미지 없이 링크 카드만 만든다.
const UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";   // 링크 미리보기용 봇 이름(인스타그램·스레드가 OG 태그를 내주는 쪽)
const IMG_HOSTS = [".cdninstagram.com", ".fbcdn.net", ".ytimg.com", ".threads.net", ".threads.com", ".instagram.com"];
const PLATFORM = { youtube: "유튜브", instagram: "인스타그램", threads: "스레드" };

// 주소 → {platform, extId, url(정리한 주소)}. 알아볼 수 없으면 null.
function parse(input) {
  let u; try { u = new URL(String(input || "").trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const h = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, ""), parts = u.pathname.split("/").filter(Boolean);
  if (h === "youtu.be" && /^[\w-]{11}$/.test(parts[0] || "")) return { platform: "youtube", extId: parts[0], url: `https://www.youtube.com/watch?v=${parts[0]}` };
  if (h === "youtube.com" || h === "youtube-nocookie.com" || h === "music.youtube.com") {
    let id = "";
    if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
    else if (["shorts", "live", "embed", "v"].includes(parts[0])) id = parts[1] || "";
    if (/^[\w-]{11}$/.test(id)) return { platform: "youtube", extId: id, url: parts[0] === "shorts" ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}` };
    return null;
  }
  if (h === "instagram.com" || h === "instagr.am") {
    // /p/CODE · /reel/CODE · /tv/CODE (앞에 /사용자이름/ 이 붙은 주소도 허용)
    const i = parts.findIndex((x) => ["p", "reel", "reels", "tv"].includes(x));
    const code = i >= 0 ? parts[i + 1] : "";
    if (/^[\w-]{5,20}$/.test(code || "")) { const kind = parts[i] === "reels" ? "reel" : parts[i]; return { platform: "instagram", extId: code, url: `https://www.instagram.com/${kind}/${code}/` }; }
    return null;
  }
  if (h === "threads.net" || h === "threads.com") {
    const i = parts.findIndex((x) => x === "post"), user = (parts[0] || "").replace(/^@/, "");
    const code = i >= 0 ? parts[i + 1] : "";
    if (/^[\w.]{1,40}$/.test(user) && /^[\w-]{5,20}$/.test(code || "")) return { platform: "threads", extId: code, url: `https://www.threads.com/@${user}/post/${code}` };
    return null;
  }
  return null;
}

const entities = (s) => String(s || "").replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
  e = e.toLowerCase();
  if (e[0] === "#") { const n = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; }
  return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[e] || m;
});
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return [...s].length > n ? [...s].slice(0, n - 1).join("") + "…" : s; };

async function get(url, { ua, timeout = 7000, max = 700000, accept } = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: "follow", headers: { "user-agent": ua || UA, "accept-language": "ko,en;q=0.8", ...(accept ? { accept } : {}) } });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return { buf: buf.length > max ? buf.subarray(0, max) : buf, type: r.headers.get("content-type") || "" };
  } catch { return null; } finally { clearTimeout(t); }
}

const og = (html, prop) => { const m = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i").exec(html) || new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i").exec(html); return m ? entities(m[1]) : ""; };

// 제목·올린 사람·미리보기 이미지 주소. 못 가져온 것은 빈 문자열.
async function meta(p) {
  if (p.platform === "youtube") {
    const r = await get(`https://www.youtube.com/oembed?url=${encodeURIComponent(p.url)}&format=json`, { ua: "Mozilla/5.0", accept: "application/json" });
    let j = {}; try { j = JSON.parse(r ? r.buf.toString("utf8") : "{}"); } catch { /* 제목 없이 */ }
    return { title: clip(j.title, 200), author: clip(j.author_name, 100), thumbs: [`https://i.ytimg.com/vi/${p.extId}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${p.extId}/hqdefault.jpg`] };
  }
  const r = await get(p.url);
  const html = r ? r.buf.toString("utf8") : "";
  const image = og(html, "og:image"), title = og(html, "og:title"), desc = og(html, "og:description");
  if (p.platform === "instagram") {
    // og:title 은 보통 «이름 on Instagram: "캡션"» 모양
    const m = /^(.+?) on Instagram\b/.exec(title) || /^(.+?)\s*[•(]/.exec(title);
    const cap = /Instagram:\s*["“]?(.*?)["”]?$/.exec(title);
    let out = { title: clip(cap ? cap[1] : (desc || "").replace(/^.*?:\s*["“]/, "").replace(/["”]\.?$/, "") || title, 200), author: clip(m ? m[1] : "", 100), thumbs: image ? [image] : [] };
    if (!out.thumbs.length) {   // OG 가 막혔을 때: 공개 임베드 페이지에서 사진·글쓴이·캡션을 읽는다(공개 게시물만 나온다)
      const e = await get(p.url + "embed/captioned/", { ua: "Mozilla/5.0" }), h = e ? e.buf.toString("utf8") : "";
      const img = /<img[^>]+class="[^"]*EmbeddedMediaImage[^"]*"[^>]*\ssrc="([^"]+)"/i.exec(h) || /\ssrc="([^"]+)"[^>]*class="[^"]*EmbeddedMediaImage/i.exec(h);
      if (img) out.thumbs = [entities(img[1])];
      const user = /class="[^"]*(?:UsernameText|CaptionUsername)[^"]*"[^>]*>([^<]+)</i.exec(h), capt = /<div class="Caption">([\s\S]*?)<\/div>/i.exec(h);
      if (user && !out.author) out.author = clip(entities(user[1]), 100);
      if (capt && !out.title) out.title = clip(entities(capt[1].replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(new RegExp("^\\s*" + (user ? user[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "@@") + "\\s*", "i"), "")), 200);
    }
    return out;
  }
  const user = (/@([\w.]+)\/post\//.exec(p.url) || [])[1] || "";
  return { title: clip(desc || title, 200), author: clip(user ? "@" + user : "", 100), thumbs: image ? [image] : [] };
}

// 미리보기 이미지 한 장을 내려받는다(허용된 호스트·https·이미지·3MB 이하만). 첫 번째로 받아지는 주소를 쓴다.
async function thumb(urls) {
  for (const raw of urls) {
    let u; try { u = new URL(raw); } catch { continue; }
    if (u.protocol !== "https:" || !IMG_HOSTS.some((h) => u.hostname === h.slice(1) || u.hostname.endsWith(h))) continue;
    const r = await get(u.href, { ua: "Mozilla/5.0", timeout: 7000, max: 3 * 1024 * 1024, accept: "image/*" });
    if (r && /^image\/(jpeg|png|webp)/.test(r.type) && r.buf.length > 800) return { buf: r.buf, type: r.type.split(";")[0] };
  }
  return null;
}

module.exports = { parse, meta, thumb, PLATFORM };
