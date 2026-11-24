// 피드(아티클 안의 «피드» 탭): 팀원이 일상·정보·사진을 직접 올리는 곳. 쓰는 곳: articles.html.
//   TT.feed.card(p) → 카드 <li> HTML · TT.feed.bind(root, {onLike}) → 캐러셀(가로로 넘겨 보기)·좋아요·«더 보기» 글줄임을 한 번 묶어 둔다
// 사진·동영상은 합쳐 10개(동영상 2개·개당 100MB, api/_media.js)이고 섞여서 한 캐러셀에 나온다.
(() => {
  const url = (x, v) => `/api/media?id=${x.id}&v=${v}`;
  // 캐러셀 칸의 가로세로 비율 = 첫 사진·동영상의 비율(너무 길거나 납작하면 세로 9:16 ~ 가로 16:9 로 제한). 그래서 보통은 검은 띠도, 잘리는 부분도 없다.
  // 크기를 모르면(저장 중인 글 등) 정사각.
  const ratio = (x) => (x && x.w > 0 && x.h > 0 ? x.w / x.h : 0);
  const frame = (ms) => Math.min(16 / 9, Math.max(9 / 16, ratio(ms && ms[0]) || 1));
  const slide = (x, i, fr) => {
    if (x.kind === "video") {
      const r = ratio(x) || fr, same = Math.abs(r / fr - 1) < 0.25;   // 칸과 비율이 비슷하면 꽉 채우고, 많이 다르면(섞어 올린 경우) 잘리지 않게 전체를 보여 준다
      const square = Math.abs(r - 1) < 0.1 && x.thumb;                  // 대표 장면 썸네일은 정사각이라 정사각 영상에만 쓰고, 나머지는 첫 장면(#t)을 그대로 보여 준다
      return `<div class="gal__it gal__it--v"><video controls playsinline preload="metadata" style="object-fit:${same ? "cover" : "contain"}"${square ? ` poster="${url(x, "thumb")}"` : ""} src="${url(x, "full")}${square ? "" : "#t=0.1"}"></video></div>`;
    }
    return `<div class="gal__it"><img src="${url(x, "full")}" alt="" ${i ? 'loading="lazy" ' : ""}decoding="async"></div>`;
  };

  function card(p) {
    const a = TT.who(p.author), ms = p.media || [], n = ms.length, fr = frame(ms);
    const car = !n ? "" : `<div class="fd__car"><div class="gal fd__gal" style="--fr:${fr}" role="group" aria-label="사진·동영상 ${n}개" tabindex="0">${ms.map((x, i) => slide(x, i, fr)).join("")}</div>${n > 1
      ? `<span class="fd__n" aria-live="polite">1 / ${n}</span><button class="fd__nav fd__nav--p" type="button" data-nav="-1" aria-label="이전">‹</button><button class="fd__nav fd__nav--n" type="button" data-nav="1" aria-label="다음">›</button><div class="fd__dots" aria-hidden="true">${ms.map((_, i) => `<i${i ? "" : ' class="on"'}></i>`).join("")}</div>` : ""}</div>`;
    const bar = p.pending ? '<span class="fd__saving">저장 중…</span>'
      : `<button class="fd__act fd__like${p.liked ? " is-on" : ""}" type="button" aria-pressed="${!!p.liked}" aria-label="좋아요">${TT.heart}<span>${p.likes}</span></button><a class="fd__act" href="/article?id=${p.id}" aria-label="댓글 ${p.comments}개">${TT.bubble}<span>${p.comments}</span></a>`;
    return `<li class="fd" data-id="${p.id}"><div class="fd__top"><span class="by__av">${TT.avatar(a)}</span><div><p class="by__name">${TT.esc(a.nickname)}</p><p class="by__time">${TT.when(p.createdAt)}${p.updatedAt ? " · 수정됨" : ""}</p></div></div>${car}${p.body ? `<p class="fd__txt">${TT.esc(p.body)}</p>` : ""}<div class="fd__bar">${bar}</div></li>`;
  }

  // 글이 길어 잘렸으면(5줄 넘음) «더 보기» 를 붙인다. 목록을 다시 그린 뒤마다 부른다.
  // 글꼴이 로드돼 줄바꿈이 정해진 뒤에 재서, 넘치는 글에만 붙이고 넘치지 않으면 뗀다(글꼴 로드 전 폭으로 재면 잘못 붙는다).
  function clamp(root) {
    const run = () => root.querySelectorAll(".fd__txt:not(.is-open)").forEach((t) => {
      const over = t.scrollHeight > t.clientHeight + 1, b = t.nextElementSibling && t.nextElementSibling.classList.contains("fd__more") ? t.nextElementSibling : null;
      if (over && !b) { const x = document.createElement("button"); x.type = "button"; x.className = "fd__more"; x.textContent = "더 보기"; t.after(x); }
      else if (!over && b) b.remove();
    });
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(run));
  }

  function bind(root, opt = {}) {
    const stride = (g) => (g.children.length > 1 ? g.children[1].offsetLeft - g.children[0].offsetLeft : g.clientWidth);
    root.addEventListener("scroll", (e) => {   // scroll 은 거품이 일지 않아 캡처 단계에서 듣는다
      const g = e.target; if (!g.classList || !g.classList.contains("fd__gal")) return;
      const i = Math.max(0, Math.min(g.children.length - 1, Math.round(g.scrollLeft / stride(g))));
      const car = g.parentElement, n = car.querySelector(".fd__n");
      if (n) n.textContent = `${i + 1} / ${g.children.length}`;
      car.querySelectorAll(".fd__dots i").forEach((d, k) => d.classList.toggle("on", k === i));
      [...g.children].forEach((c, k) => { if (k !== i) { const v = c.querySelector("video"); if (v && !v.paused) v.pause(); } });   // 넘어가면 지나친 동영상은 멈춘다
    }, true);

    const wait = new Map();   // 글 번호 → 아직 서버가 처리 못 한 좋아요 요청 수(서버가 누를 때마다 켜고 끄는 토글이라 요청은 순서대로 하나씩)
    const chain = new Map();
    const paint = (id, on, n) => { const b = root.querySelector(`.fd[data-id="${id}"] .fd__like`); if (!b) return; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on); b.querySelector("span").textContent = n; };
    function like(b) {
      const id = Number(b.closest(".fd").dataset.id), was = b.getAttribute("aria-pressed") === "true", n = Number(b.querySelector("span").textContent) || 0;
      paint(id, !was, Math.max(0, n + (was ? -1 : 1)));
      wait.set(id, (wait.get(id) || 0) + 1);
      const run = (chain.get(id) || Promise.resolve()).then(() => TT.call("/api/likes", "POST", { type: "p", id })).then((r) => {
        wait.set(id, wait.get(id) - 1);
        if (!wait.get(id)) { paint(id, r.liked, r.count); opt.onLike && opt.onLike(id, r.liked, r.count); }
      }, () => { wait.set(id, wait.get(id) - 1); paint(id, was, n); TT.toast && TT.toast("좋아요를 저장하지 못했어요."); });
      chain.set(id, run);
    }
    root.addEventListener("click", (e) => {
      const nav = e.target.closest("[data-nav]");
      if (nav) { const g = nav.parentElement.querySelector(".fd__gal"); g.scrollBy({ left: Number(nav.dataset.nav) * stride(g), behavior: "smooth" }); return; }
      const more = e.target.closest(".fd__more");
      if (more) { more.previousElementSibling.classList.add("is-open"); more.remove(); return; }
      const lk = e.target.closest(".fd__like"); if (lk) like(lk);
    });
  }

  window.TT.feed = { card, clamp, bind, frame };
})();
