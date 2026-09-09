// 這支 Service Worker 只為了一件事：讓頁面能用 registration.showNotification()。
// Android Chrome 禁止 new Notification()，必須透過 Service Worker 才發得出通知。
// 沒有推播伺服器，所以這裡不處理 push 事件——通知一律由開著的頁面主動發出。

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// 點通知就把已經開著的分頁叫到前景，沒有的話開一個
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes("nthu-laundry") && "focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});
