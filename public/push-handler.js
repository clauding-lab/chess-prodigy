/* Imported by Workbox; keep its offline cache and explicit update lifecycle. */
self.addEventListener('push', (event) => {
  let message;
  try { message = event.data?.json(); } catch { return; }
  if (!message || typeof message.url !== 'string') return;
  let url;
  try { url = new URL(message.url, self.location.origin); } catch { return; }
  if (url.origin !== self.location.origin || !/^\/game\/[a-zA-Z0-9-]+$/.test(url.pathname)) return;
  event.waitUntil(self.registration.showNotification('Chess Prodigy', {
    body: 'A friend game is waiting. Open Chess Prodigy to continue.',
    icon: '/icons/knight-192.png', tag: url.pathname,
    data: { url: url.href },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let url;
  try { url = new URL(event.notification.data?.url, self.location.origin); } catch { return; }
  if (url.origin !== self.location.origin || !/^\/game\/[a-zA-Z0-9-]+$/.test(url.pathname)) return;
  event.waitUntil(self.clients.openWindow(url.href));
});
