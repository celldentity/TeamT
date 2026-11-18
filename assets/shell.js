// 모든 페이지 공통: 상단 메뉴·하단 메뉴 넣기, 스크롤 진행 표시, 로그인 확인(초대장 가입 화면 /join 만 로그인 없이 연다).
// 각 페이지는 <div class="app"> 안 맨 위에서 이 스크립트를 동기로 불러 헤더가 깜박임 없이 먼저 그려지게 한다.
(() => {
  const path = (location.pathname.replace(/\/+$/, "") || "/").replace(/\.html$/, "");
  const GATE = path === "/join";
  const html = document.documentElement;
  html.classList.add("pending");

  const IC = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>',
    doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M8.5 12.5h7M8.5 16h5"/></svg>',
    team: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="f" cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.4-3.2 2.6-5 5.5-5s5.1 1.8 5.5 5"/><circle class="f" cx="17" cy="9.5" r="2.4"/><path d="M16.5 14.7c2.4.2 3.9 1.7 4.3 4.3"/></svg>',
    me: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="f" cx="12" cy="8.5" r="3.6"/><path d="M4.5 20c.6-4 3.5-6.2 7.5-6.2s6.9 2.2 7.5 6.2"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h3M16 8l4 4-4 4M20 12H9"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/></svg>',
  };
  const TABS = [["/", "홈", IC.home], ["/articles", "아티클", IC.doc], ["/team", "T조 소개", IC.team], ["/me", "마이페이지", IC.me]];
  const s = document.currentScript;
  s.parentElement.classList.toggle("app--gate", GATE);
  s.insertAdjacentHTML("beforebegin",
    // 상단: 로고 + (로그인한 뒤) 알림·로그아웃. 페이지 메뉴는 하단바에 있어서 중복으로 두지 않는다.
    `<header class="top" id="top"><div class="wrap top__in"><a class="logo" href="/" aria-label="HR T | 니핑 홈">HR T<i>|</i>니핑</a>` +
    (GATE ? "" : `<div class="top__r"><a class="bell" href="/notifications" aria-label="알림">${IC.bell}<b class="bell__n" id="bellN" hidden></b></a><button class="top__out" type="button" id="logoutTop" aria-label="로그아웃" title="로그아웃">${IC.out}</button></div>`) +
    `</div></header>`);
  // 하단 메뉴: 가입·로그인 화면(/join)에는 «로그인» 하나만 가운데에 둔다. 나머지 메뉴는 로그인이 확인된 뒤에만 보인다.
  // 로그인 확인 전(.pending)에는 메뉴를 가리되, 이 브라우저에서 로그인한 적이 있으면(localStorage tt_in) 깜박임 없이 바로 보여 준다.
  const tabPath = /^\/(article|write)$/.test(path) ? "/articles" : path; // 글 보기·글쓰기도 «아티클» 메뉴로 친다
  const tabHtml = ([p, l, ic]) => `<a class="tab" href="${p}"${p === tabPath ? ' aria-current="page"' : ""}><span class="tab__ic">${ic}</span>${l}</a>`;
  s.insertAdjacentHTML("afterend", GATE
    ? `<nav class="tabbar tabbar--gate" aria-label="하단 메뉴"><a class="tab" href="/join" aria-current="page"><span class="tab__ic">${IC.me}</span>로그인</a></nav>`
    : `<nav class="tabbar tabbar--app" aria-label="하단 메뉴">${TABS.map(tabHtml).join("")}</nav>`);
  try { if (localStorage.getItem("tt_in") === "1") html.classList.add("known"); } catch {}
  // 아티클 목록·글 보기에서는 하단바 바로 위 오른쪽에 둥근 분홍 «글쓰기» 버튼을 띄운다
  if (/^\/(articles|article)$/.test(path)) document.body.insertAdjacentHTML("beforeend",
    '<a class="fab" href="/write" aria-label="글쓰기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17zM13.5 7.5l3 3"/></svg></a>');

  // 스크롤 진행 표시: 헤더 아래 경계선이 왼쪽에서 오른쪽으로 차오른다
  const top = document.getElementById("top");
  let tick = false;
  const progress = () => {
    tick = false;
    const max = html.scrollHeight - innerHeight;
    top.style.setProperty("--p", max > 0 ? Math.min(1, Math.max(0, scrollY / max)).toFixed(4) : 0);
  };
  addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(progress); } }, { passive: true });
  addEventListener("resize", progress);
  addEventListener("load", progress);
  progress();

  // 서버 호출 + 로그인 확인
  async function call(url, method = "GET", body) {
    const r = await fetch(url, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "요청에 실패했습니다. 잠시 뒤 다시 시도해 주세요.");
    return j;
  }
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initial = (u) => [...u.nickname][0] || "T";
  const avatar = (u) => (u.photoUrl ? `<img src="${esc(u.photoUrl)}" alt="">` : esc(initial(u)));

  // 글쓴이(author 가 null 이면 T조 AI), 몇 분 전/며칠 전, 하트 아이콘
  const who = (a) => a || { nickname: "T조 AI", photoUrl: null };
  const ago = (d) => {
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 60) return "방금"; if (s < 3600) return `${Math.floor(s / 60)}분 전`; if (s < 86400) return `${Math.floor(s / 3600)}시간 전`; if (s < 7 * 86400) return `${Math.floor(s / 86400)}일 전`;
    const t = new Date(d); return `${t.getMonth() + 1}월 ${t.getDate()}일`;
  };
  const heart = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20.5C5.5 15.8 3 12.6 3 9.4 3 7 4.8 5.2 7.1 5.2c1.9 0 3.7 1 4.9 2.8 1.2-1.8 3-2.8 4.9-2.8C19.2 5.2 21 7 21 9.4c0 3.2-2.5 6.4-9 11.1Z"/></svg>';
  const bubble = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17h-7l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5Z"/></svg>';
  // 닉네임 옆에 아주 작은 프로필 사진(없으면 첫 글자)
  const chip = (u) => `<span class="who"><span class="who__av">${avatar(who(u))}</span>${esc(who(u).nickname)}</span>`;
  // 글 종류 구분: 사람이 직접 / 사람이 AI 와 함께(ai=1, 글쓴이 있음) / T조 AI 가 씀(글쓴이 없음)
  const SPARK = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M12 2.5l2.1 6.4 6.4 2.1-6.4 2.1L12 19.5l-2.1-6.4-6.4-2.1 6.4-2.1z"/></svg>';
  const PERSON = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><circle cx="12" cy="8" r="3.6" fill="currentColor"/><path fill="currentColor" d="M4.8 20c.5-3.8 3.4-6 7.2-6s6.7 2.2 7.2 6z"/></svg>';
  const KINDS = { human: ["직접 쓴 글", PERSON], assist: ["AI와 함께", SPARK], ai: ["AI 작성", SPARK] };
  const kind = (p) => (p.ai ? (p.author ? "assist" : "ai") : "human");
  const kindChipOf = (k) => `<span class="chip chip--${k}">${KINDS[k][1]}${KINDS[k][0]}</span>`;
  const kindChip = (p) => kindChipOf(kind(p));
  // 아티클 카드(목록·홈 공용): 왼쪽에 분류·글 종류·제목·미리보기, 오른쪽에 대표 사진·동영상 썸네일(있을 때만), 아래 줄에 글쓴이·시각·좋아요·댓글
  const PLAY = '<span class="th__play"><i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg></i></span>';
  const thumb = (c) => (!c ? "" : `<span class="th${c.thumb ? "" : " th--none"}">${c.thumb ? `<img src="/api/media?id=${c.id}&v=thumb" alt="" loading="lazy" decoding="async">` : ""}${c.kind === "video" ? PLAY : ""}${c.n > 1 ? `<span class="th__n" aria-label="파일 ${c.n}개">+${c.n - 1}</span>` : ""}</span>`);
  const postCard = (p) => `<li><a class="art art--${kind(p)}${p.cover ? " art--img" : ""}" href="/article?id=${p.id}">
    <div class="art__main"><div class="art__meta"><span class="chip">${esc(p.category)}</span>${kindChip(p)}</div>
    <h3 class="art__title">${esc(p.title)}</h3>
    <p class="art__text">${esc((p.excerpt || "").replace(/\s+/g, " "))}</p></div>${thumb(p.cover)}
    <div class="art__foot">${chip(p.author)}<span>${ago(p.createdAt)}</span><span class="stat${p.liked ? " stat--on" : ""}">${heart}${p.likes}</span><span class="stat">${bubble}${p.comments}</span></div></a></li>`;
  const TT = (window.TT = { call, esc, initial, avatar, who, chip, ago, heart, bubble, postCard, kind, kindChip, kindChipOf, user: null });

  // 꾸민 드롭다운: <select> 를 숨겨 두고(값은 그대로 폼에 실린다) 그 자리에 버튼+목록을 그린다.
  // 키보드(↑↓ Enter Space Esc Home End)·스크린리더(listbox)를 지원하고, 아래 공간이 모자라면 위로 펼친다.
  // 옵션을 다시 채우거나 .value 를 코드로 바꿨다면 el._sel.sync()(옵션을 바꿨으면 build()) 를 부른다.
  const CHEV = '<svg class="sel__chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  let selN = 0;
  TT.select = (native) => {
    if (native._sel) return native._sel;
    const uid = "sel" + ++selN, lab = native.dataset.label;
    const wrap = document.createElement("div"); wrap.className = "sel";
    native.parentNode.insertBefore(wrap, native);
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "sel__btn"; btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = `<span class="sel__v" id="${uid}-v"></span>${CHEV}`;
    if (lab) btn.setAttribute("aria-labelledby", `${lab} ${uid}-v`);
    const list = document.createElement("ul"); list.className = "sel__list"; list.id = uid + "-l"; list.setAttribute("role", "listbox");
    if (lab) list.setAttribute("aria-labelledby", lab);
    btn.setAttribute("aria-controls", list.id);
    wrap.append(btn, list, native);
    native.classList.add("sel__native"); native.tabIndex = -1; native.setAttribute("aria-hidden", "true");
    const items = () => [...list.children];
    let act = -1;
    const isOpen = () => wrap.classList.contains("is-open");
    function sync() {
      const o = native.options[native.selectedIndex];
      document.getElementById(uid + "-v").textContent = o ? o.textContent : "";
      items().forEach((li, i) => li.setAttribute("aria-selected", String(i === native.selectedIndex)));
    }
    function build() {
      list.innerHTML = [...native.options].map((o, i) => `<li class="sel__opt" role="option" id="${uid}-o${i}" data-i="${i}" aria-selected="false">${esc(o.textContent)}${CHECK}</li>`).join("");
      sync();
    }
    function setActive(i) {
      items().forEach((li) => li.removeAttribute("data-active"));
      act = Math.max(0, Math.min(items().length - 1, i));
      const li = items()[act]; if (!li) return;
      li.setAttribute("data-active", ""); btn.setAttribute("aria-activedescendant", li.id); li.scrollIntoView({ block: "nearest" });
    }
    const away = (e) => { if (!wrap.contains(e.target)) close(false); };
    function open() {
      if (isOpen() || !items().length) return;
      wrap.classList.remove("sel--up");
      const r = btn.getBoundingClientRect(), bar = document.querySelector(".tabbar")?.offsetHeight || 0;
      const below = innerHeight - r.bottom - bar - 8;
      if (below < list.offsetHeight + 8 && r.top - 8 > below) wrap.classList.add("sel--up");
      wrap.classList.add("is-open"); btn.setAttribute("aria-expanded", "true");
      setActive(native.selectedIndex < 0 ? 0 : native.selectedIndex);
      document.addEventListener("pointerdown", away, true);
    }
    function close(focus) {
      if (!isOpen()) return;
      wrap.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); btn.removeAttribute("aria-activedescendant");
      document.removeEventListener("pointerdown", away, true);
      if (focus) btn.focus();
    }
    function pick(i) {
      if (native.selectedIndex !== i) { native.selectedIndex = i; native.dispatchEvent(new Event("change", { bubbles: true })); }
      sync(); close(true);
    }
    btn.addEventListener("click", () => (isOpen() ? close(false) : open()));
    btn.addEventListener("keydown", (e) => {
      const k = e.key, n = items().length;
      if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); if (!isOpen()) return open(); setActive(act + (k === "ArrowDown" ? 1 : -1)); }
      else if (k === "Home" || k === "End") { if (isOpen()) { e.preventDefault(); setActive(k === "Home" ? 0 : n - 1); } }
      else if (k === "Enter" || k === " ") { e.preventDefault(); isOpen() ? pick(act) : open(); }
      else if (k === "Escape") { if (isOpen()) { e.preventDefault(); close(true); } }
      else if (k === "Tab") close(false);
      else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {   // 첫 글자로 건너뛰기
        const hit = items().findIndex((li, i) => i > act && li.textContent.startsWith(k)), any = items().findIndex((li) => li.textContent.startsWith(k));
        const to = hit >= 0 ? hit : any; if (to >= 0) { if (isOpen()) setActive(to); else pick(to); }
      }
    });
    list.addEventListener("pointermove", (e) => { const li = e.target.closest(".sel__opt"); if (li && +li.dataset.i !== act) setActive(+li.dataset.i); });
    list.addEventListener("click", (e) => { const li = e.target.closest(".sel__opt"); if (li) pick(+li.dataset.i); });
    native.addEventListener("change", sync);
    build();
    return (native._sel = { sync, build, open, close });
  };
  // 홈 화면에 추가(PWA): 서비스워커 등록 + 안드로이드 설치 창 이벤트 붙잡아 두기(마이페이지의 버튼이 쓴다)
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); TT.installEv = e; document.dispatchEvent(new Event("tt-install")); });
  const never = new Promise(() => {}); // 페이지를 떠나는 중이라면 뒤 코드를 실행하지 않는다
  TT.ready = call("/api/me").then(({ user }) => {
    TT.user = user;
    try { user ? localStorage.setItem("tt_in", "1") : localStorage.removeItem("tt_in"); } catch {}
    if (!user && !GATE) { location.replace("/join"); return never; }
    if (user && GATE) { location.replace("/"); return never; }
    const me = document.querySelector('.tab[href="/me"] .tab__ic');
    if (user && me) me.innerHTML = `<span class="tab__av">${avatar(user)}</span>`;
    html.classList.remove("pending");
    if (user && !GATE) call("/api/notifications?count=1").then((r) => TT.setBell(r.unread)).catch(() => {});
    return user;
  }).catch((e) => { html.classList.remove("pending"); console.error(e); return null; });
  // 상단 알림 숫자(0 이면 숨김), 로그아웃
  // 앱 아이콘 위 숫자(배지) — 홈 화면에 추가한 앱에서 보인다. 상단 종 숫자(안 읽은 알림 수)와 같은 값.
  const appBadge = (n) => { try { const r = n > 0 ? navigator.setAppBadge?.(n) : navigator.clearAppBadge?.(); r?.catch?.(() => {}); } catch {} };
  TT.setBell = (n) => { appBadge(n); const b = document.getElementById("bellN"); if (!b) return; b.hidden = !n; b.textContent = n > 99 ? "99+" : n; document.querySelector(".bell")?.setAttribute("aria-label", n ? `알림 ${n}개` : "알림"); };
  // ── 폰 알림(웹 푸시): 이 기기에서 켜고 끄기 ──
  const pushOK = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const swReg = () => Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 6000))]).catch(() => null);   // 서비스워커 등록이 안 되면 ready 가 영영 안 끝난다
  const b64 = (b) => Uint8Array.from(atob(b.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  async function subscribe(welcome) {
    const reg = await swReg(); if (!reg) throw new Error("알림을 준비하지 못했어요. 새로고침한 뒤 다시 시도해 주세요.");
    const { publicKey } = await call("/api/push");
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) });
    return call("/api/push", "POST", { subscription: sub.toJSON(), welcome: !!welcome });
  }
  TT.push = {
    supported: pushOK,
    async state() {   // unsupported | denied | on | off
      if (!pushOK()) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      const reg = await swReg(); if (!reg) return "unsupported";
      return (await reg.pushManager.getSubscription()) && Notification.permission === "granted" ? "on" : "off";
    },
    // 버튼을 누른 바로 그 순간에 불러야 한다(권한 창은 사용자가 눌러야만 뜬다). 성공하면 «켜졌어요» 알림이 이 기기로 바로 온다.
    async enable() {
      if ((await Notification.requestPermission()) !== "granted") throw new Error("알림이 차단돼 있어요. 폰(또는 브라우저) 설정에서 이 사이트의 알림을 허용해 주세요.");
      return subscribe(true);
    },
    async disable() { const reg = await swReg(), sub = reg && await reg.pushManager.getSubscription(); if (sub) { await call("/api/push", "DELETE", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); } },
    // 이미 허용된 기기는 조용히 «지금 로그인한 사람의 기기»로 다시 맞춘다(같은 폰에서 계정이 바뀌었거나 구독이 만료됐을 때). 세션당 한 번.
    async refresh() { if (!pushOK() || Notification.permission !== "granted") return; try { if (sessionStorage.getItem("tt_push_ref")) return; sessionStorage.setItem("tt_push_ref", "1"); } catch {} await subscribe(false).catch(() => {}); },
  };
  // 처음 들어온 사람에게 한 번 «알림 켜기» 를 권한다(홈·아티클·글 보기 위쪽에 끼워 넣는 카드). «나중에» 는 3일 동안 다시 묻지 않는다.
  // 아이폰은 사파리 탭에서는 알림이 안 되고 «홈 화면에 추가한 앱» 에서만 되므로, 그 안내 카드로 바꿔 보여 준다.
  async function nudge() {
    if (GATE || !["/", "/articles", "/team", "/article"].includes(path)) return;
    try { if (Date.now() - Number(localStorage.getItem("tt_nudge") || 0) < 3 * 864e5) return; } catch {}
    const ua = navigator.userAgent, ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    let kind = null;
    if (pushOK()) { if ((await TT.push.state()) === "off") kind = "ask"; } else if (ios && !standalone) kind = "ios";
    if (!kind) return;
    const el = document.createElement("section"); el.className = "nudge"; el.setAttribute("aria-label", "알림 켜기");
    el.innerHTML = kind === "ask"
      ? `<div class="nudge__t"><b>폰 알림 켜기</b><span>새 글·내 글의 댓글과 좋아요를 앱을 열지 않아도 바로 알려드려요.</span></div><div class="nudge__b"><button class="btn btn--sm" type="button" data-n="on">알림 켜기</button><button class="btn btn--ghost btn--sm" type="button" data-n="no">나중에</button></div><p class="msg msg--err" role="alert"></p>`
      : `<div class="nudge__t"><b>폰 알림 받으려면</b><span>아이폰은 이 사이트를 <b>홈 화면에 추가</b>한 앱에서만 알림이 와요.</span></div><div class="nudge__b"><a class="btn btn--sm" href="/me#install">방법 보기</a><button class="btn btn--ghost btn--sm" type="button" data-n="no">나중에</button></div>`;
    // 페이지 맨 위(본문 폭에 맞춘 틀 안)에 끼운다. 홈에서는 첫 .wrap 이 히어로 칸 안이라 거기 넣으면 레이아웃이 깨진다.
    const holder = document.createElement("div"); holder.className = "wrap"; holder.append(el); document.querySelector("main").prepend(holder);
    el.addEventListener("click", async (e) => {
      const act = e.target.closest("[data-n]")?.dataset.n; if (!act) return;
      if (act === "no") { try { localStorage.setItem("tt_nudge", String(Date.now())); } catch {} holder.remove(); return; }
      const btn = e.target.closest("button"), err = el.querySelector(".msg"); btn.disabled = true; err.textContent = "";
      try { await TT.push.enable(); el.innerHTML = '<div class="nudge__t"><b>알림이 켜졌어요 🔔</b><span>방금 이 폰으로 확인 알림을 보냈어요.</span></div>'; setTimeout(() => holder.remove(), 4000); }
      catch (x) { err.textContent = x.message || "알림을 켜지 못했어요. 잠시 뒤 다시 시도해 주세요."; btn.disabled = false; }
    });
  }
  TT.nudge = nudge;
  TT.ready.then((u) => { if (u && !GATE) { TT.push.refresh(); nudge(); } });
  if (!GATE) {   // 로그아웃: 아이콘을 누르면 가운데 창에서 한 번 더 묻는다
    document.body.insertAdjacentHTML("beforeend", `<div class="dlg" id="logoutDlg" role="alertdialog" aria-modal="true" aria-labelledby="logoutT" hidden><div class="dlg__card">
      <h2 class="dlg__t" id="logoutT">로그아웃 하시겠습니까?</h2><p class="dlg__p">다시 들어오려면 이메일과 비밀번호가 필요해요.</p>
      <div class="dlg__btns"><button class="btn btn--ghost" type="button" id="logoutNo">취소</button><button class="btn" type="button" id="logoutYes">로그아웃</button></div></div></div>`);
    const dlg = document.getElementById("logoutDlg"), closeDlg = () => { dlg.hidden = true; document.removeEventListener("keydown", onEsc); document.getElementById("logoutTop")?.focus(); };
    const onEsc = (e) => { if (e.key === "Escape") closeDlg(); };
    document.getElementById("logoutTop")?.addEventListener("click", () => { dlg.hidden = false; document.addEventListener("keydown", onEsc); document.getElementById("logoutNo").focus(); });
    document.getElementById("logoutNo").addEventListener("click", closeDlg);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) closeDlg(); });
    document.getElementById("logoutYes").addEventListener("click", async (e) => { e.currentTarget.disabled = true; try { await call("/api/auth?a=logout", "POST", {}); } catch {} location.href = "/join"; });
  }
  // 로그인 상태가 바뀌면 하단 메뉴 아이콘 갱신
  TT.setTabUser = (u) => { const me = document.querySelector('.tab[href="/me"] .tab__ic'); if (me) me.innerHTML = u ? `<span class="tab__av">${avatar(u)}</span>` : TABS[3][2]; };
})();
