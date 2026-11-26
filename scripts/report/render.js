// 주간 토론 «정리 PDF» 만들기(운영자 PC 에서만 돌린다 — scripts/make_report.js) — 사람들이 한 글에서 나눈 이야기를 도식·도표·일러스트로 보기 좋게 정리해 A4 PDF 로 만든다. 파일명이 _ 로 시작해 라우트로 노출되지 않는다.
//   render(spec, facts) → Promise<Buffer>
//   spec  = 운영자가 지시하면 Claude Code 세션이 토론을 읽고 쓴 «내용»(제목·관점·비교표·흐름·말·실무 팁). normalize() 가 길이·개수를 다듬는다. 지어낸 숫자는 넣지 않는다.
//   facts = 서버가 DB 에서 센 «사실»(댓글 수·사람별 댓글 수·날짜별 댓글 수·주제 일러스트). 참여 차트는 이 값만 쓴다.
// 글꼴: Noto Sans KR(OFL, scripts/report/assets/ 에 한글 음절만 부분집합으로 넣어 둠). 그림: 주제 일러스트 + T조 캐릭터(scripts/report/assets/img/c00~c09.png) + 코드로 그린 도형·아이콘.
const fs = require("fs"), path = require("path");
const PDFDocument = require("pdfkit");

const DIR = path.join(__dirname, "assets");
const FONT = { R: path.join(DIR, "NotoSansKR-Regular.ttf"), B: path.join(DIR, "NotoSansKR-Bold.ttf") };
const CHAR = (i) => path.join(DIR, "img", `c${String(((i % 10) + 10) % 10).padStart(2, "0")}.png`);

// 색은 사이트 토큰(assets/app.css :root)과 같은 값
const C = { ink: "#171719", soft: "#57546b", pink: "#f9a8cd", pinkDeep: "#e77fb0", pinkInk: "#b23a72", lav: "#dcd2fa", lavDeep: "#b9a6f0", lavTint: "#eee9fc", blush: "#fff1f6", violet: "#7a5fd6", line: "#ebe5f7", white: "#ffffff" };
const PAGE = { w: 595.28, h: 841.89, m: 42 };
const CW = PAGE.w - PAGE.m * 2;

const clip = (s, n) => { const a = [...String(s == null ? "" : s).replace(/\s+/g, " ").trim()]; return a.length > n ? a.slice(0, n - 1).join("") + "…" : a.join(""); };
const arr = (a, n, f) => (Array.isArray(a) ? a : []).slice(0, n).map(f).filter(Boolean);
const ICONS = ["building", "rocket", "scale", "heart", "chart", "clock", "shield", "bulb", "users", "target"];

// Claude 가 준 JSON 을 믿지 않고 모양·길이를 맞춘다(빠진 칸은 비워 두고 그 부분은 PDF 에서 건너뛴다)
function normalize(s = {}) {
  const persp = arr(s.perspectives, 4, (p) => p && p.label && { label: clip(p.label, 22), icon: ICONS.includes(p.icon) ? p.icon : "bulb", points: arr(p.points, 4, (x) => clip(x, 70)), who: arr(p.who, 5, (x) => clip(x, 12)) });
  const cmp = s.compare && Array.isArray(s.compare.criteria) && Array.isArray(s.compare.rows) ? {
    criteria: arr(s.compare.criteria, 4, (x) => clip(x, 12)),
    rows: arr(s.compare.rows, 4, (r) => r && r.option && { option: clip(r.option, 16), cells: arr(r.cells, 4, (x) => clip(x, 40)) }),
  } : null;
  return {
    title: clip(s.title || "이번 주 토론 정리", 70), subtitle: clip(s.subtitle, 80), tldr: clip(s.tldr, 140), overview: clip(s.overview, 320),
    keywords: arr(s.keywords, 8, (x) => clip(x, 12)),
    perspectives: persp, compare: cmp && cmp.criteria.length && cmp.rows.length ? cmp : null,
    flow: arr(s.flow, 6, (f) => f && f.title && { title: clip(f.title, 28), detail: clip(f.detail, 80), kind: f.kind === "question" ? "question" : "step" }),
    quotes: arr(s.quotes, 4, (q) => q && q.text && { nickname: clip(q.nickname, 12), text: clip(q.text, 90) }),
    dos: arr(s.dos, 5, (x) => clip(x, 70)), donts: arr(s.donts, 5, (x) => clip(x, 70)), checklist: arr(s.checklist, 6, (x) => clip(x, 60)),
    closing: clip(s.closing, 120),
  };
}

async function render(specIn, facts = {}) {
  const S = normalize(specIn);
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true, autoFirstPage: false, info: { Title: S.title, Author: "HR T | 니핑 프로젝트 · 미드핑", Subject: "이번 주 토론 정리" } });
  const chunks = []; doc.on("data", (c) => chunks.push(c));
  const done = new Promise((ok) => doc.on("end", () => ok(Buffer.concat(chunks))));
  doc.registerFont("R", FONT.R); doc.registerFont("B", FONT.B);
  const people = (facts.people || []).slice().sort((a, b) => b.comments - a.comments);
  const charOf = (name) => { let h = 0; for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h % 10; };
  const byName = new Map(people.map((p, i) => [p.nickname, i]));

  // ── 그리기 도우미 ──
  const rr = (x, y, w, h, r, fill, stroke, lw = 1) => { doc.roundedRect(x, y, w, h, r); if (fill && stroke) doc.lineWidth(lw).fillAndStroke(fill, stroke); else if (fill) doc.fill(fill); else if (stroke) doc.lineWidth(lw).stroke(stroke); };
  const wrap = (str, w, size, b) => {
    doc.font(b ? "B" : "R").fontSize(size); const out = [];
    for (const para of String(str).split("\n")) {
      let line = "";
      for (const tok of para.split(" ")) {
        const t = line ? line + " " + tok : tok;
        if (!w || doc.widthOfString(t) <= w) { line = t; continue; }
        if (line) out.push(line);
        line = "";
        if (doc.widthOfString(tok) <= w) { line = tok; continue; }
        let part = "";   // 한 낱말이 한 줄보다 길면 글자 단위로
        for (const ch of tok) { if (doc.widthOfString(part + ch) > w && part) { out.push(part); part = ch; } else part += ch; }
        line = part;
      }
      out.push(line);
    }
    return out;
  };
  const LH = (size, gap) => size * 1.45 + gap;
  const txt = (str, x, y, o = {}) => {
    const size = o.size || 11, gap = o.gap == null ? 3 : o.gap, lines = wrap(str, o.w, size, o.b); doc.font(o.b ? "B" : "R").fontSize(size).fillColor(o.color || C.ink);
    lines.forEach((l, i) => { const tw = doc.widthOfString(l), dx = o.align === "center" ? (o.w - tw) / 2 : o.align === "right" ? o.w - tw : 0; doc.text(l, x + dx, y + i * LH(size, gap), { lineBreak: false }); });
    return y + lines.length * LH(size, gap) - gap;
  };
  const ctxt = (str, cx, cy, o = {}) => {   // 도형 한가운데에 글자 놓기(가로·세로 모두 글자 모양 기준 정중앙, 여러 줄도 가능)
    const size = o.size || 11, gap = o.gap == null ? 0 : o.gap, w = o.w || 2000, n = wrap(str, w, size, o.b).length;
    return txt(str, cx - w / 2, cy - 0.79 * size - ((n - 1) * LH(size, gap)) / 2, { align: "center", ...o, w, gap });
  };
  // ⚠ 규칙: 도형·아이콘·칩·상자 «안에» 들어가는 글자는 txt(…, y+임의값) 으로 어림해 놓지 말고 반드시 ctxt(중심 좌표) 로 놓는다(그래야 세로 정중앙). txt 는 상자 위선 기준이라 도형 안에서 아래로 처진다.
  const hOf = (str, w, size, b, gap = 3) => wrap(str, w, size, b).length * LH(size, gap) - gap;
  const pill = (s, x, y, o = {}) => { const size = o.size || 9.5; doc.font("B").fontSize(size); const w = doc.widthOfString(s) + 18, h = size + 11, x0 = o.cx != null ? o.cx - w / 2 : x; rr(x0, y, w, h, h / 2, o.fill || C.lav, o.stroke); ctxt(s, x0 + w / 2, y + h / 2, { size, b: true, color: o.color || C.violet }); return w; };
  const circleImg = (file, cx, cy, r, ring) => { doc.save(); doc.roundedRect(cx - r, cy - r, r * 2, r * 2, r * 0.42).clip(); doc.image(file, cx - r, cy - r, { width: r * 2, height: r * 2 }); doc.restore(); if (ring) rr(cx - r, cy - r, r * 2, r * 2, r * 0.42, null, ring, 1.2); };
  const pageBg = (color) => { doc.rect(0, 0, PAGE.w, PAGE.h).fill(color); };
  const sectionTitle = (no, title, sub) => {
    doc.circle(PAGE.m + 14, PAGE.m + 24, 14).fill(C.pink); ctxt(String(no), PAGE.m + 14, PAGE.m + 24, { size: 14, b: true });
    txt(title, PAGE.m + 40, PAGE.m + 10, { size: 21, b: true, gap: 0 }); if (sub) txt(sub, PAGE.m + 40, PAGE.m + 38, { size: 10, color: C.soft, gap: 0 });
    return PAGE.m + 66;
  };
  // 작은 도형 아이콘(−10..10 좌표). 사진·일러스트가 아닌 «도식용» 기호
  const icon = (name, cx, cy, r, bg, fg) => {
    doc.circle(cx, cy, r).fill(bg); doc.save(); doc.translate(cx, cy); doc.scale(r / 14); doc.lineJoin("round").lineCap("round");
    const st = (w = 1.6) => doc.lineWidth(w).strokeColor(fg), fl = () => doc.fillColor(fg);
    switch (name) {
      case "building": doc.rect(-6, -7, 12, 14).fill(fg); doc.fillColor(bg); for (const [x, y] of [[-3.5, -4.5], [0.8, -4.5], [-3.5, -0.5], [0.8, -0.5]]) doc.rect(x, y, 2.6, 2.6).fill(); doc.rect(-1.3, 3.4, 2.6, 3.6).fill(); break;
      case "rocket": doc.moveTo(0, -9).bezierCurveTo(6, -4, 6, 3, 3.5, 6).lineTo(-3.5, 6).bezierCurveTo(-6, 3, -6, -4, 0, -9).fill(fg); doc.fillColor(bg).circle(0, -2, 2.1).fill(); doc.moveTo(-3.5, 2).lineTo(-8, 8).lineTo(-3.5, 6).fill(fg); doc.moveTo(3.5, 2).lineTo(8, 8).lineTo(3.5, 6).fill(fg); break;
      case "scale": st(); doc.moveTo(0, -8).lineTo(0, 8).moveTo(-5, 8).lineTo(5, 8).moveTo(-8, -5).lineTo(8, -5).stroke(); doc.moveTo(-8, -5).lineTo(-11, 2).lineTo(-5, 2).closePath().moveTo(8, -5).lineTo(5, 2).lineTo(11, 2).closePath().stroke(); break;
      case "heart": doc.moveTo(0, 8).bezierCurveTo(-12, -1, -7, -9, 0, -3).bezierCurveTo(7, -9, 12, -1, 0, 8).fill(fg); break;
      case "chart": doc.rect(-8, 1, 4.4, 7).fill(fg); doc.rect(-2.2, -4, 4.4, 12).fill(fg); doc.rect(3.6, -8, 4.4, 16).fill(fg); break;
      case "clock": st(1.8); doc.circle(0, 0, 8).stroke(); doc.moveTo(0, -4.5).lineTo(0, 0).lineTo(4, 2.2).stroke(); break;
      case "shield": doc.moveTo(0, -9).lineTo(8, -6).lineTo(8, 0).bezierCurveTo(8, 5, 4, 8, 0, 10).bezierCurveTo(-4, 8, -8, 5, -8, 0).lineTo(-8, -6).closePath().fill(fg); doc.strokeColor(bg).lineWidth(1.8).moveTo(-3.2, 0).lineTo(-0.8, 2.6).lineTo(3.6, -2.6).stroke(); break;
      case "bulb": doc.circle(0, -2.5, 6.4).fill(fg); doc.rect(-3, 3, 6, 4.2).fill(fg); doc.fillColor(bg).rect(-2, 8, 4, 1.4).fill(); break;
      case "users": doc.circle(-3.4, -3.6, 3.2).fill(fg); doc.circle(4.4, -2.6, 2.6).fill(fg); doc.moveTo(-9, 8).bezierCurveTo(-9, 1.4, 2, 1.4, 2, 8).closePath().fill(fg); doc.moveTo(3.2, 8).bezierCurveTo(3.2, 3.2, 10, 3.2, 10, 8).closePath().fill(fg); break;
      case "target": st(1.5); doc.circle(0, 0, 8.5).stroke(); doc.circle(0, 0, 4.8).stroke(); doc.circle(0, 0, 1.6).fill(fg); break;
      case "check": st(2.4); doc.moveTo(-6, 0.5).lineTo(-2, 4.6).lineTo(6, -4.4).stroke(); break;
      case "cross": st(2.4); doc.moveTo(-5, -5).lineTo(5, 5).moveTo(5, -5).lineTo(-5, 5).stroke(); break;
      case "quote": fl(); for (const x of [-5.5, 1.5]) { doc.circle(x + 2.6, -1.2, 3).fill(fg); doc.moveTo(x - 0.2, -1.6).lineTo(x + 0.6, 6.6).lineTo(x + 3.4, 1.5).fill(fg); } break;
      default: doc.circle(0, 0, 4).fill(fg);
    }
    doc.restore();
  };
  const arrowDown = (x, y1, y2, color = C.pinkDeep) => { doc.lineWidth(2).strokeColor(color).moveTo(x, y1).lineTo(x, y2 - 6).stroke(); doc.moveTo(x - 5, y2 - 7).lineTo(x + 5, y2 - 7).lineTo(x, y2).fill(color); };
  const need = (y, h) => { if (y + h > PAGE.h - 56) { doc.addPage(); return PAGE.m; } return y; };

  // ═══ 1. 표지 ═══
  doc.addPage(); pageBg(C.blush);
  doc.circle(PAGE.w - 30, 70, 170).fillOpacity(0.55).fill(C.lav).fillOpacity(1); doc.circle(40, PAGE.h - 80, 150).fillOpacity(0.5).fill(C.pink).fillOpacity(1);
  doc.circle(PAGE.w - 60, PAGE.h - 210, 38).fillOpacity(0.7).fill(C.lav).fillOpacity(1); doc.circle(PAGE.w - 74, 430, 18).fillOpacity(0.7).fill(C.pink).fillOpacity(1);
  pill("이번 주 토론 정리", PAGE.m + 6, 64, { fill: C.ink, color: C.white, size: 10.5 }); pill("HR T | 니핑 프로젝트", PAGE.m + 128, 64, { fill: C.white, stroke: C.pinkDeep, color: C.pinkInk, size: 10.5 });
  let y = txt(S.title, PAGE.m + 6, 118, { w: CW - 12, size: 31, b: true, gap: 6 });
  if (S.subtitle) y = txt(S.subtitle, PAGE.m + 6, y + 14, { w: CW - 12, size: 13.5, color: C.soft, gap: 4 });
  y += 28;
  if (facts.topicImage) { const iw = CW - 12, ih = iw * 0.75 > 270 ? 270 : iw * 0.75, w = ih / 0.75; const x0 = PAGE.m + 6 + (iw - w) / 2; doc.save(); doc.roundedRect(x0, y, w, ih, 22).clip(); doc.image(facts.topicImage, x0, y, { width: w, height: ih }); doc.restore(); rr(x0, y, w, ih, 22, null, C.pinkDeep, 2.5); y += ih + 26; }
  const stats = [["댓글", facts.totalComments], ["참여한 사람", people.length], ["이야기한 날", (facts.days || []).length]].filter((s) => s[1] != null);
  const sw = (CW - 12 - (stats.length - 1) * 10) / (stats.length || 1);
  stats.forEach((s, i) => { const x = PAGE.m + 6 + i * (sw + 10); rr(x, y, sw, 64, 16, C.white, C.lavDeep, 1.2); ctxt(String(s[1]), x + sw / 2, y + 25, { size: 24, b: true, color: C.pinkInk }); ctxt(s[0], x + sw / 2, y + 44, { size: 10.5, color: C.soft }); });
  y += 64 + 24;
  const mascots = [0, 4, 9, 7, 2]; const mx0 = PAGE.m + 6 + (CW - 12 - mascots.length * 62 + 12) / 2; mascots.forEach((m, i) => circleImg(CHAR(m), mx0 + i * 62 + 25, y + 20, 25, C.white));
  txt(`${facts.dateLabel || ""}  ·  미드핑이 정리했어요`, PAGE.m, PAGE.h - 56, { w: CW, align: "center", size: 10, color: C.soft, gap: 0 });

  // ═══ 2. 한눈에 보기 ═══
  doc.addPage(); y = sectionTitle(1, "한눈에 보기", "이번 토론에서 나온 이야기를 먼저 짧게");
  if (S.tldr) { const h = hOf(S.tldr, CW - 96, 15.5, true, 5) + 40; rr(PAGE.m, y, CW, h, 20, C.lav, C.lavDeep, 1.5); icon("bulb", PAGE.m + 34, y + h / 2, 17, C.white, C.violet); txt("한 줄 결론", PAGE.m + 66, y + 14, { size: 9.5, b: true, color: C.violet, gap: 0 }); txt(S.tldr, PAGE.m + 66, y + 30, { w: CW - 96, size: 15.5, b: true, gap: 5 }); y += h + 18; }
  if (S.overview) { const h = hOf(S.overview, CW - 36, 11.5, false, 5) + 44; rr(PAGE.m, y, CW, h, 18, C.white, C.line, 1.2); txt("토론 배경", PAGE.m + 18, y + 14, { size: 10, b: true, color: C.pinkInk, gap: 0 }); txt(S.overview, PAGE.m + 18, y + 32, { w: CW - 36, size: 11.5, gap: 5 }); y += h + 18; }
  if (S.keywords.length) { txt("핵심 키워드", PAGE.m, y, { size: 12.5, b: true, gap: 0 }); y += 24; let x = PAGE.m; S.keywords.forEach((k, i) => { doc.font("B").fontSize(11); const w = doc.widthOfString(k) + 22; if (x + w > PAGE.m + CW) { x = PAGE.m; y += 34; } pill(k, x, y, { fill: i % 2 ? C.blush : C.lav, stroke: i % 2 ? C.pink : C.lavDeep, color: i % 2 ? C.pinkInk : C.violet, size: 11 }); x += w + 8; }); y += 44; }
  if (S.perspectives.length) {   // 토론 지도: 가운데 주제, 둘레에 관점들
    y += 6; txt("토론 지도", PAGE.m, y, { size: 12.5, b: true, gap: 0 }); y += 26;
    const top = y, bottom = PAGE.h - 74, cx = PAGE.w / 2, cy = (top + bottom) / 2, n = S.perspectives.length, rx = CW / 2 - 66, ry = Math.max(80, (bottom - top) / 2 - 52);
    rr(PAGE.m, top, CW, bottom - top, 24, C.white, C.line, 1.2);
    const pos = S.perspectives.map((_, i) => { const a = (-90 + (360 / n) * i + (n === 2 ? 0 : 0)) * Math.PI / 180; return [cx + rx * Math.cos(a) * (n === 2 ? 1 : 1), cy + ry * Math.sin(a)]; });
    if (n === 2) { pos[0] = [cx - rx, cy]; pos[1] = [cx + rx, cy]; }
    if (n >= 4) { const dx = rx * 0.86, dy = Math.min(ry * 0.78, (bottom - top) / 2 - 62); [[-1, -1], [1, -1], [-1, 1], [1, 1]].slice(0, n).forEach(([sx, sy], i) => { pos[i] = [cx + sx * dx, cy + sy * dy]; }); }
    const R0 = n >= 4 ? 52 : 64;
    pos.forEach(([px, py], i) => { doc.lineWidth(2.2).dash(5, { space: 5 }).strokeColor(i % 2 ? C.pink : C.lavDeep).moveTo(cx, cy).lineTo(px, py).stroke().undash(); });
    doc.circle(cx, cy, R0).fill(C.pink); doc.circle(cx, cy, R0).lineWidth(3).stroke(C.white);
    const tt = clip(S.title, n >= 4 ? 26 : 34), tw = R0 * 1.55, th = hOf(tt, tw, 10.5, true, 2); ctxt(tt, cx, cy, { w: tw, size: 10.5, b: true, gap: 2 });
    pos.forEach(([px, py], i) => { const p = S.perspectives[i], fg = i % 2 ? C.pinkInk : C.violet; doc.circle(px, py, 29).fill(C.white); doc.circle(px, py, 29).lineWidth(2.2).stroke(i % 2 ? C.pinkDeep : C.lavDeep); icon(p.icon, px, py, 21, i % 2 ? C.blush : C.lavTint, fg); pill(p.label, 0, py + 34, { cx: px, size: 10.5, fill: i % 2 ? C.blush : C.lavTint, stroke: i % 2 ? C.pink : C.lavDeep, color: fg }); });
  }

  // ═══ 3. 관점 비교 ═══
  if (S.perspectives.length) {
    doc.addPage(); y = sectionTitle(2, "관점 비교", "서로 다른 시각을 나란히");
    const n = S.perspectives.length, cols = n === 4 ? 2 : n, gap = 12, cw = (CW - gap * (cols - 1)) / cols, tint = [[C.lavTint, C.lavDeep, C.violet], [C.blush, C.pink, C.pinkInk]];
    const heights = S.perspectives.map((p) => 74 + p.points.reduce((a, t) => a + hOf(t, cw - 46, 10.5, false, 3) + 9, 0) + (p.who.length ? 34 : 0) + 14);
    for (let r = 0; r * cols < n; r++) {
      const row = S.perspectives.slice(r * cols, r * cols + cols), rh = Math.max(...heights.slice(r * cols, r * cols + cols)); y = need(y, rh);
      row.forEach((p, k) => {
        const idx = r * cols + k, x = PAGE.m + k * (cw + gap), [bg, ln, fg] = tint[idx % 2];
        rr(x, y, cw, rh, 20, bg, ln, 1.5); icon(p.icon, x + 32, y + 36, 19, C.white, fg); ctxt(p.label, x + 58 + (cw - 70) / 2, y + 36, { w: cw - 70, align: "left", size: 13.5, b: true });
        let py = y + 74; p.points.forEach((t) => { doc.circle(x + 20, py + 6.5, 6).fill(fg); doc.save(); doc.translate(x + 20, py + 6.5); doc.scale(0.5); doc.lineWidth(2.6).strokeColor(C.white).lineCap("round").lineJoin("round").moveTo(-4, 0.5).lineTo(-1.2, 3.4).lineTo(4.2, -3.4).stroke(); doc.restore(); py = txt(t, x + 34, py, { w: cw - 46, size: 10.5, gap: 3 }) + 9; });
        if (p.who.length) { let wx = x + 14; const wy = y + rh - 32; p.who.forEach((nm) => { doc.font("B").fontSize(8.5); const w = doc.widthOfString(nm) + 14; if (wx + w < x + cw - 8) { rr(wx, wy, w, 18, 9, C.white, ln, 0.8); ctxt(nm, wx + w / 2, wy + 9, { size: 8.5, b: true, color: fg }); wx += w + 5; } }); }
      });
      y += rh + gap;
    }
    if (S.compare) {
      y = need(y + 8, 150); txt("한눈에 비교", PAGE.m, y, { size: 13, b: true, gap: 0 }); y += 26;
      const cr = S.compare.criteria, first = 96, cellw = (CW - first) / cr.length;
      rr(PAGE.m, y, CW, 30, 10, C.ink); cr.forEach((c, i) => ctxt(c, PAGE.m + first + i * cellw + cellw / 2, y + 15, { w: cellw, size: 10.5, b: true, color: C.white })); y += 34;
      S.compare.rows.forEach((row, ri) => {
        const rh = Math.max(34, ...row.cells.map((t) => hOf(t, cellw - 14, 10, false, 3) + 18)); y = need(y, rh);
        rr(PAGE.m, y, CW, rh, 10, ri % 2 ? C.white : C.lavTint, C.line, 1); ctxt(row.option, PAGE.m + 10 + (first - 14) / 2, y + rh / 2, { w: first - 14, align: "left", size: 10.5, b: true, color: C.pinkInk });
        row.cells.forEach((t, i) => ctxt(t, PAGE.m + first + i * cellw + cellw / 2, y + rh / 2, { w: cellw - 14, size: 10, gap: 3 })); y += rh + 4;
      });
    }
  }

  // ═══ 4. 고민 순서 흐름도 ═══
  if (S.flow.length) {
    doc.addPage(); y = sectionTitle(3, "이렇게 고민해 보세요", "토론에서 나온 판단 순서를 흐름으로");
    const bw = CW - 70, x = PAGE.m + 54;
    S.flow.forEach((f, i) => {
      const dh = f.detail ? hOf(f.detail, bw - 36, 10.5, false, 4) : 0, bh = Math.max(56, 40 + dh + 10); y = need(y, bh + 28);
      const q = f.kind === "question";
      doc.circle(PAGE.m + 20, y + bh / 2, 17).fill(q ? C.pinkInk : C.violet); ctxt(q ? "?" : String(i + 1), PAGE.m + 20, y + bh / 2, { size: 17, b: true, color: C.white });
      rr(x, y, bw, bh, 18, q ? C.blush : C.lavTint, q ? C.pinkDeep : C.lavDeep, 1.6); txt(f.title, x + 18, y + 13, { w: bw - 36, size: 13, b: true, gap: 0 }); if (f.detail) txt(f.detail, x + 18, y + 34, { w: bw - 36, size: 10.5, color: C.soft, gap: 4 });
      y += bh; if (i < S.flow.length - 1) { arrowDown(PAGE.m + 20, y + 3, y + 22, q ? C.pinkDeep : C.lavDeep); y += 26; }
    });
    y += 24; if (y < PAGE.h - 190) { circleImg(CHAR(6), PAGE.m + 34, y + 34, 34, C.lavDeep); rr(PAGE.m + 84, y + 8, CW - 84, 52, 16, C.white, C.lavDeep, 1.2); ctxt("정답은 하나가 아니에요. 내 상황에 맞는 순서로 천천히 따져 보세요.", PAGE.m + 100 + (CW - 116) / 2, y + 34, { w: CW - 116, align: "left", size: 11, color: C.soft, gap: 3 }); }
  }

  // ═══ 5. 참여 현황 + 이런 말이 나왔어요 ═══
  doc.addPage(); y = sectionTitle(4, "함께 나눈 이야기", "누가, 언제 이야기했는지");
  if (people.length) {
    txt("사람별 댓글", PAGE.m, y, { size: 12.5, b: true, gap: 0 }); y += 26; const max = Math.max(...people.map((p) => p.comments)), bx = PAGE.m + 96, bwMax = CW - 96 - 40;
    people.slice(0, 8).forEach((p, i) => { circleImg(CHAR(charOf(p.nickname)), PAGE.m + 20, y + 19, 18, null); ctxt(clip(p.nickname, 8), PAGE.m + 46 + 33, y + 19, { w: 66, align: "left", size: 10, b: true }); const w = Math.max(14, (p.comments / max) * bwMax); rr(bx + 8, y + 6, w, 26, 13, i % 2 ? C.pink : C.lavDeep); ctxt(String(p.comments), bx + 8 + w + 8 + 20, y + 19, { w: 40, align: "left", size: 11, b: true, color: C.pinkInk }); y += 40; });
    y += 8;
  }
  if ((facts.days || []).length) {
    y = need(y, 170); txt("날짜별 댓글", PAGE.m, y, { size: 12.5, b: true, gap: 0 }); y += 28; const days = facts.days.slice(-10), max = Math.max(...days.map((d) => d.n)), ch = 76, cwid = Math.min(46, (CW - 20) / days.length);
    doc.lineWidth(1).strokeColor(C.line).moveTo(PAGE.m, y + ch).lineTo(PAGE.m + CW, y + ch).stroke();
    days.forEach((d, i) => { const h = Math.max(6, (d.n / max) * (ch - 18)), x = PAGE.m + 8 + i * (cwid + 6); rr(x, y + ch - h, cwid, h, 8, i % 2 ? C.pink : C.lav, i % 2 ? C.pinkDeep : C.lavDeep, 1); txt(String(d.n), x, y + ch - h - 14, { w: cwid, align: "center", size: 9.5, b: true, color: C.pinkInk, gap: 0 }); txt(d.label, x - 4, y + ch + 6, { w: cwid + 8, align: "center", size: 8.5, color: C.soft, gap: 0 }); });
    y += ch + 30;
  }
  if (S.quotes.length) {
    y = need(y, 120); txt("이런 말이 나왔어요", PAGE.m, y, { size: 12.5, b: true, gap: 0 }); y += 26;
    S.quotes.forEach((q, i) => {
      const bw = CW - 70, th = hOf(`“${q.text}”`, bw - 36, 11.5, false, 4), bh = th + 34; y = need(y, bh + 10); const left = i % 2 === 0, x = left ? PAGE.m + 56 : PAGE.m + 14, av = left ? PAGE.m + 22 : PAGE.m + CW - 22;
      circleImg(CHAR(byName.has(q.nickname) ? charOf(q.nickname) : i + 3), av, y + 24, 20, C.white);
      rr(x, y, bw + 4, bh, 18, left ? C.blush : C.lavTint, left ? C.pink : C.lavDeep, 1.3); txt(`“${q.text}”`, x + 18, y + 14, { w: bw - 32, size: 11.5, gap: 4 }); txt(`— ${q.nickname || "참여자"}`, x + 18, y + 14 + th + 4, { w: bw - 32, align: "right", size: 9.5, b: true, color: left ? C.pinkInk : C.violet, gap: 0 }); y += bh + 9;
    });
  }

  // ═══ 6. 실무 체크 ═══
  if (S.dos.length || S.donts.length || S.checklist.length) {
    doc.addPage(); y = sectionTitle(5, "이렇게 해 보세요", "토론에서 모인 실무 팁");
    const cw = (CW - 14) / 2;
    const colH = (list) => 56 + list.reduce((a, t) => a + hOf(t, cw - 54, 10.5, false, 3) + 12, 0);
    const h = Math.max(colH(S.dos), colH(S.donts), 110);
    [[S.dos, "이건 좋아요", C.lavTint, C.lavDeep, C.violet, "check", 0], [S.donts, "이건 피해요", C.blush, C.pink, C.pinkInk, "cross", 1]].forEach(([list, title, bg, ln, fg, ic, k]) => {
      const x = PAGE.m + k * (cw + 14); rr(x, y, cw, h, 20, bg, ln, 1.5); icon(ic, x + 30, y + 30, 15, fg, C.white); ctxt(title, x + 54 + (cw - 70) / 2, y + 30, { w: cw - 70, align: "left", size: 13.5, b: true, color: fg });
      let py = y + 56; list.forEach((t) => { doc.circle(x + 22, py + 6.5, 3.2).fill(fg); py = txt(t, x + 34, py, { w: cw - 54, size: 10.5, gap: 3 }) + 12; });
    });
    y += h + 22;
    if (S.checklist.length) {
      txt("바로 써먹는 체크리스트", PAGE.m, y, { size: 13, b: true, gap: 0 }); y += 28;
      S.checklist.forEach((t) => { const th = hOf(t, CW - 70, 11, false, 3), bh = Math.max(40, th + 22); y = need(y, bh + 8); rr(PAGE.m, y, CW, bh, 14, C.white, C.lavDeep, 1.2); rr(PAGE.m + 14, y + bh / 2 - 9, 18, 18, 5, null, C.violet, 1.8); ctxt(t, PAGE.m + 46 + (CW - 70) / 2, y + bh / 2, { w: CW - 70, align: "left", size: 11, gap: 3 }); y += bh + 8; });
    }
    y += 18; y = need(y, 120);
    const closing = S.closing || "함께 이야기해 주셔서 고마워요.", cth = hOf(closing, CW - 226, 12.5, true, 4), chh = Math.max(96, cth + 64);
    rr(PAGE.m, y, CW, chh, 22, C.lav, C.lavDeep, 1.5); [1, 5, 8].forEach((m, i) => circleImg(CHAR(m), PAGE.m + 48 + i * 52, y + chh / 2, 22, C.white));
    txt(closing, PAGE.m + 210, y + 22, { w: CW - 226, size: 12.5, b: true, gap: 4 }); txt("— 미드핑이 정리했어요", PAGE.m + 210, y + 22 + cth + 10, { w: CW - 226, size: 9.5, color: C.violet, b: true, gap: 0 });
  }

  // 꼬리말(표지 제외): 쪽수
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i++) { doc.switchToPage(range.start + i); doc.rect(0, PAGE.h - 40, PAGE.w, 40).fill(C.white); doc.lineWidth(1).strokeColor(C.line).moveTo(PAGE.m, PAGE.h - 38).lineTo(PAGE.w - PAGE.m, PAGE.h - 38).stroke(); txt("HR T | 니핑 프로젝트  ·  이번 주 토론 정리", PAGE.m, PAGE.h - 28, { w: CW, size: 8.5, color: C.soft, gap: 0 }); txt(`${i + 1} / ${range.count}`, PAGE.m, PAGE.h - 28, { w: CW, align: "right", size: 8.5, b: true, color: C.pinkInk, gap: 0 }); }
  doc.flushPages(); doc.end();
  return done;
}

module.exports = { render, normalize };
