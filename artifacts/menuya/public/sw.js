self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || 'Tienes una actualización en CLICKOK.' }; }
  const title = payload.title || 'Nuevo pedido en CLICKOK';
  const options = {
    body: payload.body || 'Un cliente acaba de realizar un pedido en tu vitrina.',
    icon: '/clickok-pwa.svg',
    badge: '/clickok-pwa.svg',
    tag: payload.tag || 'clickok-store-order',
    renotify: true,
    data: { url: payload.url || '/app/pos' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/app/pos', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
