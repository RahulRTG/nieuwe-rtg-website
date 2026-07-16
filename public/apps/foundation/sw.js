/* RTFoundation-lesapp, service worker: maakt de app installeerbaar en laat hem
   offline openen. Pagina's en scripts zijn network-first (een update komt direct
   door), de cache is het vangnet zonder verbinding. API-verkeer en de live-stream
   gaan altijd naar het netwerk. */
const CACHE = 'rtf-hulp-1de52979';
const SHELL = [
  '/apps/foundation/', '/apps/foundation/index.html',
  '/apps/foundation/leren.html', '/apps/foundation/bord.html', '/apps/foundation/schrift.html',
  '/apps/foundation/cv.html', '/apps/foundation/rust.html', '/apps/foundation/reis.html',
  '/apps/foundation/geld.html', '/apps/foundation/hulpwijzer.html', '/apps/foundation/dromen.html',
  '/apps/foundation/opvoeden.html', '/apps/foundation/steun.html', '/apps/foundation/studie.html',
  '/apps/foundation/veilig.html', '/apps/foundation/pesten.html', '/apps/foundation/oppasinfo.html',
  '/apps/foundation/agenda.html', '/apps/foundation/klusjes.html',
  '/apps/foundation/overhoren.html', '/apps/foundation/schrijven.html', '/apps/foundation/projecten.html',
  '/apps/foundation/babyboek.html',
  '/apps/foundation/toetsen.html', '/apps/foundation/zakgeld.html', '/apps/foundation/kompas.html',
  '/apps/foundation/contact.html', '/apps/foundation/gezin-rt.js', '/apps/foundation/werk.html', '/apps/foundation/vrienden.html', '/apps/foundation/markt.html',
  '/apps/foundation/beheer.html', '/apps/foundation/privacy.html', '/apps/foundation/sessie.js',
  '/apps/foundation/tekenen.js', '/apps/foundation/realtime.js', '/apps/foundation/stijl.css', '/apps/foundation/palet.js', '/shared/seizoen.js', '/shared/dagkleur.css', '/shared/verbinding.js', '/apps/geo.js', '/apps/translate.js', '/apps/util.js',
  '/manifests/foundation.webmanifest', '/icons/foundation.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return; // API + SSE altijd live
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.ok && url.origin === location.origin) {
        const kopie = res.clone(); caches.open(CACHE).then(c => c.put(e.request, kopie));
      }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('/apps/foundation/')))
  );
});
