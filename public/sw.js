/* RTG app, service worker: cachet de app-schil zodat de app installeerbaar
   is en offline opent. API-verkeer gaat altijd naar het netwerk.
   Pagina's en scripts zijn network-first: een update op de server komt
   direct door, de cache is alleen het vangnet zonder verbinding. */
const CACHE = 'rtg-app-a0dfea42';
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
      /* "Network-first" is hier niet vanzelf waar. fetch(e.request) mag gewoon
         uit de BROWSERCACHE komen, en een script dat daar nog uren als vers in
         ligt wordt dan zonder navragen geserveerd -- terwijl de pagina er wel
         vers doorheen komt. Die mix is het ergste geval: nieuwe html naast een
         oud script bouwt het beginscherm niet meer op, en dat is een zwart
         scherm zonder foutmelding. Precies wat er gemeld werd.

         Met cache:'no-cache' vraagt hij altijd na; is er niets veranderd dan is
         dat een 304 van een paar bytes. Deze regel is bij de samenvoeging van
         zes takken gesneuveld en hier teruggezet; test/randen.test.js bewaakt
         hem, en die toets ving het. */
      : fetch(new Request(e.request, { cache: 'no-cache' })).then(res => {
          // alleen goede antwoorden bewaren: een 503 van een failover die hier
          // belandt, wordt anders voor altijd het "vangnet" van deze URL
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        }).catch(() =>
          caches.match(e.request).then(hit => {
            if (hit) return hit;
            // Alleen een echte pagina-navigatie mag op het beginscherm
            // terugvallen. Elke andere mislukte GET (een script, een fetch
            // vanuit een app) kreeg hier ook app.html terug: de app "viel
            // terug naar het beginscherm" bij elke netwerkhapering, en een
            // script-URL kreeg HTML als JavaScript.
            if (e.request.mode === 'navigate') return caches.match('/apps/app.html');
            return Response.error();
          })
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
    // het icon-veld draagt tegenwoordig een glyf-naam voor de app zelf; een
    // OS-melding wil een URL, dus alleen echte paden gaan door
    icon: /^\//.test(data.icon || '') ? data.icon : '/icon.svg',
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
