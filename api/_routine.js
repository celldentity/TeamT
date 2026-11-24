// 매일·매주 루틴: 오늘의 질문(한 사람 지목) · 이번 주 토론 · 토론이 100% 가 되면 Claude 가 정리. 파일명이 _ 로 시작해 라우트로 노출되지 않는다.
// 호출은 api/cron.js 가 한다(Vercel 크론). 모든 단계는 «같은 날·같은 상태에서 두 번 돌려도 한 번만 일하게» 만들어 뒀다.
const L = require("./_lib");
const AI = require("./_ai");
const Q = require("./_qbank");
const Push = require("./_push");
const H = require("./_holidays");
const Img = require("./_qimg");
const P = require("./_points");

const GOAL = P.WEEKLY_GOAL;      // 주간 토론: 서로 다른 팀원이 이만큼 의견을 남기면 진척도 100%(예전 글의 posts.goal=10 은 무시하고 이 값을 쓴다)
const MORE_COMMENTS = 3;         // AI 가 반문한 뒤 이만큼 댓글이 더 달리면 다음 단계로
const MAX_ROUNDS = 3;            // AI 가 반문하는 최대 차례(마지막 차례에는 어떻게든 글로 정리한다)
// 요일마다 질문 종류가 돌아간다(공휴일로 그날이 쉬면 그 종류는 그냥 건너뛴다): 월 커리어 · 화 HR · 수 상식 · 목 HR · 금 일상(가벼운 질문)
const TYPE_BY_DOW = { 1: "커리어", 2: "HR", 3: "상식", 4: "HR", 5: "일상" };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// 한국 시각 기준 날짜(YYYY-MM-DD)와 그 주 월요일, 요일(0=일)
const kstNow = (now = new Date()) => new Date(now.getTime() + 9 * 36e5);
const ymd = (d) => d.toISOString().slice(0, 10);
const mondayOf = (k) => ymd(new Date(k.getTime() - ((k.getUTCDay() + 6) % 7) * 864e5));

// ── 오늘의 질문: 이번 주에 아직 안 걸린 사람 중, 가장 오래전에 걸렸던(안 걸렸던) 사람을 무작위로 ──
async function pickMember(db, date) {
  const [users] = await db.query("SELECT id, nickname FROM users ORDER BY id");
  if (!users.length) return null;
  const mon = mondayOf(new Date(date + "T00:00:00Z"));
  const [rows] = await db.query("SELECT target_id, MAX(qdate) AS last, SUM(qdate >= ?) AS this_week FROM posts WHERE kind = 'daily' AND target_id IS NOT NULL GROUP BY target_id", [mon]);
  const by = new Map(rows.map((r) => [r.target_id, { last: r.last ? ymd(new Date(r.last)) : "", week: Number(r.this_week) > 0 }]));
  let pool = users.filter((u) => !(by.get(u.id) || {}).week);          // 이번 주에 이미 걸린 사람은 뺀다
  if (!pool.length) pool = users;                                     // 가입자가 요일 수보다 적으면 한 바퀴 돈 뒤 다시
  const lastOf = (u) => (by.get(u.id) || {}).last || "";
  const oldest = pool.reduce((m, u) => (lastOf(u) < m ? lastOf(u) : m), "9999");
  return pick(pool.filter((u) => lastOf(u) === oldest));               // 가장 오래 안 걸린 사람들 중 무작위
}

async function newQuestion(db, kind, date) {
  // 예전에 올라간 모든 제목(마지막으로 쓴 글 번호와 함께) — 은행이 바닥나기 전에는 한 번 쓴 질문을 다시 쓰지 않는다
  const [past] = await db.query("SELECT title, MAX(id) AS last FROM posts WHERE kind = ? GROUP BY title", [kind]);
  const lastOf = new Map(past.map((r) => [r.title, Number(r.last)]));
  const type = kind === "daily" ? TYPE_BY_DOW[H.dow(date)] || pick(["HR", "커리어", "상식", "일상"]) : "토론";
  if (AI.enabled()) {
    try {
      const recent = [...lastOf].sort((x, y) => y[1] - x[1]).slice(0, 40).map((x) => x[0]);
      const cats = L.CATS.join("|");
      const sys = kind === "daily"
        ? "당신은 HR 스터디 모임 «T조»의 질문 큐레이터입니다. 모임 구성원 한 명을 지목해 아침에 가볍게 건넬 질문을 한국어로 하나 만드세요. 종류는 지시된 것을 따릅니다(HR: 채용·온보딩·조직문화·평가·교육 경험, 커리어: 일하는 방식·성장·선택, 상식: 근로·인사·직장 생활에서 알아두면 좋은 사실이나 시사, 일상: 출근길·점심·취미 같은 편한 잡담). 질문은 한 문장(80자 이내)이고 3~5문장 안에 답할 수 있어야 하며, 정답을 맞히는 퀴즈보다 경험과 생각을 묻는 편이 좋습니다. 급여 액수, 나이, 결혼·가족, 종교, 정치, 건강처럼 답하기 불편한 소재는 쓰지 않습니다. 최근 질문과 겹치면 안 됩니다. 마크다운 기호를 쓰지 말고 JSON 한 개만 출력하세요: {\"category\":\"" + cats + " 중 하나\",\"title\":\"질문\",\"body\":\"질문의 배경이나 답하는 힌트 1~2문장\"}"
        : "당신은 HR 스터디 모임 «T조»의 토론 진행자입니다. 팀원 5명이 일주일 동안 댓글로 의논할 «구체적인 상황» 하나를 한국어로 만드세요. 추상적인 주제(예: AI 시대의 HR)가 아니라, 가상의 회사·팀에서 벌어진 장면을 인원수·기한·이해관계 같은 숫자와 제약을 넣어 3~5문장으로 묘사하고, 사회생활·사무직·HR 현장에서 정말 겪는 딜레마(공정성과 성과, 규정과 사람, 상사와 나의 입장, 거절과 관계 등)가 걸려 있어야 합니다. 제목은 80자 이내의 질문 한 문장(예: «~라면 어떻게 하시겠어요?»), 본문 끝에 «이렇게 이야기해 보면 좋아요: 1) 내가 담당자라면 어떤 순서로 풀어 갈지 2) 비슷한 상황을 겪었거나 지켜봤다면 어떻게 지나왔는지 3) 이때 절대 하지 말아야 할 한 가지» 를 넣으세요. 실제 사람·회사 이름, 개인정보는 쓰지 않습니다. 최근 주제와 겹치면 안 됩니다. 마크다운 기호를 쓰지 말고 JSON 한 개만 출력하세요: {\"category\":\"" + cats + " 중 하나\",\"title\":\"주제\",\"body\":\"상황 묘사와 이야기 방법\"}";
      const out = AI.json(await AI.ask({ system: sys, user: `종류: ${type}\n최근 ${kind === "daily" ? "질문" : "주제"}:\n${recent.slice(0, 25).map((t) => "- " + t).join("\n") || "(없음)"}`, max: 900 }));
      const title = String(out.title || "").trim(), body = String(out.body || "").trim();
      if (L.len(title) >= 2 && L.len(title) <= 80 && L.CATS.includes(out.category) && !lastOf.has(title) && (kind === "daily" || L.len(body) >= 80)) return { category: out.category, title, body: kind === "daily" ? body + "\n\n편하게 3~5문장으로 답해 주세요. 정답은 없어요." : body, type, from: "claude" };
    } catch (e) { console.error("question ai", e.message); }
  }
  const all = kind === "daily" ? Q.DAILY : Q.WEEKLY;
  let pool = kind === "daily" ? all.filter((q) => q.type === type) : all;
  if (!pool.length) pool = all;
  const fresh = pool.filter((q) => !lastOf.has(q.title));
  // 안 쓴 게 남아 있으면 그중 무작위, 바닥났으면 가장 오래전에 쓴 것부터 다시
  const q = fresh.length ? pick(fresh) : pool.reduce((m, x) => (lastOf.get(x.title) < lastOf.get(m.title) ? x : m));
  return { id: q.id, category: q.category, title: q.title, body: q.body, type, from: "bank" };
}

async function makeDaily(db, now = new Date()) {
  const k = kstNow(now), date = ymd(k), dow = k.getUTCDay();
  if (!H.isBusinessDay(date)) return { skipped: dow === 0 || dow === 6 ? "주말" : "공휴일" };
  const [ex] = await db.query("SELECT id FROM posts WHERE kind = 'daily' AND qdate = ?", [date]);
  if (ex[0]) return { skipped: "이미 있음", id: ex[0].id };
  // 미리 예약된 질문(daily_plan)이 있으면 그 사람·그 질문으로, 없으면 자동으로 뽑는다
  const [[plan]] = await db.query("SELECT p.target_id, p.category, p.title, p.body, u.nickname FROM daily_plan p JOIN users u ON u.id = p.target_id WHERE p.qdate = ?", [date]);
  const who = plan ? { id: plan.target_id, nickname: plan.nickname } : await pickMember(db, date);
  if (!who) return { skipped: "가입자 없음" };
  const q = plan ? { category: plan.category, title: plan.title, body: plan.body, from: "plan" } : await newQuestion(db, "daily", date);
  let id;
  try {
    const [r] = await db.query("INSERT INTO posts (author_id, ai, category, title, body, kind, target_id, qdate) VALUES (NULL, 1, ?, ?, ?, 'daily', ?, ?)", [q.category, q.title, q.body, who.id, date]);
    id = r.insertId;
  } catch (e) { if (e.code === "ER_DUP_ENTRY") return { skipped: "이미 있음" }; throw e; }   // 동시에 두 번 불려도 한 번만
  const img = await Img.attachFor(db, id, q, "daily");   // 질문에 맞는 일러스트(없으면 같은 분류의 다른 그림, 그래도 없으면 그림 없이)
  const push = await Push.notify([who.id], () => ({ title: "미드핑이 오늘의 질문을 보냈어요", icon: "/assets/miding.jpg", body: q.title, url: `/article?id=${id}`, tag: `daily-${date}`, badge: "auto" })).catch((e) => ({ error: e.message }));
  return { id, date, target: who.nickname, from: q.from, type: q.type, title: q.title, img, push, ...(H.covered(date) ? {} : { note: "공휴일 정보 없음(주말만 쉼)" }) };
}

async function makeWeekly(db, now = new Date()) {
  const k = kstNow(now), mon = mondayOf(k);
  if (!H.isFirstBusinessDay(ymd(k))) return { skipped: "그 주의 첫 영업일이 아님" };   // 월요일이 공휴일이면 화요일에
  const [ex] = await db.query("SELECT id FROM posts WHERE kind = 'weekly' AND qdate = ?", [mon]);
  if (ex[0]) return { skipped: "이미 있음", id: ex[0].id };
  const q = await newQuestion(db, "weekly", ymd(k));
  let id;
  try {
    const [r] = await db.query("INSERT INTO posts (author_id, ai, category, title, body, kind, qdate, goal, stage) VALUES (NULL, 1, ?, ?, ?, 'weekly', ?, ?, 'open')", [q.category, q.title, q.body, mon, GOAL]);
    id = r.insertId;
  } catch (e) { if (e.code === "ER_DUP_ENTRY") return { skipped: "이미 있음" }; throw e; }
  const img = await Img.attachFor(db, id, q, "weekly");
  const push = await Push.notify(null, () => ({ title: "미드핑이 이번 주 토론 주제를 가져왔어요", icon: "/assets/miding.jpg", body: q.title, url: `/article?id=${id}`, tag: `weekly-${mon}`, badge: "auto" })).catch((e) => ({ error: e.message }));
  return { id, week: mon, from: q.from, title: q.title, img, push };
}

// ── 토론 정리: 100% → Claude 가 요약·반문 → 댓글이 더 달리면 다시 판단 → 글로 정리 ──
const humanCount = async (db, postId, since) => {
  const [r] = await db.query("SELECT COUNT(*) AS n FROM comments WHERE post_id = ? AND deleted = 0 AND author_id IS NOT NULL" + (since ? " AND created_at > ?" : ""), since ? [postId, since] : [postId]);
  return Number(r[0].n);
};
const peopleCount = async (db, postId) => {
  const [r] = await db.query("SELECT COUNT(DISTINCT author_id) AS n FROM comments WHERE post_id = ? AND deleted = 0 AND author_id IS NOT NULL", [postId]);
  return Number(r[0].n);
};
async function thread(db, postId) {
  const [cs] = await db.query("SELECT c.body, u.nickname FROM comments c LEFT JOIN users u ON u.id = c.author_id WHERE c.post_id = ? AND c.deleted = 0 ORDER BY c.created_at, c.id", [postId]);
  return cs.map((c) => `[${c.nickname || "미드핑"}] ${String(c.body).replace(/\s+/g, " ")}`).join("\n").slice(-14000);
}
const SYS = "당신은 HR 스터디 모임 «T조»의 AI 진행자 «미드핑»입니다(라벤더색 몸에 축구공을 안은 귀여운 마스코트). 스스로를 가리킬 때는 «미드핑»이라고 부르세요. 팀원들이 주제에 대해 댓글로 나눈 이야기를 읽고 돕습니다. 팀원의 의견을 왜곡하거나 지어내지 말고, 닉네임은 그대로 쓰세요. 마크다운 기호(#, *, -, 번호 목록 기호)를 쓰지 말고 일반 문장으로 쓰세요. 반드시 JSON 한 개만 출력하세요.";

async function aiComment(db, postId, body) {
  const [r] = await db.query("INSERT INTO comments (post_id, parent_id, author_id, body) VALUES (?, NULL, NULL, ?)", [postId, String(body).slice(0, 3900)]);
  return r.insertId;
}

async function wrapOne(db, post) {
  const h = (ts) => (ts ? (Date.now() - new Date(ts).getTime()) / 36e5 : 1e9);
  if (post.ai_try_at && h(post.ai_try_at) < 0.5) return { id: post.id, skipped: "최근에 시도함" };
  const topic = `주제: ${post.title}\n${post.body}`;

  if (post.stage === "open") {
    if ((await peopleCount(db, post.id)) < GOAL) return { id: post.id, skipped: "진척도 100% 아님" };
    await db.query("UPDATE posts SET ai_try_at = NOW() WHERE id = ?", [post.id]);
    const out = AI.json(await AI.ask({ system: SYS, max: 1500,
      user: `${topic}\n\n지금까지의 댓글:\n${await thread(db, post.id)}\n\n해야 할 일: (1) 지금까지 나온 의견을 3~5문장으로 요약하세요. (2) 아직 부족하거나 의견이 엇갈리는 지점을 짚어 추가 질문 또는 반문을 2~3개 만드세요.\n출력: {"summary":"요약","questions":["질문1","질문2"]}` }));
    const qs = (out.questions || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
    if (!out.summary || !qs.length) throw new Error("요약 형식이 올바르지 않아요.");
    const cid = await aiComment(db, post.id, `${GOAL}명이 의견을 남겨서 지금까지의 이야기를 정리해 볼게요.\n\n${String(out.summary).trim()}\n\n더 이야기해 보면 좋을 질문이에요.\n${qs.map((q, i) => `${i + 1}. ${q}`).join("\n")}`);
    await db.query("UPDATE posts SET stage = 'review', ai_round = 1, ai_at = NOW() WHERE id = ?", [post.id]);
    const push = await Push.notify(null, () => ({ title: "미드핑이 토론을 정리하고 질문을 남겼어요", icon: "/assets/miding.jpg", body: post.title, url: `/article?id=${post.id}#c${cid}`, tag: `wrap-${post.id}-1`, badge: "auto" })).catch(() => null);
    return { id: post.id, step: "summary", push };
  }

  if (post.stage === "review") {
    const fresh = await humanCount(db, post.id, post.ai_at), waited = h(post.ai_at);
    if (!(fresh >= MORE_COMMENTS || (fresh >= 1 && waited >= 24) || waited >= 72)) return { id: post.id, skipped: "더 기다리는 중", fresh };
    await db.query("UPDATE posts SET ai_try_at = NOW() WHERE id = ?", [post.id]);
    const last = post.ai_round >= MAX_ROUNDS || waited >= 72;
    const out = AI.json(await AI.ask({ system: SYS, max: 4000,
      user: `${topic}\n\n지금까지의 댓글(마지막 AI 댓글 이후 사람이 ${fresh}개 더 달았어요):\n${await thread(db, post.id)}\n\n해야 할 일: 이 토론이 «인살롱(HR 커뮤니티)에 올려도 될 정도의 글»이 될 만큼 충분히 모였는지 판단하세요. 기준은 서로 다른 관점, 근거나 사례, 실무에 쓸 수 있는 결론입니다.${last ? " 이번이 마지막 차례이므로 부족한 점이 있어도 지금까지의 내용으로 글을 정리하세요(ready 는 true)." : ""}\n충분하면 글로 정리하세요: 제목 80자 이내, 분류는 ${L.CATS.join("/")} 중 하나, 본문은 1500~3500자로 도입-관점별 정리-결론과 실무 팁 순서의 일반 글(소제목은 한 줄 문장으로), 토론에 참여한 닉네임을 자연스럽게 언급하세요. 또한 포인트 가산점을 위해, 이 대화의 흐름을 이끌었거나 결론을 내는 데 «핵심적인 역할»을 한 팀원을 최대 ${P.RULES.KEY_MAX}명 고르세요(댓글 수가 아니라 기여의 질로 판단: 새로운 관점·근거나 사례를 보탰거나, 엇갈린 의견을 조율했거나, 결론의 뼈대를 만든 사람. 닉네임은 댓글에 적힌 그대로, 이유는 한 문장. 마땅한 사람이 없으면 빈 배열).\n부족하면 추가 질문 1~2개를 만드세요.\n출력(충분): {"ready":true,"title":"제목","category":"분류","body":"본문","key":[{"nickname":"닉네임","reason":"한 문장 이유"}]}\n출력(부족): {"ready":false,"questions":["질문1"]}` }));
    if (out.ready || last) {
      const title = String(out.title || post.title).trim().slice(0, 80), body = String(out.body || "").trim().slice(0, 4900), cat = L.CATS.includes(out.category) ? out.category : post.category;
      if (L.len(body) < 10) throw new Error("정리된 글이 너무 짧아요.");
      const [r] = await db.query("INSERT INTO posts (author_id, ai, category, title, body, kind, ref_post_id) VALUES (NULL, 1, ?, ?, ?, 'digest', ?)", [cat, title, body, post.id]);
      await db.query("UPDATE posts SET stage = 'done', ref_post_id = ? WHERE id = ?", [r.insertId, post.id]);
      await Img.attachFromPost(db, r.insertId, post.id);   // 정리한 글에도 토론 글의 그림을 붙인다
      // 포인트 정산(참여·댓글 최다·Claude 가 고른 핵심 역할). 실패해도 정리 글은 이미 올라갔으니 로그만 남긴다(scripts/points_admin.js 로 다시 정산할 수 있다)
      let pts = null;
      try { pts = await P.settleWeek(db, post, out.key); } catch (e) { console.error("settle", post.id, e.message); }
      const R = P.RULES, ptsNote = pts && Object.keys(pts.gave).length
        ? `\n\n포인트도 드렸어요. 댓글을 남긴 분께 참여 +${R.JOIN}${pts.top.length ? `, 의미 있는 댓글을 가장 많이 남긴 ${pts.top.join("·")}님께 +${R.TOP}` : ""}${pts.key.length ? `, 대화의 흐름과 결론에 핵심 역할을 한 분께 가산점 +${R.KEY}` : ""}.${pts.key.length ? "\n" + pts.key.map((k) => `· ${k.nickname}님 — ${k.reason || "핵심 역할"}`).join("\n") : ""}`
        : "";
      const cid = await aiComment(db, post.id, `이야기가 충분히 모여서 아티클로 정리했어요. 인살롱에 올려도 좋은지 한 번씩 읽어 보고 고칠 곳이 있으면 알려 주세요.\n\n정리된 글: «${title}»${ptsNote}`);
      const push = await Push.notify(null, () => ({ title: "미드핑이 토론을 아티클로 정리했어요", icon: "/assets/miding.jpg", body: title, url: `/article?id=${r.insertId}`, tag: `digest-${post.id}`, badge: "auto" })).catch(() => null);
      if (pts) await Push.notify(Object.keys(pts.gave).map(Number), (uid) => ({ title: `토론 포인트 +${pts.gave[uid].pts}점이 들어왔어요`, body: pts.gave[uid].parts.join(" · "), url: "/me", tag: `pts-${post.id}`, badge: "auto" })).catch(() => null);
      return { id: post.id, step: "digest", digest: r.insertId, push, cid, points: pts && Object.fromEntries(Object.entries(pts.gave).map(([u, v]) => [u, v.pts])) };
    }
    const qs = (out.questions || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 2);
    if (!qs.length) throw new Error("반문이 비어 있어요.");
    const cid = await aiComment(db, post.id, `이야기를 이어서 보니 아직 정리하기엔 조금 부족해요. 아래 질문도 같이 생각해 볼까요?\n${qs.map((q, i) => `${i + 1}. ${q}`).join("\n")}`);
    await db.query("UPDATE posts SET ai_round = ai_round + 1, ai_at = NOW() WHERE id = ?", [post.id]);
    const push = await Push.notify(null, () => ({ title: "미드핑이 질문을 더 남겼어요", icon: "/assets/miding.jpg", body: post.title, url: `/article?id=${post.id}#c${cid}`, tag: `wrap-${post.id}-${post.ai_round + 1}`, badge: "auto" })).catch(() => null);
    return { id: post.id, step: "followup", push };
  }
  return { id: post.id, skipped: "처리할 단계 아님" };
}

async function wrap(db) {
  if (!AI.enabled()) return { skipped: "ANTHROPIC_API_KEY 가 없어요(토론 정리는 Claude 가 연결돼야 해요)" };
  const [posts] = await db.query("SELECT id, title, body, category, goal, stage, ai_round, ai_at, ai_try_at FROM posts WHERE kind = 'weekly' AND stage IN ('open', 'review') ORDER BY id");
  const out = [];
  for (const p of posts) { try { out.push(await wrapOne(db, p)); } catch (e) { console.error("wrap", p.id, e.message); out.push({ id: p.id, error: e.message }); } }
  return { results: out };
}

module.exports = { GOAL, TYPE_BY_DOW, newQuestion, kstNow, ymd, mondayOf, pickMember, makeDaily, makeWeekly, wrap };
