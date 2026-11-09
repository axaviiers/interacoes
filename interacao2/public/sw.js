// Service worker do Interação — notificações de minuta e app instalável
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Clicar na notificação abre/foca o app direto na aba de Minutas
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/?view=minutas";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if ("focus" in c) {
          c.postMessage({ type: "open-minutas" });
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
