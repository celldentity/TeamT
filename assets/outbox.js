// 보내는 편지함(outbox) — «저장을 누르면 화면에는 바로 저장된 것처럼 보이고, 실제 저장(DB)은 뒤에서» 하는 장치(2026-11-19 요청).
// 글·댓글·답글을 쓰거나 고치거나 지울 때, 요청을 이 편지함에 넣고 화면은 곧바로 «저장된 모습»으로 바꾼다. 편지함이 서버로 하나씩 순서대로 보낸다.
//  · 편지함은 localStorage 에 있어서, 보내는 중에 다른 페이지로 옮겨 가도·앱을 닫아도 다음에 열 때(shell.js 가 불러온다) 이어서 보낸다.
//  · 네트워크가 끊기거나 서버가 5xx 를 주면 조금씩 늦춰 가며 다시 보낸다(서버는 cid 로 같은 글·댓글을 두 번 만들지 않는다 — api/posts.js·comments.js).
//  · 서버가 «안 된다»(4xx)고 하면 «실패» 로 남겨 화면이 알리게 한다(다시 시도/버리기).
//  · 사진·동영상 파일 자체는 여기서 올리지 않는다 — 글쓰기·댓글 화면에서 이미 R2 에 올린 파일의 번호만 보낸다(올리는 중이면 그게 끝난 뒤에 보낸다).
// 쓰는 쪽: write.html(글 쓰기·수정) · article.html(댓글, 글 삭제·수정 반영) · articles.html·index.html(목록 합치기: TT.outbox.merge).
(() => {
  if (window.TT && TT.outbox) return;
  const uid = () => (TT.user && TT.user.id) || 0, KEY = () => "tt_ob_" + uid(), DONE = () => "tt_obd_" + uid();
  const TAB = Math.random().toString(36).slice(2, 8), LOCK = "tt_ob_lock";
  let q = [], running = false;
  const subs = new Set();
  const read = () => { try { q = JSON.parse(localStorage.getItem(KEY()) || "[]"); if (!Array.isArray(q)) q = []; } catch { q = []; } return q; };
  const write = () => { try { localStorage.setItem(KEY(), JSON.stringify(q)); } catch {} };
  const emit = (type, item, extra) => subs.forEach((fn) => { try { fn({ type, item, ...extra }); } catch (e) { console.error("outbox listener", e); } });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // 글을 만든 요청(oid)이 끝나면 «oid → 진짜 글 번호» 를 한 시간 동안 기억해 둔다(펜딩 화면의 주소로 다시 들어와도 진짜 글로 안내하려고)
  const rememberDone = (oid, id) => { try { const m = JSON.parse(localStorage.getItem(DONE()) || "{}"), now = Date.now(); for (const k of Object.keys(m)) if (now - m[k].t > 36e5) delete m[k]; m[oid] = { id, t: now }; localStorage.setItem(DONE(), JSON.stringify(m)); } catch {} };
  const doneId = (oid) => { try { const v = JSON.parse(localStorage.getItem(DONE()) || "{}")[oid]; return v ? v.id : 0; } catch { return 0; } };

  // 한 탭만 보내게(탭 둘이 같은 편지함을 동시에 보내 중복되지 않도록). 잠금은 15초 안에 갱신되지 않으면 풀린 것으로 본다.
  const lockOK = () => { try { const l = JSON.parse(localStorage.getItem(LOCK) || "null"), now = Date.now(); if (l && l.tab !== TAB && now - l.t < 15000) return false; localStorage.setItem(LOCK, JSON.stringify({ tab: TAB, t: now })); return true; } catch { return true; } };

  async function post(it) {
    let r;
    try { r = await fetch(it.url, { method: it.method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: it.method === "DELETE" ? "{}" : JSON.stringify(it.body) }); }
    catch { throw { retry: true, message: "인터넷 연결을 확인하고 있어요." }; }
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j;
    if (r.status === 404 && it.method === "DELETE") return {};            // 이미 지워진 것을 또 지우라는 요청은 성공으로 본다
    if (r.status >= 500 || r.status === 429) throw { retry: true, message: j.error || "서버가 잠시 바빠요." };
    throw { retry: false, message: j.error || "저장하지 못했어요." };
  }

  async function run() {
    if (running) return; running = true;
    try {
      for (;;) {
        read(); const it = q.find((x) => x.state !== "fail");
        if (!it) break;
        if (!lockOK()) { await sleep(3000); continue; }
        try {
          const res = await post(it);
          read(); q = q.filter((x) => x.oid !== it.oid); write();
          if (it.kind === "post" && res && res.id) rememberDone(it.oid, res.id);
          emit("done", it, { result: res || {} });
        } catch (e) {
          read(); const cur = q.find((x) => x.oid === it.oid); if (!cur) continue;
          cur.tries = (cur.tries || 0) + 1;
          if (e && e.retry && cur.tries <= 8) { write(); await sleep(Math.min(30000, 1500 * 2 ** (cur.tries - 1))); continue; }
          cur.state = "fail"; cur.err = (e && e.message) || "저장하지 못했어요."; write(); emit("fail", cur);
          TT.toast && TT.toast("저장하지 못한 내용이 있어요. " + cur.err);
        }
      }
    } finally { running = false; }
  }

  const api = TT.outbox = {
    // op: {kind: post|post-edit|post-del|comment|comment-edit|comment-del, url, method, body?, postId?, commentId?, view?}. opts.defer: true 면 지금은 보내지 않는다(곧 다른 페이지로 넘어가는 경우 — 새 페이지가 이어서 보낸다)
    add(op, opts = {}) {
      read(); const it = { oid: rid(), at: Date.now(), tries: 0, state: "wait", ...op };
      if ((it.kind === "post" || it.kind === "comment") && it.body) it.body = { ...it.body, cid: it.oid };
      q.push(it); write(); emit("add", it);
      if (!opts.defer) run();
      return it.oid;
    },
    list() { return read().slice(); },
    get(oid) { return read().find((x) => x.oid === oid) || null; },
    doneId,
    retry(oid) { read(); const it = q.find((x) => x.oid === oid); if (it) { it.state = "wait"; it.tries = 0; it.err = ""; write(); run(); } },
    drop(oid) { read(); q = q.filter((x) => x.oid !== oid); write(); emit("drop", { oid }); },
    start() { run(); },
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    pendingCount() { return read().filter((x) => x.state !== "fail").length; },

    // 목록(아티클·홈)에 «아직 저장 중인» 변경을 겹쳐서 돌려준다: 새 글은 맨 위에, 고친 글은 고친 모습으로, 지운 글은 뺀다.
    merge(posts, me) {
      let out = posts.slice();
      for (const it of read()) {
        if (it.kind === "post-del") out = out.filter((p) => p.id !== it.postId);
        else if (it.kind === "post-edit") out = out.map((p) => (p.id === it.postId ? { ...p, category: it.view.category, title: it.view.title, excerpt: it.view.body.slice(0, 160), ai: it.view.ai, cover: coverOf(it.view.media) || null } : p));
      }
      const mine = read().filter((x) => x.kind === "post" && x.state !== "fail").map((it) => ({
        id: 0, href: "/article?p=" + it.oid, category: it.view.category, title: it.view.title, excerpt: it.view.body.slice(0, 160), ai: !!it.view.ai, author: me,
        createdAt: new Date(it.at).toISOString(), updatedAt: null, likes: 0, liked: false, comments: 0, mine: true, special: null, target: null, forMe: false, progress: null, ref: null, cover: coverOf(it.view.media) || null,
      }));
      return mine.reverse().concat(out);
    },
  };
  const coverOf = (ms) => (ms && ms.length ? { id: ms[0].id, kind: ms[0].kind, thumb: !!ms[0].thumb, n: ms.length } : null);

  // 다른 탭이 보낸 결과도 이 탭 화면에 반영되도록
  addEventListener("storage", (e) => { if (e.key === KEY()) emit("sync", null); });
  addEventListener("online", () => run());
  TT.ready.then(() => { if (read().length) run(); });   // 로그인 확인이 끝난 뒤(사람 번호를 알아야 그 사람의 편지함을 연다) 남아 있는 것을 이어서 보낸다
})();
