// Claude(Anthropic Messages API) 호출. 추가 패키지 없이 fetch 만 쓴다. 파일명이 _ 로 시작해 라우트로 노출되지 않는다.
// 필요한 환경변수: ANTHROPIC_API_KEY (없으면 enabled() 가 false — 질문은 질문 은행으로, 토론 정리는 건너뛴다)
// 선택: ANTHROPIC_MODEL (기본 claude-sonnet-5-5)
const enabled = () => !!process.env.ANTHROPIC_API_KEY;

async function ask({ system, user, max = 2000, timeout = 50000 }) {
  if (!enabled()) throw new Error("ANTHROPIC_API_KEY 가 없어요.");
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: max, system, messages: [{ role: "user", content: user }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Claude 응답 오류 ${r.status}: ${(j.error && j.error.message) || ""}`.trim());
    return (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
  } finally { clearTimeout(t); }
}

// 답변에서 JSON 한 덩어리를 꺼낸다(앞뒤에 설명이 붙어도 견딘다)
function json(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("JSON 을 찾지 못했어요.");
  return JSON.parse(text.slice(a, b + 1));
}

module.exports = { enabled, ask, json };
