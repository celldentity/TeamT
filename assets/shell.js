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
  };
  const TABS = [["/", "홈", IC.home], ["/articles", "아티클", IC.doc], ["/team", "T조 소개", IC.team], ["/me", "마이페이지", IC.me]];
  const cur = (p) => (p === path ? ' aria-current="page"' : "");

  const s = document.currentScript;
  s.parentElement.classList.toggle("app--gate", GATE);
  s.insertAdjacentHTML("beforebegin",
    `<header class="top" id="top"><div class="wrap top__in"><a class="logo" href="/" aria-label="HR T | 니핑 홈">HR T<i>|</i>니핑</a>` +
    (GATE ? "" : `<nav class="nav" aria-label="주요 메뉴">${TABS.slice(0, 3).map(([p, l]) => `<a href="${p}"${cur(p)}>${l}</a>`).join("")}</nav>`) +
    `</div></header>`);
  // 하단 메뉴: 가입·로그인 화면(/join)에는 «로그인» 하나만 가운데에 둔다. 나머지 메뉴는 로그인이 확인된 뒤에만 보인다.
  // 로그인 확인 전(.pending)에는 메뉴를 가리되, 이 브라우저에서 로그인한 적이 있으면(localStorage tt_in) 깜박임 없이 바로 보여 준다.
  const tabHtml = ([p, l, ic]) => `<a class="tab" href="${p}"${p === path ? ' aria-current="page"' : ""}><span class="tab__ic">${ic}</span>${l}</a>`;
  s.insertAdjacentHTML("afterend", GATE
    ? `<nav class="tabbar tabbar--gate" aria-label="하단 메뉴"><a class="tab" href="/join" aria-current="page"><span class="tab__ic">${IC.me}</span>로그인</a></nav>`
    : `<nav class="tabbar tabbar--app" aria-label="하단 메뉴">${TABS.map(tabHtml).join("")}</nav>`);
  try { if (localStorage.getItem("tt_in") === "1") html.classList.add("known"); } catch {}

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

  const TT = (window.TT = { call, esc, initial, avatar, user: null });
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
    return user;
  }).catch((e) => { html.classList.remove("pending"); console.error(e); return null; });
  // 로그인 상태가 바뀌면 하단 메뉴 아이콘 갱신
  TT.setTabUser = (u) => { const me = document.querySelector('.tab[href="/me"] .tab__ic'); if (me) me.innerHTML = u ? `<span class="tab__av">${avatar(u)}</span>` : TABS[3][2]; };
})();
