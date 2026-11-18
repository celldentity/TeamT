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
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/></svg>',
  };
  const TABS = [["/", "홈", IC.home], ["/articles", "아티클", IC.doc], ["/team", "T조 소개", IC.team], ["/me", "마이페이지", IC.me]];
  const s = document.currentScript;
  s.parentElement.classList.toggle("app--gate", GATE);
  s.insertAdjacentHTML("beforebegin",
    // 상단: 로고 + (로그인한 뒤) 알림·로그아웃. 페이지 메뉴는 하단바에 있어서 중복으로 두지 않는다.
    `<header class="top" id="top"><div class="wrap top__in"><a class="logo" href="/" aria-label="HR T | 니핑 홈">HR T<i>|</i>니핑</a>` +
    (GATE ? "" : `<div class="top__r"><a class="bell" href="/notifications" aria-label="알림">${IC.bell}<b class="bell__n" id="bellN" hidden></b></a><button class="top__out" type="button" id="logoutTop">로그아웃</button></div>`) +
    `</div></header>`);
  // 하단 메뉴: 가입·로그인 화면(/join)에는 «로그인» 하나만 가운데에 둔다. 나머지 메뉴는 로그인이 확인된 뒤에만 보인다.
  // 로그인 확인 전(.pending)에는 메뉴를 가리되, 이 브라우저에서 로그인한 적이 있으면(localStorage tt_in) 깜박임 없이 바로 보여 준다.
  const tabPath = /^\/(article|write)$/.test(path) ? "/articles" : path; // 글 보기·글쓰기도 «아티클» 메뉴로 친다
  const tabHtml = ([p, l, ic]) => `<a class="tab" href="${p}"${p === tabPath ? ' aria-current="page"' : ""}><span class="tab__ic">${ic}</span>${l}</a>`;
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

  // 글쓴이(author 가 null 이면 T조 AI), 몇 분 전/며칠 전, 하트 아이콘
  const who = (a) => a || { nickname: "T조 AI", photoUrl: null };
  const ago = (d) => {
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 60) return "방금"; if (s < 3600) return `${Math.floor(s / 60)}분 전`; if (s < 86400) return `${Math.floor(s / 3600)}시간 전`; if (s < 7 * 86400) return `${Math.floor(s / 86400)}일 전`;
    const t = new Date(d); return `${t.getMonth() + 1}월 ${t.getDate()}일`;
  };
  const heart = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20.5C5.5 15.8 3 12.6 3 9.4 3 7 4.8 5.2 7.1 5.2c1.9 0 3.7 1 4.9 2.8 1.2-1.8 3-2.8 4.9-2.8C19.2 5.2 21 7 21 9.4c0 3.2-2.5 6.4-9 11.1Z"/></svg>';
  const bubble = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17h-7l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5Z"/></svg>';
  // 아티클 카드(목록·홈 공용)
  const postCard = (p) => `<li><a class="art" href="/article?id=${p.id}">
    <div class="art__meta"><span class="chip">${esc(p.category)}</span>${p.ai ? `<span class="chip chip--ai">${p.author ? "AI와 함께" : "AI 작성"}</span>` : ""}</div>
    <h3 class="art__title">${esc(p.title)}</h3>
    <p class="art__text">${esc((p.excerpt || "").replace(/\s+/g, " "))}</p>
    <div class="art__foot"><span>${esc(who(p.author).nickname)}</span><span>${ago(p.createdAt)}</span><span class="stat${p.liked ? " stat--on" : ""}">${heart}${p.likes}</span><span class="stat">${bubble}${p.comments}</span></div></a></li>`;
  const TT = (window.TT = { call, esc, initial, avatar, who, ago, heart, bubble, postCard, user: null });
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
  TT.setBell = (n) => { const b = document.getElementById("bellN"); if (!b) return; b.hidden = !n; b.textContent = n > 99 ? "99+" : n; document.querySelector(".bell")?.setAttribute("aria-label", n ? `알림 ${n}개` : "알림"); };
  document.getElementById("logoutTop")?.addEventListener("click", async () => { try { await call("/api/auth?a=logout", "POST", {}); } catch {} location.href = "/join"; });
  // 로그인 상태가 바뀌면 하단 메뉴 아이콘 갱신
  TT.setTabUser = (u) => { const me = document.querySelector('.tab[href="/me"] .tab__ic'); if (me) me.innerHTML = u ? `<span class="tab__av">${avatar(u)}</span>` : TABS[3][2]; };
})();
