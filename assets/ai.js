// AI 도우미 창 — 상단바의 ✦ 버튼을 누르면 어느 페이지에서든 같은 자리에 뜬다(떠 있는 카드 모양).
// 상단바와 하단바 사이에 떠 있는 카드: 머리(제목 + 새 대화·지난 대화·닫기) · 대화 영역 · 입력칸(Enter 로 보내기, Shift+Enter 줄바꿈).
// 서버는 api/ask.js(글·댓글을 검색·열람해 답한다). 대화는 이 기기에만 저장된다(localStorage, 사람별) — «지난 대화» 에서 다시 열고 지울 수 있다.
// shell.js 가 첫 클릭 때 이 파일을 불러온다. 겹쳐 불러도 한 번만 동작한다.
(function () {
  if (window.TT && TT.ai) return;
  const $ = (s, r = document) => r.querySelector(s), esc = TT.esc, MAX = 3000;
  const ICON = {
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4.5 11.8 9l4.5 1.8L11.8 12.6 10 17.1 8.2 12.6 3.7 10.8 8.2 9zM18 3.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7zM17.5 14.5l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h8M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    hist: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 4v4.5H8M12 8v4.2l2.8 1.8"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6.5 11.5 12 6l5.5 5.5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5"/></svg>',
  };
  const HELLO = "안녕하세요! 사이트에 올라온 글과 댓글을 찾아 읽고 요약·분석해 드려요. «이번 주 토론 내용 정리해 줘», «채용 글에서 공통된 의견이 뭐야?», «다음에 쓸 글감 추천해 줘»처럼 물어보세요. 글쓰기·HR 일반 질문도 괜찮아요. 다른 사람의 개인정보는 알려 드릴 수 없어요.";

  // ── 저장: 사람별 대화 목록(최신순). 한 대화는 {id, title, at, msgs:[{role, content}]} ──
  const KEY = () => "tt_ai2_" + ((TT.user && TT.user.id) || 0);
  let items = [], cur = null, view = "chat", busy = false, left = null, user0 = -1;
  const load = () => { try { const j = JSON.parse(localStorage.getItem(KEY()) || "{}"); items = Array.isArray(j.items) ? j.items.filter((c) => c && Array.isArray(c.msgs)) : []; } catch { items = []; } };
  const save = () => { try { localStorage.setItem(KEY(), JSON.stringify({ items: items.slice(0, 30).map((c) => ({ ...c, msgs: c.msgs.slice(-30) })) })); } catch {} };

  // ── 답변 꾸미기: 안전하게 이스케이프한 뒤 **굵게**, - 목록, 1. 목록, [#글번호] 링크만 살린다 ──
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[#(\d{1,9})\]/g, '<a class="aip__ref" href="/article?id=$1">글 #$1</a>');
  function fmt(text) {
    const out = []; let list = null;
    const flush = () => { if (list) { out.push(`<${list.t}>${list.items.map((i) => `<li>${i}</li>`).join("")}</${list.t}>`); list = null; } };
    for (const para of String(text).replace(/\r/g, "").split(/\n{2,}/)) {
      let buf = [];
      const flushP = () => { if (buf.length) { flush(); out.push(`<p>${buf.map(inline).join("<br>")}</p>`); buf = []; } };
      for (const line of para.split("\n")) {
        const ul = /^\s*[-•]\s+(.*)$/.exec(line), ol = /^\s*\d{1,2}[.)]\s+(.*)$/.exec(line);
        if (ul || ol) { flushP(); const t = ul ? "ul" : "ol"; if (!list || list.t !== t) { flush(); list = { t, items: [] }; } list.items.push(inline((ul || ol)[1])); }
        else if (line.trim()) { if (list) flush(); buf.push(line); }
      }
      flushP();
    }
    flush(); return out.join("");
  }
  const mmdd = (ms) => { const d = new Date(ms); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };

  // ── 창 만들기(처음 열 때 한 번) ──
  let root, card, body, listEl, form, ta, send, sub, counter;
  function build() {
    document.body.insertAdjacentHTML("beforeend", `
<section class="aip" id="aip" role="dialog" aria-label="AI 도우미" hidden>
  <header class="aip__head">
    <span class="aip__logo">${ICON.spark}</span>
    <div class="aip__ttl"><p>AI 도우미</p><small id="aipSub" hidden></small></div>
    <button class="aip__hb" type="button" id="aipDel" aria-label="이 대화 삭제" title="이 대화 삭제" hidden>${ICON.trash}</button>
    <button class="aip__hb" type="button" id="aipNew" aria-label="새 대화" title="새 대화">${ICON.edit}</button>
    <button class="aip__hb" type="button" id="aipHist" aria-label="지난 대화 보기" aria-pressed="false" title="지난 대화">${ICON.hist}</button>
    <button class="aip__hb" type="button" id="aipClose" aria-label="AI 도우미 닫기">${ICON.x}</button>
  </header>
  <div class="aip__list" id="aipList" hidden></div>
  <div class="aip__body" id="aipBody" aria-live="polite"></div>
  <form class="aip__form" id="aipForm" autocomplete="off">
    <div class="aip__row">
      <label class="aip__lab"><span class="sr">질문</span><textarea id="aipTa" rows="2" maxlength="${MAX}" placeholder="궁금한 것을 물어보세요"></textarea></label>
      <button class="aip__send" id="aipSend" type="submit" aria-label="보내기" disabled>${ICON.send}</button>
    </div>
    <p class="aip__cnt" id="aipCnt">0 / ${MAX}</p>
  </form>
</section>`);
    root = $("#aip"); body = $("#aipBody"); listEl = $("#aipList"); form = $("#aipForm"); ta = $("#aipTa"); send = $("#aipSend"); sub = $("#aipSub"); counter = $("#aipCnt");
    $("#aipClose").addEventListener("click", () => api.close());
    $("#aipNew").addEventListener("click", () => { if (busy) return; cur = null; setView("chat"); drawThread(); ta.focus(); });
    $("#aipHist").addEventListener("click", () => { if (busy) return; setView(view === "list" ? "chat" : "list"); });
    arm($("#aipDel"), () => { if (!cur) return; items = items.filter((c) => c !== cur); cur = null; save(); drawThread(); });
    ta.addEventListener("input", sync);
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
    form.addEventListener("submit", (e) => { e.preventDefault(); const t = ta.value.trim(); if (t && !busy) ask(t); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !root.hidden) api.close(); });
    // 키보드가 올라오면(iOS) 하단바는 키보드 뒤라 그만큼 창을 올려 키보드 바로 위에 붙인다
    const vv = window.visualViewport;
    if (vv) { const place = () => { const inset = Math.max(0, innerHeight - vv.height - vv.offsetTop); root.classList.toggle("is-kb", inset > 80); root.style.setProperty("--aip-kb", inset + "px"); root.style.setProperty("--aip-vh", vv.height + "px"); }; vv.addEventListener("resize", place); vv.addEventListener("scroll", place); }
  }
  // 두 번 눌러야 지워지는 삭제(한 번 누르면 «정말 삭제», 4초 안에 다시 누르면 삭제)
  function arm(btn, run) {
    let t = 0; const off = () => { btn.classList.remove("is-armed"); clearTimeout(t); };
    btn.addEventListener("click", () => { if (btn.classList.contains("is-armed")) { off(); run(); } else { btn.classList.add("is-armed"); t = setTimeout(off, 4000); } });
  }
  const sync = () => { const v = ta.value; counter.textContent = `${[...v].length} / ${MAX}`; send.disabled = busy || !v.trim(); };

  function setView(v) {
    view = v; listEl.hidden = v !== "list"; body.hidden = v === "list"; form.hidden = v === "list";
    const h = $("#aipHist"); h.setAttribute("aria-pressed", String(v === "list")); h.classList.toggle("is-on", v === "list");
    $("#aipDel").hidden = v === "list" || !cur;
    if (v === "list") drawList();
  }
  function drawList() {
    if (!items.length) { listEl.innerHTML = `<p class="aip__title">지난 대화</p><p class="aip__empty">아직 저장된 대화가 없어요.<br>질문하면 여기에 쌓여요.</p>`; return; }
    listEl.innerHTML = `<p class="aip__title">지난 대화</p><ul>${items.map((c, i) => `<li class="aip__it${c === cur ? " is-cur" : ""}"><button type="button" class="aip__open" data-i="${i}"><b>${esc(c.title)}</b><span>${mmdd(c.at)} · 질문 ${c.msgs.filter((m) => m.role === "user").length}개</span></button><button type="button" class="aip__x" data-i="${i}" aria-label="«${esc(c.title)}» 대화 삭제" title="삭제">${ICON.trash}</button></li>`).join("")}</ul><p class="aip__note">대화는 이 기기에만 저장돼요. 삭제하면 그 대화의 질문과 답이 모두 지워져요.</p>`;
  }
  function onList(e) {
    const o = e.target.closest(".aip__open"), x = e.target.closest(".aip__x");
    if (o) { cur = items[+o.dataset.i]; setView("chat"); drawThread(); return; }
    if (x) {
      if (!x.classList.contains("is-armed")) { x.classList.add("is-armed"); x.textContent = "정말 삭제"; setTimeout(() => { if (x.isConnected) { x.classList.remove("is-armed"); x.innerHTML = ICON.trash; } }, 4000); return; }
      const c = items[+x.dataset.i]; items = items.filter((k) => k !== c); if (c === cur) cur = null; save(); drawList();
    }
  }

  function bubble(m) {
    return m.role === "user" ? `<p class="aip__me">${esc(m.content).replace(/\n/g, "<br>")}</p>` : `<div class="aip__ai">${fmt(m.content)}</div>`;
  }
  function drawThread() {
    body.innerHTML = `<p class="aip__hello">${esc(HELLO)}</p>` + (cur ? cur.msgs.map(bubble).join("") : "");
    $("#aipDel").hidden = view === "list" || !cur;
    body.scrollTop = body.scrollHeight;
  }
  const note = (t) => { sub.hidden = !t; sub.textContent = t || ""; };

  async function ask(text) {
    if (busy) return; busy = true; sync();
    if (!cur) { cur = { id: Date.now(), title: text.replace(/\s+/g, " ").slice(0, 26), at: Date.now(), msgs: [] }; items.unshift(cur); }
    cur.msgs.push({ role: "user", content: text }); cur.at = Date.now(); save();
    ta.value = ""; sync(); drawThread(); $("#aipDel").hidden = true;
    body.insertAdjacentHTML("beforeend", `<p class="aip__wait" id="aipWait"><span class="aip__dots" aria-hidden="true"><i></i><i></i><i></i></span><span id="aipSt">답을 찾는 중</span></p>`);
    body.scrollTop = body.scrollHeight;
    let answer = "", err = "";
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ messages: cur.msgs.slice(-14) }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "AI가 잠시 응답하지 못했어요."); }
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { done, value } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i; while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
          let o; try { o = JSON.parse(line); } catch { continue; }
          if (o.s) { const el = $("#aipSt"); if (el) el.textContent = o.s; }
          else if (o.a) { answer = o.a; if (typeof o.left === "number") left = o.left; }
          else if (o.e) err = o.e;
        }
      }
      if (!answer && !err) err = "답변이 중간에 끊겼어요. 다시 한번 물어봐 주세요.";
    } catch (e) { err = e.message || "AI가 잠시 응답하지 못했어요."; }
    $("#aipWait")?.remove();
    if (answer) { cur.msgs.push({ role: "assistant", content: answer }); cur.at = Date.now(); save(); drawThread(); if (left !== null) note(`오늘 남은 질문 ${left}번`); }
    else {
      cur.msgs.pop(); if (!cur.msgs.length) { items = items.filter((c) => c !== cur); cur = null; } save();
      drawThread(); ta.value = text; body.insertAdjacentHTML("beforeend", `<p class="aip__err" role="alert">${esc(err)}</p>`); body.scrollTop = body.scrollHeight;
    }
    busy = false; sync();
  }

  const api = TT.ai = {
    open() {
      if (!root) { build(); listEl.addEventListener("click", onList); }
      const uid = (TT.user && TT.user.id) || 0;
      if (uid !== user0) { user0 = uid; load(); cur = null; left = null; note(""); }   // 로그인한 사람이 바뀌면 앞 사람의 대화를 비운다
      setView("chat"); drawThread(); root.hidden = false; $("#aiTop")?.setAttribute("aria-expanded", "true"); $("#aiTop")?.classList.add("is-open");
      if (matchMedia("(hover: hover) and (pointer: fine)").matches) ta.focus();
    },
    close() { if (!root || root.hidden) return; root.hidden = true; $("#aiTop")?.setAttribute("aria-expanded", "false"); $("#aiTop")?.classList.remove("is-open"); $("#aiTop")?.focus({ preventScroll: true }); },
    toggle() { if (root && !root.hidden) api.close(); else api.open(); },
  };
})();
