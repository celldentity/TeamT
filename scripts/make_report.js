// 주간 토론 «정리 리포트(PDF)» 도구 — 운영자 PC 에서, 운영자가 지시했을 때만 쓴다(자동 생성 아님).
//   node scripts/make_report.js list                                   → 주간 토론 글 목록과 단계(open·review·ready·report·done)
//   node scripts/make_report.js export <글번호>                        → 토론(글 + 모든 댓글)을 읽을 수 있게 출력(리포트 내용을 쓰기 위한 자료)
//   node scripts/make_report.js draft <글번호> <spec.json> [out.pdf]   → 내용(spec)으로 PDF 초안만 만든다(아무것도 올리지 않음)
//   node scripts/make_report.js publish <글번호> <spec.json> [--no-announce] → PDF 를 R2(reports/<글번호>.pdf)에 올리고 단계를 report 로 바꾼다.
//                                                                          처음 올릴 때는 미드핑 안내 댓글 + 전원 푸시(--no-announce 로 끔)
// 어디에 붙는가: 기본은 .env(운영 TiDB·R2). 테스트 환경으로 시험하려면 먼저  set -a; . D:/Coding/.config/teamt-test.env; set +a
// spec 모양은 scripts/report/render.js 위쪽 설명 참고(title·subtitle·tldr·overview·keywords·perspectives·compare·flow·quotes·dos·donts·checklist·closing).
// 숫자(댓글 수·사람별·날짜별)는 DB 에서 센 값만 쓴다 — spec 에 숫자를 지어 넣지 않는다.
const fs = require("fs"), path = require("path");
for (const l of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) { const i = l.indexOf("="); if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^["']|["']$/g, ""); }
const L = require("../api/_lib");
const M = require("../api/_media");

const kst = (d) => new Date(new Date(d).getTime() + 9 * 36e5);
const ymd = (d) => kst(d).toISOString().slice(0, 10);
const hm = (d) => kst(d).toISOString().slice(5, 16).replace("T", " ");

async function loadPost(db, id) {
  const [[post]] = await db.query("SELECT id, title, body, stage, qdate, created_at FROM posts WHERE id = ? AND kind = 'weekly'", [id]);
  if (!post) throw new Error("주간 토론 글 번호가 아니에요.");
  const [cs] = await db.query("SELECT c.id, c.parent_id, c.author_id, c.body, c.created_at, u.nickname FROM comments c LEFT JOIN users u ON u.id = c.author_id WHERE c.post_id = ? AND c.deleted = 0 ORDER BY c.created_at, c.id", [id]);
  return { post, cs };
}

// 서버가 직접 센 «사실» — 참여 차트·표지 숫자는 이것만 쓴다
async function factsOf(db, post, cs) {
  const human = cs.filter((c) => c.author_id);
  const per = new Map(), perDay = new Map();
  for (const c of human) { per.set(c.nickname, (per.get(c.nickname) || 0) + 1); const d = ymd(c.created_at); perDay.set(d, (perDay.get(d) || 0) + 1); }
  let topicImage = null;
  const [[img]] = await db.query("SELECT id FROM post_media WHERE post_id = ? AND kind = 'image' AND status = 1 ORDER BY pos, id LIMIT 1", [post.id]);
  if (img) { try { const r = await fetch(await M.getUrl(img.id, "full")); if (r.ok) topicImage = Buffer.from(await r.arrayBuffer()); } catch (e) { console.error("주제 일러스트를 못 가져왔어요:", e.message); } }
  const today = ymd(new Date()).replace(/-/g, ". ");
  return {
    totalComments: human.length, dateLabel: today, topicImage,
    people: [...per].map(([nickname, comments]) => ({ nickname, comments })),
    days: [...perDay].sort((a, b) => a[0].localeCompare(b[0])).map(([d, n]) => ({ label: `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`, n })),
  };
}

const readSpec = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

(async () => {
  const [cmd, a, b, ...rest] = process.argv.slice(2);
  const db = L.db();
  console.error(`[${process.env.APP_ENV === "test" ? "테스트" : "운영"} 환경 · DB ${process.env.TIDB_DATABASE}]`);

  if (cmd === "list") {
    const [rows] = await db.query("SELECT p.id, p.title, p.stage, p.qdate, (SELECT COUNT(DISTINCT c.author_id) FROM comments c WHERE c.post_id = p.id AND c.deleted = 0 AND c.author_id IS NOT NULL) AS people, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted = 0 AND c.author_id IS NOT NULL) AS cmts FROM posts p WHERE p.kind = 'weekly' ORDER BY p.id DESC LIMIT 20");
    console.table(rows.map((r) => ({ 글번호: r.id, 단계: r.stage, 주: r.qdate ? ymd(r.qdate) : "", 참여자: Number(r.people), 댓글: Number(r.cmts), 제목: r.title })));

  } else if (cmd === "export") {
    const { post, cs } = await loadPost(db, Number(a));
    console.log(`# 글 ${post.id} · 단계 ${post.stage} · ${hm(post.created_at)}\n제목: ${post.title}\n\n${post.body}\n\n── 댓글 ${cs.length}개(AI 포함, 시간순) ──`);
    const name = new Map(cs.map((c) => [c.id, c.nickname || "미드핑"]));
    for (const c of cs) console.log(`\n[#${c.id}] ${c.nickname || "미드핑(AI)"} · ${hm(c.created_at)}${c.parent_id ? ` · ↳ ${name.get(c.parent_id) || ""} 에게` : ""}\n${String(c.body).trim()}`);

  } else if (cmd === "draft" || cmd === "publish") {
    const id = Number(a), specPath = b;
    if (!id || !specPath) throw new Error("사용법: " + cmd + " <글번호> <spec.json>");
    const { render } = require("./report/render");
    const { post, cs } = await loadPost(db, id);
    const buf = await render(readSpec(specPath), await factsOf(db, post, cs));
    if (cmd === "draft") {
      const out = rest[0] || (b && b.endsWith(".pdf") ? b : null) || path.join(path.dirname(specPath), `report-${id}.pdf`);
      fs.writeFileSync(out, buf); console.log(`초안 PDF ${(buf.length / 1024).toFixed(0)}KB → ${out} (아무것도 올리지 않았어요)`);
    } else {
      const was = post.stage;
      await M.putReport(id, buf);
      await db.query("UPDATE posts SET stage = 'report' WHERE id = ? AND kind = 'weekly'", [id]);
      console.log(`올렸어요: R2 ${M.reportKey(id)} (${(buf.length / 1024).toFixed(0)}KB) · 단계 ${was} → report`);
      if (was !== "report" && !rest.includes("--no-announce") && b !== "--no-announce") {
        const msg = "토론에서 오간 이야기를 도식으로 정리한 리포트(PDF)가 나왔어요! 위쪽 진행 카드의 «정리 리포트 PDF 받기» 버튼으로 내려받을 수 있어요.";
        await db.query("INSERT INTO comments (post_id, parent_id, author_id, body) VALUES (?, NULL, NULL, ?)", [id, msg]);
        const sent = await require("../api/_push").notify(null, () => ({ title: "미드핑이 토론 정리 리포트를 올렸어요", icon: "/assets/miding.jpg", body: post.title, url: `/article?id=${id}`, tag: `report-${id}`, badge: "auto" })).catch((e) => ({ error: e.message }));
        console.log("안내 댓글을 달고 푸시를 보냈어요:", JSON.stringify(sent));
      }
    }
  } else console.log("list | export <글번호> | draft <글번호> <spec.json> [out.pdf] | publish <글번호> <spec.json> [--no-announce]");
  process.exit(0);
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
