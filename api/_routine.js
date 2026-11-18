// 매일·매주 루틴: 오늘의 질문(한 사람 지목) · 이번 주 토론 · 토론이 100% 가 되면 Claude 가 정리. 파일명이 _ 로 시작해 라우트로 노출되지 않는다.
// 호출은 api/cron.js 가 한다(Vercel 크론). 모든 단계는 «같은 날·같은 상태에서 두 번 돌려도 한 번만 일하게» 만들어 뒀다.
const L = require("./_lib");
const AI = require("./_ai");
const Q = require("./_qbank");
const Push = require("./_push");

const GOAL = 10;                 // 주간 토론: 사람이 단 댓글이 이만큼 모이면 진척도 100%
const MORE_COMMENTS = 3;         // AI 가 반문한 뒤 이만큼 댓글이 더 달리면 다음 단계로
const MAX_ROUNDS = 3;            // AI 가 반문하는 최대 차례(마지막 차례에는 어떻게든 글로 정리한다)
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

async function newQuestion(db, kind) {
  const [recent] = await db.query("SELECT title FROM posts WHERE kind = ? ORDER BY id DESC LIMIT 30", [kind]);
  const used = new Set(recent.map((r) => r.title));
  if (AI.enabled()) {
    try {
      const type = kind === "daily" ? pick(["HR", "HR", "커리어", "상식"]) : "HR";
      const sys = kind === "daily"
        ? "당신은 HR 스터디 모임 «T조»의 질문 큐레이터입니다. 모임 구성원이 하루에 한 명씩 가볍게 답해 볼 질문을 한국어로 하나 만드세요. 종류는 상식, HR, 커리어 중 하나입니다. 질문은 한 문장(80자 이내)이고, 3~5문장으로 답할 수 있어야 하며, 정답이 하나로 정해진 퀴즈보다 경험과 생각을 묻는 편이 좋습니다. 최근에 쓴 질문과 겹치면 안 됩니다. 마크다운 기호를 쓰지 말고, JSON 한 개만 출력하세요: {\"category\":\"" + L.CATS.join("|") + " 중 하나\",\"title\":\"질문\",\"body\":\"질문의 배경이나 답하는 힌트 1~2문장\"}"
        : "당신은 HR 스터디 모임 «T조»의 토론 진행자입니다. 팀원 전체가 일주일 동안 댓글로 의논할 HR 토론 주제를 한국어로 하나 만드세요. 정답이 없고 서로 의견이 갈릴 만한 주제여야 하며, 제목은 80자 이내의 질문 한 문장, 본문은 배경과 생각해 볼 점을 3~5문장으로 씁니다. 최근 주제와 겹치면 안 됩니다. 마크다운 기호를 쓰지 말고, JSON 한 개만 출력하세요: {\"category\":\"" + L.CATS.join("|") + " 중 하나\",\"title\":\"주제\",\"body\":\"배경 설명\"}";
      const out = AI.json(await AI.ask({ system: sys, user: `종류: ${type}\n최근 ${kind === "daily" ? "질문" : "주제"}:\n${[...used].slice(0, 20).map((t) => "- " + t).join("\n") || "(없음)"}`, max: 600 }));
      const title = String(out.title || "").trim(), body = String(out.body || "").trim();
      if (L.len(title) >= 2 && L.len(title) <= 80 && L.CATS.includes(out.category) && !used.has(title)) return { category: out.category, title, body: kind === "daily" ? body + "\n\n편하게 3~5문장으로 답해 주세요. 정답은 없어요." : body, from: "claude" };
    } catch (e) { console.error("question ai", e.message); }
  }
  const bank = (kind === "daily" ? Q.DAILY : Q.WEEKLY).filter((q) => !used.has(q.title));
  const q = pick(bank.length ? bank : (kind === "daily" ? Q.DAILY : Q.WEEKLY));
  return { category: q.category, title: q.title, body: q.body, from: "bank" };
}

async function makeDaily(db, now = new Date()) {
  const k = kstNow(now), date = ymd(k), dow = k.getUTCDay();
  if (dow === 0 || dow === 6) return { skipped: "주말" };
  const [ex] = await db.query("SELECT id FROM posts WHERE kind = 'daily' AND qdate = ?", [date]);
  if (ex[0]) return { skipped: "이미 있음", id: ex[0].id };
  // 미리 예약된 질문(daily_plan)이 있으면 그 사람·그 질문으로, 없으면 자동으로 뽑는다
  const [[plan]] = await db.query("SELECT p.target_id, p.category, p.title, p.body, u.nickname FROM daily_plan p JOIN users u ON u.id = p.target_id WHERE p.qdate = ?", [date]);
  const who = plan ? { id: plan.target_id, nickname: plan.nickname } : await pickMember(db, date);
  if (!who) return { skipped: "가입자 없음" };
  const q = plan ? { category: plan.category, title: plan.title, body: plan.body, from: "plan" } : await newQuestion(db, "daily");
  let id;
  try {
    const [r] = await db.query("INSERT INTO posts (author_id, ai, category, title, body, kind, target_id, qdate) VALUES (NULL, 1, ?, ?, ?, 'daily', ?, ?)", [q.category, q.title, q.body, who.id, date]);
    id = r.insertId;
  } catch (e) { if (e.code === "ER_DUP_ENTRY") return { skipped: "이미 있음" }; throw e; }   // 동시에 두 번 불려도 한 번만
  const push = await Push.notify([who.id], () => ({ title: "오늘의 질문이 도착했어요", body: q.title, url: `/article?id=${id}`, tag: `daily-${date}`, badge: "auto" })).catch((e) => ({ error: e.message }));
  return { id, date, target: who.nickname, from: q.from, title: q.title, push };
}

async function makeWeekly(db, now = new Date()) {
  const k = kstNow(now), mon = mondayOf(k);
  const [ex] = await db.query("SELECT id FROM posts WHERE kind = 'weekly' AND qdate = ?", [mon]);
  if (ex[0]) return { skipped: "이미 있음", id: ex[0].id };
  const q = await newQuestion(db, "weekly");
  let id;
  try {
    const [r] = await db.query("INSERT INTO posts (author_id, ai, category, title, body, kind, qdate, goal, stage) VALUES (NULL, 1, ?, ?, ?, 'weekly', ?, ?, 'open')", [q.category, q.title, q.body, mon, GOAL]);
    id = r.insertId;
  } catch (e) { if (e.code === "ER_DUP_ENTRY") return { skipped: "이미 있음" }; throw e; }
  const push = await Push.notify(null, () => ({ title: "이번 주 토론 주제가 올라왔어요", body: q.title, url: `/article?id=${id}`, tag: `weekly-${mon}`, badge: "auto" })).catch((e) => ({ error: e.message }));
  return { id, week: mon, from: q.from, title: q.title, push };
}

// ── 토론 정리: 100% → Claude 가 요약·반문 → 댓글이 더 달리면 다시 판단 → 글로 정리 ──
const humanCount = async (db, postId, since) => {
  const [r] = await db.query("SELECT COUNT(*) AS n FROM comments WHERE post_id = ? AND deleted = 0 AND author_id IS NOT NULL" + (since ? " AND created_at > ?" : ""), since ? [postId, since] : [postId]);
  return Number(r[0].n);
};
async function thread(db, postId) {
  const [cs] = await db.query("SELECT c.body, u.nickname FROM comments c LEFT JOIN users u ON u.id = c.author_id WHERE c.post_id = ? AND c.deleted = 0 ORDER BY c.created_at, c.id", [postId]);
  return cs.map((c) => `[${c.nickname || "T조 AI"}] ${String(c.body).replace(/\s+/g, " ")}`).join("\n").slice(-14000);
}
const SYS = "당신은 HR 스터디 모임 «T조»의 AI 진행자입니다. 팀원들이 주제에 대해 댓글로 나눈 이야기를 읽고 돕습니다. 팀원의 의견을 왜곡하거나 지어내지 말고, 닉네임은 그대로 쓰세요. 마크다운 기호(#, *, -, 번호 목록 기호)를 쓰지 말고 일반 문장으로 쓰세요. 반드시 JSON 한 개만 출력하세요.";

async function aiComment(db, postId, body) {
  const [r] = await db.query("INSERT INTO comments (post_id, parent_id, author_id, body) VALUES (?, NULL, NULL, ?)", [postId, String(body).slice(0, 3900)]);
  return r.insertId;
}

async function wrapOne(db, post) {
  const h = (ts) => (ts ? (Date.now() - new Date(ts).getTime()) / 36e5 : 1e9);
  if (post.ai_try_at && h(post.ai_try_at) < 0.5) return { id: post.id, skipped: "최근에 시도함" };
  const topic = `주제: ${post.title}\n${post.body}`;

  if (post.stage === "open") {
    if ((await humanCount(db, post.id)) < post.goal) return { id: post.id, skipped: "진척도 100% 아님" };
    await db.query("UPDATE posts SET ai_try_at = NOW() WHERE id = ?", [post.id]);
    const out = AI.json(await AI.ask({ system: SYS, max: 1500,
      user: `${topic}\n\n지금까지의 댓글:\n${await thread(db, post.id)}\n\n해야 할 일: (1) 지금까지 나온 의견을 3~5문장으로 요약하세요. (2) 아직 부족하거나 의견이 엇갈리는 지점을 짚어 추가 질문 또는 반문을 2~3개 만드세요.\n출력: {"summary":"요약","questions":["질문1","질문2"]}` }));
    const qs = (out.questions || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
    if (!out.summary || !qs.length) throw new Error("요약 형식이 올바르지 않아요.");
    const cid = await aiComment(db, post.id, `댓글이 ${post.goal}개 모여서 지금까지의 이야기를 정리해 볼게요.\n\n${String(out.summary).trim()}\n\n더 이야기해 보면 좋을 질문이에요.\n${qs.map((q, i) => `${i + 1}. ${q}`).join("\n")}`);
    await db.query("UPDATE posts SET stage = 'review', ai_round = 1, ai_at = NOW() WHERE id = ?", [post.id]);
    const push = await Push.notify(null, () => ({ title: "T조 AI가 토론을 정리하고 질문을 남겼어요", body: post.title, url: `/article?id=${post.id}#c${cid}`, tag: `wrap-${post.id}-1`, badge: "auto" })).catch(() => null);
    return { id: post.id, step: "summary", push };
  }

  if (post.stage === "review") {
    const fresh = await humanCount(db, post.id, post.ai_at), waited = h(post.ai_at);
    if (!(fresh >= MORE_COMMENTS || (fresh >= 1 && waited >= 24) || waited >= 72)) return { id: post.id, skipped: "더 기다리는 중", fresh };
    await db.query("UPDATE posts SET ai_try_at = NOW() WHERE id = ?", [post.id]);
    const last = post.ai_round >= MAX_ROUNDS || waited >= 72;
    const out = AI.json(await AI.ask({ system: SYS, max: 4000,
      user: `${topic}\n\n지금까지의 댓글(마지막 AI 댓글 이후 사람이 ${fresh}개 더 달았어요):\n${await thread(db, post.id)}\n\n해야 할 일: 이 토론이 «인살롱(HR 커뮤니티)에 올려도 될 정도의 글»이 될 만큼 충분히 모였는지 판단하세요. 기준은 서로 다른 관점, 근거나 사례, 실무에 쓸 수 있는 결론입니다.${last ? " 이번이 마지막 차례이므로 부족한 점이 있어도 지금까지의 내용으로 글을 정리하세요(ready 는 true)." : ""}\n충분하면 글로 정리하세요: 제목 80자 이내, 분류는 ${L.CATS.join("/")} 중 하나, 본문은 1500~3500자로 도입-관점별 정리-결론과 실무 팁 순서의 일반 글(소제목은 한 줄 문장으로), 토론에 참여한 닉네임을 자연스럽게 언급하세요.\n부족하면 추가 질문 1~2개를 만드세요.\n출력(충분): {"ready":true,"title":"제목","category":"분류","body":"본문"}\n출력(부족): {"ready":false,"questions":["질문1"]}` }));
    if (out.ready || last) {
      const title = String(out.title || post.title).trim().slice(0, 80), body = String(out.body || "").trim().slice(0, 4900), cat = L.CATS.includes(out.category) ? out.category : post.category;
      if (L.len(body) < 10) throw new Error("정리된 글이 너무 짧아요.");
      const [r] = await db.query("INSERT INTO posts (author_id, ai, category, title, body, kind, ref_post_id) VALUES (NULL, 1, ?, ?, ?, 'digest', ?)", [cat, title, body, post.id]);
      await db.query("UPDATE posts SET stage = 'done', ref_post_id = ? WHERE id = ?", [r.insertId, post.id]);
      const cid = await aiComment(db, post.id, `이야기가 충분히 모여서 아티클로 정리했어요. 인살롱에 올려도 좋은지 한 번씩 읽어 보고 고칠 곳이 있으면 알려 주세요.\n\n정리된 글: «${title}»`);
      const push = await Push.notify(null, () => ({ title: "토론이 아티클로 정리됐어요", body: title, url: `/article?id=${r.insertId}`, tag: `digest-${post.id}`, badge: "auto" })).catch(() => null);
      return { id: post.id, step: "digest", digest: r.insertId, push, cid };
    }
    const qs = (out.questions || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 2);
    if (!qs.length) throw new Error("반문이 비어 있어요.");
    const cid = await aiComment(db, post.id, `이야기를 이어서 보니 아직 정리하기엔 조금 부족해요. 아래 질문도 같이 생각해 볼까요?\n${qs.map((q, i) => `${i + 1}. ${q}`).join("\n")}`);
    await db.query("UPDATE posts SET ai_round = ai_round + 1, ai_at = NOW() WHERE id = ?", [post.id]);
    const push = await Push.notify(null, () => ({ title: "T조 AI가 질문을 더 남겼어요", body: post.title, url: `/article?id=${post.id}#c${cid}`, tag: `wrap-${post.id}-${post.ai_round + 1}`, badge: "auto" })).catch(() => null);
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

module.exports = { GOAL, kstNow, ymd, mondayOf, pickMember, makeDaily, makeWeekly, wrap };
