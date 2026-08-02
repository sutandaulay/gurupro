const CACHE_NAME = 'gurupro-cache-v2';
const urlsToCache = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      return cached || new Response(null, { status: 408 });
    })
  );
});

self.addEventListener('push', event => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'GuruPRO', body: event.data.text() };
  }

  const title = payload.title || 'GuruPRO';
  const body = payload.body || '';
  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'gurupro-notification',
    requireInteraction: false,
    silent: false,
    data: payload.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        const client = clientList[0];
        if (client.url !== url) {
          return client.navigate(url);
        }
        return client.focus();
      }
      return clients.openWindow(url);
    }).then(() => {
      if (data.scheduleId || data.userId) {
        return self.clients.matchAll().then((allClients) => {
          allClients.forEach((client) => {
            if (client.url.includes('/dashboard') || client.url.includes('/app')) {
              client.postMessage({
                type: 'VOICE_BRIEFING_PUSH',
                scheduleId: data.scheduleId,
                userId: data.userId,
              });
            }
          });
        });
      }
    })
  );
});
