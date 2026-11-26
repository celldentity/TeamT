// Claude(Anthropic Messages API) 호출. 추가 패키지 없이 fetch 만 쓴다. 파일명이 _ 로 시작해 라우트로 노출되지 않는다.
// 필요한 환경변수: ANTHROPIC_API_KEY (없으면 enabled() 가 false — 질문은 질문 은행으로, 토론 정리는 건너뛴다)
// 선택: ANTHROPIC_MODEL (기본 claude-sonnet-5-5)
const enabled = () => !!process.env.ANTHROPIC_API_KEY;

// 한 번 부르고 {text, stop(종료 이유), types(응답 블록 종류)} 를 돌려준다 — 답이 비었거나 잘렸을 때 왜 그런지 알 수 있게.
async function call({ system, user, max = 2000, timeout = 50000 }) {
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
    const blocks = j.content || [];
    return { text: blocks.filter((c) => c.type === "text").map((c) => c.text).join("").trim(), stop: j.stop_reason || "", types: blocks.map((c) => c.type) };
  } finally { clearTimeout(t); }
}
const ask = async (o) => (await call(o)).text;

// JSON 한 덩어리로 답을 받는다. 못 알아볼 답이면(비었거나 잘렸거나 설명만 왔거나) 출력 한도를 넉넉히 늘려 «JSON 만» 이라고 다시 요청한다(tries 번까지).
// 끝내 안 되면 왜 그런지(종료 이유·응답 종류·앞부분)를 오류 문구에 담는다 — 서버 로그에서 원인을 볼 수 있게.
async function askJson({ system, user, max = 2000, timeout = 50000, tries = 2 }) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    last = await call({ system, user: i ? `${user}\n\n(이전 답을 읽을 수 없었어요. 설명 없이 JSON 한 개만, 닫는 중괄호까지 빠짐없이 출력하세요.)` : user, max: i ? Math.max(max * 2, 4000) : max, timeout });
    try { return json(last.text); } catch { /* 한 번 더 */ }
  }
  throw new Error(`Claude 가 JSON 으로 답하지 않았어요 (종료 이유 ${last.stop || "?"}, 응답 ${last.types.join("+") || "없음"}, 앞부분 «${last.text.slice(0, 160).replace(/\s+/g, " ")}»)`);
}

// 대화·도구 호출용: 응답 전체({content:[…블록], stop_reason})를 돌려준다. api/ask.js(AI 도우미)가 쓴다.
async function chat({ system, messages, tools, toolChoice, max = 3000, timeout = 50000 }) {
  if (!enabled()) throw new Error("ANTHROPIC_API_KEY 가 없어요.");
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
  try {
    const body = { model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: max, system, messages };
    if (tools) { body.tools = tools; if (toolChoice) body.tool_choice = toolChoice; }
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Claude 응답 오류 ${r.status}: ${(j.error && j.error.message) || ""}`.trim());
    return j;
  } finally { clearTimeout(t); }
}

// 답변에서 JSON 한 덩어리를 꺼낸다(앞뒤에 설명이 붙어도 견딘다)
function json(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("JSON 을 찾지 못했어요.");
  return JSON.parse(text.slice(a, b + 1));
}

// 웹 검색 서버 도구를 붙여 묻는다. 검색은 Anthropic 쪽에서 돌고, 결과 블록(web_search_tool_result)이 응답에 섞여 온다. pause_turn 이면 이어서 부른다(최대 conts 번).
// 돌려주는 값: {text, sources(검색 결과에 «실제로 나온» 주소만), searches(검색 횟수), stop}. 웹 검색이 꺼져 있으면(콘솔 설정 등) 400 계열 오류가 나므로 부르는 쪽에서 잡아 검색 없이 다시 묻는다.
async function searchAsk({ system, user, max = 4000, timeout = 55000, maxUses = 3, conts = 3 }) {
  if (!enabled()) throw new Error("ANTHROPIC_API_KEY 가 없어요.");
  const tools = [{ type: "web_search_20260209", name: "web_search", max_uses: maxUses }];
  const messages = [{ role: "user", content: user }];
  const sources = new Map(); let searches = 0;
  for (let i = 0; i <= conts; i++) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
    let j;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal: ctl.signal,
        headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: max, system, tools, messages }),
      });
      j = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(`Claude 응답 오류 ${r.status}: ${(j.error && j.error.message) || ""}`.trim()), { status: r.status });
    } finally { clearTimeout(t); }
    const blocks = j.content || [];
    for (const b of blocks) {
      if (b.type === "server_tool_use") searches++;
      else if (b.type === "web_search_tool_result" && Array.isArray(b.content)) for (const x of b.content) if (x && x.type === "web_search_result" && /^https?:\/\//.test(x.url || "")) sources.set(x.url, x.title || x.url);
    }
    if (j.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: blocks }); continue; }
    return { text: blocks.filter((c) => c.type === "text").map((c) => c.text).join("").trim(), sources: [...sources].map(([url, title]) => ({ url, title })), searches, stop: j.stop_reason || "" };
  }
  throw new Error("웹 검색이 끝나지 않았어요.");
}

module.exports = { enabled, ask, askJson, searchAsk, chat, json };
