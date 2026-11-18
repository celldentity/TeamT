// 홈 화면에 추가(PWA)용 최소 서비스워커. 캐시는 하지 않는다 — 배포하면 바로 새 화면이 보이고, 로그인 상태가 어긋날 일도 없다.
// 인터넷이 끊겼을 때 페이지 이동만 안내 문구로 받아 준다.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오프라인</title>' +
    '<body style="font:16px/1.7 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;color:#171719">' +
    "<p>인터넷에 연결돼 있지 않아요.<br>연결되면 다시 열어 주세요.</p>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
