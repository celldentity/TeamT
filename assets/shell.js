// 모든 페이지 공통: 상단 메뉴·하단 메뉴 넣기, 스크롤 진행 표시, 로그인 확인(초대장 가입 화면 /join 만 로그인 없이 연다).
// 각 페이지는 <div class="app"> 안 맨 위에서 이 스크립트를 동기로 불러 헤더가 깜박임 없이 먼저 그려지게 한다.
(() => {
  const path = (location.pathname.replace(/\/+$/, "") || "/").replace(/\.html$/, "");
  const GATE = path === "/join";
  const html = document.documentElement;
  html.classList.add("pending");

  // ── 전역 로더: 페이지가 열리는 동안(로그인 확인·첫 데이터 불러오기까지)과 안쪽 링크로 옮겨 가는 동안 마스코트가 콩콩 뛴다.
  // 상단바·하단바는 가리지 않는다(그 사이 본문 자리만 덮는다). 최소 MIN ms 는 떠 있다가 내려간다(너무 번쩍 사라지면 오히려 깜박여 보인다). TT.loader.show()/hide() 로 페이지가 직접 켜고 끌 수도 있다.
  const MIN = 500;   // 최소 0.5초(2026-11-18 요청) — 이보다 빨리 준비돼도 이만큼은 보여 준 뒤 내린다
  let busy = 0, shownAt = Date.now(), offT = 0, failT = 0;   // busy = 진행 중인 서버 호출 수(전부 끝나야 내려간다)
  document.body.insertAdjacentHTML("afterbegin",
    `<div class="gl" id="gl" role="status" aria-label="불러오는 중"><div class="gl__m"><img class="gl__img" src="/assets/icons/icon-v3-192.png" alt="" width="96" height="96" decoding="async"><i class="gl__sh"></i></div>` +
    `<p class="gl__t">불러오는 중<span class="gl__d" aria-hidden="true"><b>.</b><b>.</b><b>.</b></span></p><p class="gl__q" id="glq" aria-hidden="true"></p></div>`);
  const glEl = document.getElementById("gl"), glq = document.getElementById("glq");
  // 로딩 문구(2026-11-19 요청): 직장인에게 힘이 되는 한마디, 또는 요즘 10~20대 말(밈)을 위트 있게 풀어 주는 한 줄. «용어|뜻» 이면 용어를 굵게 보인다.
  // 뜻은 널리 쓰이는 것만 골랐다. 바꾸거나 더할 땐 뜻을 확인하고, 한 줄에 40자를 넘기지 말 것.
  const PHRASES = [
    "오늘도 출근한 당신, 이미 반은 해냈어요.", "잘하고 있어요. 진짜로요.", "어제의 실수는 오늘의 노하우가 됩니다.", "하나만 끝내도 오늘은 성공이에요.",
    "답장이 늦어도 괜찮아요. 사람이 하는 일이니까요.", "일을 못하는 게 아니라 일이 많은 거예요.", "물 한 잔 마시고 어깨 한 번 펴 볼까요?", "퇴근 시간은 반드시 옵니다.",
    "작은 진전도 진전이에요.", "쉬는 것도 일의 일부예요.", "오늘 못 한 일은 내일의 내가 합니다. 더 똑똑한 내가요.", "회의도 끝나고, 월요일도 끝나요.",
    "중꺾그마|중요한 건 꺾이지 않는 마음. 월요일의 필수 스킬", "점메추|점심 메뉴 추천. 인류 최대의 난제", "얼죽아|얼어 죽어도 아이스 아메리카노",
    "갓생|하루를 알차게 사는 삶. 이불 밖은 어렵지만 해냅니다", "내또출|내일 또 출근. 퇴근하자마자 떠오르는 말", "오히려 좋아|망한 일도 긍정으로 바꾸는 주문",
    "스불재|스스로 불러온 재앙. 어제 마감을 미룬 나에게", "억텐|억지로 올린 텐션. 월요일 오전의 인사말", "낄끼빠빠|낄 때 끼고 빠질 때 빠지기. 회식의 정석",
    "사바사|사람 by 사람. 거의 모든 질문의 정답", "현타|현실 자각 타임. 퇴근 직전에 자주 옵니다", "만반잘부|만나서 반가워, 잘 부탁해. 새 팀원의 첫인사",
    "별다줄|별걸 다 줄인다. 이 문구도 곧 줄어들지 몰라요", "킹받네|열받는데 어딘가 웃길 때 쓰는 말", "원영적 사고|안 좋은 일도 «완전 럭키비키잖아!»로 바꿔 생각하기",
    "딸깍|클릭 한 번에 뚝딱 끝나는 것. AI 시대의 소원", "난리자베스|«난리 났다»에 엘리자베스를 붙인 말장난", "파라소셜|나만 일방적으로 친해진 기분. 좋아하는 유튜버처럼",
    "TMI|Too Much Information. 회의에서 가장 자주 나옵니다", "어쩔티비|«어쩌라고»를 돌려 말하는 유행어",
  ];
  let lastQ = -1, qT = 0;
  const showQ = () => {
    let i; do { i = Math.floor(Math.random() * PHRASES.length); } while (i === lastQ && PHRASES.length > 1);
    lastQ = i; const [a, b] = PHRASES[i].split("|");
    glq.classList.remove("is-in"); glq.textContent = "";
    if (b) { const t = document.createElement("b"); t.textContent = a; glq.append(t, " · " + b); } else glq.textContent = a;
    requestAnimationFrame(() => requestAnimationFrame(() => glq.classList.add("is-in")));
  };
  const gl = {
    show() { clearTimeout(offT); clearTimeout(failT); shownAt = Date.now(); glEl.classList.remove("is-off"); showQ(); clearInterval(qT); qT = setInterval(showQ, 2600); },
    hide() { clearTimeout(offT); offT = setTimeout(() => { glEl.classList.add("is-off"); clearInterval(qT); }, Math.max(0, MIN - (Date.now() - shownAt))); },
  };
  showQ(); qT = setInterval(showQ, 2600);
  // 안쪽 페이지로 가는 링크를 누르면(새 탭·다운로드·API 주소·같은 주소 제외) 다음 화면이 뜰 때까지 로더로 덮는다. 뒤로 가기로 되돌아오면(bfcache) 내린다.
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || u.pathname.startsWith("/api/") || (u.pathname === location.pathname && u.search === location.search)) return;
    gl.show();
  });
  addEventListener("pageshow", (e) => { if (e.persisted) gl.hide(); });
  failT = setTimeout(() => gl.hide(), 4000);   // 무슨 일이 있어도 4초 뒤에는 화면을 돌려준다

  const IC = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>',
    doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M8.5 12.5h7M8.5 16h5"/></svg>',
    team: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="f" cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.4-3.2 2.6-5 5.5-5s5.1 1.8 5.5 5"/><circle class="f" cx="17" cy="9.5" r="2.4"/><path d="M16.5 14.7c2.4.2 3.9 1.7 4.3 4.3"/></svg>',
    me: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="f" cx="12" cy="8.5" r="3.6"/><path d="M4.5 20c.6-4 3.5-6.2 7.5-6.2s6.9 2.2 7.5 6.2"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h3M16 8l4 4-4 4M20 12H9"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/></svg>',
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/></svg>',
    present: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 4.5h17M5 4.5v10.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4.5M12 16v4M8.5 20.5h7M9.5 11l2-2.2 1.6 1.6 2.4-2.9"/></svg>',
  };
  const TABS = [["/", "홈", IC.home], ["/articles", "아티클", IC.doc], ["/team", "T조 소개", IC.team], ["/me", "마이페이지", IC.me]];
  const s = document.currentScript;
  s.parentElement.classList.toggle("app--gate", GATE);
  s.insertAdjacentHTML("beforebegin",
    // 상단: 로고 + (로그인한 뒤) 알림·로그아웃. 페이지 메뉴는 하단바에 있어서 중복으로 두지 않는다.
    `<header class="top" id="top"><div class="wrap top__in"><a class="logo" href="/" aria-label="HR T | 니핑 홈">HR T<i>|</i>니핑</a>` +
    (GATE ? "" : `<div class="top__r"><a class="top__out" id="minutesTop" href="/minutes" aria-label="회의록" title="회의록" hidden>${IC.mic}</a><button class="top__out" type="button" id="presentTop" aria-label="발표 시작" title="발표 시작 (전체화면)" hidden>${IC.present}</button><a class="bell" href="/notifications" aria-label="알림">${IC.bell}<b class="bell__n" id="bellN" hidden></b></a><button class="top__out" type="button" id="logoutTop" aria-label="로그아웃" title="로그아웃">${IC.out}</button></div>`) +
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
    busy++;
    try {
      const r = await fetch(url, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "요청에 실패했습니다. 잠시 뒤 다시 시도해 주세요.");
      return j;
    } finally { busy--; }
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
  // 오늘의 질문 · 이번 주 토론 · 토론을 정리한 아티클: 글 종류 칩 + 목록 카드 아래의 지목/진척도 줄
  const SPECIAL = { daily: "오늘의 질문", weekly: "이번 주 토론", digest: "인살롱 후보" };
  const specialChip = (p) => (p.special ? `<span class="chip chip--${p.special}">${SPECIAL[p.special]}</span>` : "");
  const specialLine = (p) => p.special === "daily" && p.target
      ? `<p class="sp sp--daily">지목 ${chip(p.target)} · ${p.answered ? "답변 완료" : p.forMe ? "나에게 온 질문 · 답변 기다리는 중" : "답변 기다리는 중"}</p>`
    : p.special === "weekly" && p.progress
      ? `<div class="sp sp--weekly"><span class="sp__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.progress.pct}"><i style="width:${p.progress.pct}%"></i></span><span class="sp__t">${p.progress.stage === "done" ? "정리 완료" : `의논 진행도 ${Math.min(p.progress.done, p.progress.goal)}/${p.progress.goal} · ${p.progress.pct}%`}</span></div>`
    : "";
  // 아티클 카드(목록·홈 공용): 왼쪽에 분류·글 종류·제목·미리보기, 오른쪽에 대표 사진·동영상 썸네일(있을 때만), 아래 줄에 글쓴이·시각·좋아요·댓글
  const PLAY = '<span class="th__play"><i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg></i></span>';
  const thumb = (c) => (!c ? "" : `<span class="th${c.thumb ? "" : " th--none"}">${c.thumb ? `<img src="/api/media?id=${c.id}&v=thumb" alt="" loading="lazy" decoding="async">` : ""}${c.kind === "video" ? PLAY : ""}${c.n > 1 ? `<span class="th__n" aria-label="파일 ${c.n}개">+${c.n - 1}</span>` : ""}</span>`);
  const postCard = (p) => `<li><a class="art art--${kind(p)}${p.cover ? " art--img" : ""}" href="/article?id=${p.id}">
    <div class="art__main"><div class="art__meta"><span class="chip">${esc(p.category)}</span>${specialChip(p)}${kindChip(p)}</div>
    <h3 class="art__title">${esc(p.title)}</h3>
    <p class="art__text">${esc((p.excerpt || "").replace(/\s+/g, " "))}</p>${specialLine(p)}</div>${thumb(p.cover)}
    <div class="art__foot">${chip(p.author)}<span>${ago(p.createdAt)}</span><span class="stat${p.liked ? " stat--on" : ""}">${heart}${p.likes}</span><span class="stat">${bubble}${p.comments}</span></div></a></li>`;
  const TT = (window.TT = { call, esc, initial, avatar, who, chip, ago, heart, bubble, postCard, kind, kindChip, kindChipOf, specialChip, SPECIAL, user: null, loader: gl });

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
  // 서비스워커 등록(폰 알림·홈 화면 앱에 필요)
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
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
  // 맨 위로 가기 플로팅 버튼(긴 페이지용, 쓰는 쪽이 TT.topBtn() 을 부른다): 조금 내려가면 나타나고, 둘레 링이 «어디까지 읽었는지(%)»를 보여 준다. 누르면 부드럽게 맨 위로.
  TT.topBtn = () => {
    if (document.querySelector(".fab-top")) return;
    const b = document.createElement("button"); b.type = "button"; b.className = "fab-top"; b.hidden = true; b.setAttribute("aria-label", "맨 위로 가기");
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 11.5l6-6 6 6"/></svg>';
    document.body.append(b);
    let tick = false;
    const upd = () => { tick = false; const max = html.scrollHeight - innerHeight, pct = max > 0 ? Math.round(Math.min(1, scrollY / max) * 100) : 0; b.hidden = scrollY < 400; b.style.setProperty("--pct", pct + "%"); b.title = `맨 위로 (지금 ${pct}%)`; };
    addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    b.addEventListener("click", () => scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
    upd();
  };
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
  TT.ready.then((u) => { if (u && !GATE) { TT.push.refresh(); } });
  // 로더 내리기: 로그인 확인 + 화면 뼈대(DOM)가 준비되고, 페이지가 시작한 서버 호출까지 모두 끝나면(첫 틱 뒤에 확인해야 페이지 스크립트가 호출을 시작한 뒤가 된다)
  const settle = () => (busy ? setTimeout(settle, 60) : gl.hide());
  Promise.all([TT.ready, new Promise((r) => (document.readyState !== "loading" ? r() : addEventListener("DOMContentLoaded", r, { once: true })))]).then(() => setTimeout(settle, 0));   // 사진·글꼴이 다 받아질 때까지(load) 기다리지 않는다 — 그게 로더가 오래 떠 있던 주된 이유
  // 발표 버튼: 현재 가입한 5명(users.presenter)에게만 보인다(기기 상관없이). 누르면 /present — 아무 키나 눌러 전체화면으로 시작한다.
  // 마우스를 쓰는 PC 는 화면 크기 팝업(주소창 없는 창)으로, 터치 기기는 같은 탭에서 연다.
  TT.ready.then((u) => {
    const b = document.getElementById("presentTop"), mic = document.getElementById("minutesTop");
    if (!b || !u || !u.presenter) return;
    b.hidden = false; if (mic) mic.hidden = false;   // 회의록(마이크)도 같은 5명에게만
    b.addEventListener("click", () => {
      if (!matchMedia("(hover: hover) and (pointer: fine)").matches) { location.href = "/present"; return; }
      const w = screen.availWidth, h = screen.availHeight;
      const win = window.open("/present", "tt-present", `popup=yes,left=${screen.availLeft || 0},top=${screen.availTop || 0},width=${w},height=${h}`);
      if (win) win.focus(); else location.href = "/present";   // 팝업이 막혔으면 이 탭에서 연다
    });
  });
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
