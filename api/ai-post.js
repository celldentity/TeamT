// T조 AI 가 글을 올리는 문 — 사람이 쓰는 /api/posts 와 달리 로그인 쿠키가 아니라 비밀 토큰으로 연다.
//   POST /api/ai-post   Authorization: Bearer <토큰>   {category, title, body}
//   → 글쓴이 없음(T조 AI)·AI 표시로 올리고, 알림을 켠 모든 팀원에게 폰 알림을 보낸다.
// 토큰은 새 비밀값을 만들지 않고 SESSION_SECRET 에서 항상 같은 값을 뽑는다(VAPID 키와 같은 방식). 뽑는 법: node scripts/post_ai.js --token
const crypto = require("crypto");
const L = require("./_lib");

const tokenOf = () => crypto.createHmac("sha256", L.env.SESSION_SECRET).update("ai-post-token").digest("base64url");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return L.json(res, 405, { error: "POST 로 요청해 주세요." });
    const got = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    if (!got || !L.same(got[1], tokenOf())) return L.json(res, 401, { error: "토큰이 맞지 않아요." });
    if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });
    const b = L.readBody(req), category = String(b.category || ""), title = String(b.title || "").trim(), body = String(b.body || "").replace(/\r\n/g, "\n").trim();
    if (!L.CATS.includes(category)) return L.json(res, 400, { error: "분류가 올바르지 않아요." });
    if (L.len(title) < 2 || L.len(title) > 80) return L.json(res, 400, { error: "제목은 2~80자로 적어 주세요." });
    if (L.len(body) < 10 || L.len(body) > 5000) return L.json(res, 400, { error: "내용은 10~5000자로 적어 주세요." });
    const [r] = await L.db().query("INSERT INTO posts (author_id, ai, category, title, body) VALUES (NULL, 1, ?, ?, ?)", [category, title, body]);
    const push = await require("./_push").notify(null, () => ({ title: "T조 AI가 새 글을 썼어요", body: title, url: `/article?id=${r.insertId}`, tag: `post-${r.insertId}`, badge: "auto" }))
      .catch((e) => { console.error("push ai post", e); return null; });
    return L.json(res, 201, { id: r.insertId, push });
  } catch (e) {
    console.error("ai-post", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
