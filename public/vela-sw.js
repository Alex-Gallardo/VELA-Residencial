self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(payload.title || "Vela", {
      body: payload.body || "Tienes una nueva notificación.",
      data: { url: payload.url || "/notificaciones" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/notificaciones";
  event.waitUntil(clients.openWindow(url));
});
