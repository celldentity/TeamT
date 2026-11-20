// 홈 화면에 추가(PWA)용 최소 서비스워커. 캐시는 하지 않는다 — 배포하면 바로 새 화면이 보이고, 로그인 상태가 어긋날 일도 없다.
// 인터넷이 끊겼을 때 페이지 이동만 안내 문구로 받아 준다.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
// 폰 푸시: 서버(api/_push.js)가 {title, body, url, tag, badge?} 를 보내면 알림을 띄우고, 누르면 그 글로 간다.
// badge(안 읽은 알림 수)가 오면 앱 아이콘 위 숫자도 바꾼다(0 이면 지운다) — 설치한 앱(홈 화면 아이콘)에서 보인다.
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || "HR T | 니핑", {
      body: d.body || "", tag: d.tag, data: { url: d.url || "/" },
      icon: d.icon || "/assets/icons/icon-v3-192.png",   // 미드핑이 보낸 알림은 미드핑 얼굴로
    });
    if (typeof d.badge === "number" && self.navigator) {
      try { if (d.badge > 0 && self.navigator.setAppBadge) await self.navigator.setAppBadge(d.badge); else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge(); } catch {}
    }
  })());
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const w = list.find((c) => c.url.startsWith(self.location.origin));
    return w ? w.focus().then(() => w.navigate(url)) : self.clients.openWindow(url);
  }));
});
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오프라인</title>' +
    '<body style="font:16px/1.7 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;color:#171719">' +
    "<p>인터넷에 연결돼 있지 않아요.<br>연결되면 다시 열어 주세요.</p>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
