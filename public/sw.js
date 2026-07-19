/* RTG app, service worker: cachet de app-schil zodat de app installeerbaar
   is en offline opent. API-verkeer gaat altijd naar het netwerk.
   Pagina's en scripts zijn network-first: een update op de server komt
   direct door, de cache is alleen het vangnet zonder verbinding. */
const CACHE = 'rtg-app-3e5f7a67';
const SHELL = ['/apps/app.html', '/apps/app-main.js', '/apps/spelen.html', '/shared/verbinding.js', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  // Iconen en manifests veranderen zelden: die mogen uit de cache komen.
  const staticAsset = /^\/(icons|manifests)\//.test(url.pathname) || url.pathname === '/icon.svg';
  e.respondWith(
    staticAsset
      ? caches.match(e.request).then(hit => hit ||
          fetch(e.request).then(res => {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
            return res;
          }))
      : fetch(e.request).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        }).catch(() =>
          caches.match(e.request).then(hit => hit || caches.match('/apps/app.html'))
        )
  );
});

/* Push-notificatie: toont een systeemmelding, ook als de app dicht is. */
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) {}
  const title = data.title || 'Rahul Travel Group';
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: data.icon || '/icon.svg',
    badge: '/icon.svg',
    tag: data.tag,
    data: { url: '/apps/app.html' }
  }));
});

/* Tik op de melding opent (of focust) de app. */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) if (c.url.includes('/apps/app.html') && 'focus' in c) return c.focus();
      return self.clients.openWindow((e.notification.data && e.notification.data.url) || '/apps/app.html');
    })
  );
});
