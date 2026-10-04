/* RTG app, service worker: cachet de app-schil zodat de app installeerbaar
   is en offline opent. API-verkeer gaat altijd naar het netwerk.
   Pagina's en scripts zijn network-first: een update op de server komt
   direct door, de cache is alleen het vangnet zonder verbinding. */
/* DE CACHENAAM IS DE VINGERAFDRUK VAN DE SCHIL, en dat is hij nu ook echt:
   sha256 over de bestanden hieronder, eerste acht tekens. Draai
   `npm run swcache` na een wijziging aan de schil; keuringsregel controleert
   of hij nog klopt.

   WAAROM DIT ERTOE DOET. Een geinstalleerde app ruimt oude caches alleen op
   bij `activate`, en dan alleen die met een ANDERE naam. Blijft de naam
   staan terwijl de schil verandert, dan houdt een toestel zijn oude schil --
   en dat is precies wat er kan gebeuren zijn bij het toestel dat de app
   installeerde in de periode dat de `cache: 'no-cache'` hieronder was
   gesneuveld (zie de toelichting daar). Een naam die uit de INHOUD komt kan
   niet vergeten worden. */
const CACHE = 'rtg-app-3238083f';
const SHELL = [
  /* The mandatory desktop standard is available offline too. */
  '/shared/interface/module-sdk.js',
  '/shared/interface/workspace-world-catalog.js',
  '/shared/interface/workspace-registries.js',
  '/shared/interface/workspace-session.js',
  '/shared/interface/workspace-policy.js',
  '/shared/interface/workspace-context.js',
  '/shared/interface/workspace-navigation.js',
  '/shared/interface/workspace-state.js',
  '/shared/interface/workspace-orchestrator.js',
  '/shared/interface/workspace-blueprints.js',
  '/shared/interface/workspace-broker.js',
  '/shared/interface/workspace-module-host.js',
  '/shared/interface/workspace-runtime.js',
  '/shared/interface/world-desktop-copy.js',
  '/shared/interface/world-desktop-people.js',
  '/shared/interface/world-desktop-frame.js',
  '/shared/interface/world-widget-copy.js',
  '/shared/interface/world-widget-data.js',
  '/shared/interface/world-widget-surfaces.js',
  '/shared/interface/world-widget-live.js',
  '/shared/interface/world-desktop-cards.js',
  '/shared/interface/world-desktop-surface.js',
  '/shared/interface/world-desktop-projection.js',
  '/shared/interface/world-desktop-home.js',
  '/shared/interface/world-widget-catalog.json',
  '/shared/rtg-world-desktop.js',
  '/shared/rtg-world-desktop.css',
  '/shared/rtg-world-widgets.css',
  '/shared/rtg-desktop-components.css',
  '/shared/rtg-world-palette.css',
'/apps/app.html', '/shared/id.js',
  '/shared/sw-pass-assets.js', '/shared/pass-cache.js', '/shared/pass-recovery.js', '/shared/pass-recovery.css',
  /* Heritage is één systeemlaag. Een offline start mag niet alleen de HTML
     bewaren en daarna identiteit, materiaal, beweging of lettertypen missen. */
  '/shared/basis.js', '/shared/rtg-world-identity.js',
  '/shared/rtg-world-home.css', '/shared/rtg-world-home-copy.js', '/shared/rtg-world-home.js',
  '/apps/wereld.html', '/apps/wereld-feed.css', '/apps/wereld-feed.js', '/apps/wereld-welcome.js',
  '/images/world-homes/living.webp', '/images/world-homes/living-canal.webp', '/images/world-homes/living-coast.webp',
  '/images/world-homes/travel.webp', '/images/world-homes/work.webp', '/images/world-homes/foundation.webp',
  '/shared/rtg-world-start.css', '/shared/rtg-world-start.js',
  '/shared/rtg-route-memory-core.js', '/shared/rtg-route-memory.js',
  '/shared/rtg-heritage-transition.js', '/shared/rtg-action-dock.js', '/shared/rtg-edge-preferences.js', '/shared/rtg-heritage-registry.js',
  '/shared/rtg-heritage-components.js', '/shared/rtg-intelligence.css', '/shared/rtg-intelligence-shell.css',
  '/shared/rtg-operation.js', '/shared/rtg-side-sheet.js',
  '/shared/rtg-heritage.css', '/shared/rtg-heritage-materials.css',
  '/shared/rtg-warm-details.css', '/shared/rtg-personal-images.css',
  '/shared/rtg-heritage-adapters.css', '/shared/rtg-heritage-experiences.css', '/shared/rtg-heritage-components.css',
  '/shared/rtg-simple.css', '/shared/rtg-world-screen.css',
  '/shared/rtg-heritage-motion.css', '/shared/rtg-heritage-motion.js',
  '/shared/rtg-continue-key.css', '/shared/rtg-continue-key-core.js',
  '/shared/rtg-continue-key.js', '/shared/rtg-heritage-order.js',
  '/shared/randen.js', '/shared/rtg-edge-worlds.js', '/shared/rtg-edge-icons.js',
  '/shared/rtg-edge-library.js', '/shared/rtg-edge-system.js', '/shared/rtg-edge-system.css',
  '/shared/rtg-edge-2-loader.js', '/shared/rtg-edge-2-context.js', '/shared/rtg-edge-command.js',
  '/shared/rtg-edge-2.js', '/shared/rtg-edge-2.css',
  '/shared/experience-handoff.js', '/shared/rtg-adaptive-edge-loader.js', '/shared/rtg-adaptive-edge-core.js', '/shared/rtg-adaptive-edge-controls.js', '/shared/rtg-adaptive-edge-input.js', '/shared/adaptief/grammatica.js',
  '/shared/rtg-adaptive-edge.js', '/shared/rtg-adaptive-edge-signals.js', '/shared/rtg-adaptive-edge.css',
  '/shared/edge/actiestaat.js', '/shared/edge/blikveld-hoofdactie.js', '/shared/edge/blikveld.js',
  '/images/worlds/heritage/living-heritage-v2.jpg',
  '/images/worlds/heritage/travel-heritage-v2.jpg',
  '/images/worlds/heritage/work-heritage-v2.jpg',
  '/images/worlds/heritage/foundation-heritage-v2.jpg',
  '/fonts/aFTQ7PxzY382XsXX63LUYJSKSKjWXFBP.woff2',
  '/fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2',
  /* De drie installeerbare passen starten met een betekenisvolle query. Die
     adressen staan daarom exact in de schil: ze mogen offline niet naar de
     kale Home worden omgebogen, maar moeten bij de eerste start wel openen. */
  '/apps/app.html?pas=rtg', '/apps/app.html?pas=lifestyle', '/apps/app.html?pas=business',
  '/apps/app-main.js', '/apps/spelen.html', '/shared/verbinding.js',
  '/shared/interface/second-screen.css', '/shared/interface/second-screen-personal.css', '/shared/interface/workspace-empty.js', '/shared/interface/second-screen-modules.js',
  '/shared/interface/modules/context.js', '/shared/interface/second-screen.js', '/shared/interface/second-screen-personal.js', '/manifest.webmanifest', '/icon.svg',

  '/shared/i18n.js',
  '/shared/taalschil/zh.json', '/shared/taalschil/hi.json', '/shared/taalschil/es.json',
  '/shared/taalschil/ar.json', '/shared/taalschil/bn.json', '/shared/taalschil/pt.json',
  '/shared/taalschil/ru.json', '/shared/taalschil/ja.json', '/shared/taalschil/fr.json',
  '/shared/taalschil/en.json'];

importScripts('/shared/sw-pass-assets.js');
self.RTGPassAssets(CACHE);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('rtg-app-') && k !== CACHE).map(k => caches.delete(k))))
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

      : fetch(new Request(e.request, { cache: 'no-cache' })).then(res => {
          // alleen goede antwoorden bewaren: een 503 van een failover die hier
          // belandt, wordt anders voor altijd het "vangnet" van deze URL
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        }).catch(() => {
          /* Alleen een vingerafdruk op JS/CSS mag naar het kale, vooraf
             gecachete adres terugvallen. Query's als ?magnaat=1, ?bel= en
             ?pas= zijn semantische documenten en mogen nooit worden gealiasd. */
          const vinger = /\.(?:js|css)$/.test(url.pathname) && url.searchParams.has('v') &&
            Array.from(url.searchParams.keys()).every(k => k === 'v');
          return caches.match(e.request).then(hit => hit || (vinger ? caches.match(url.pathname) : null)).then(hit => {
            if (hit) return hit;
            // Alleen een echte pagina-navigatie mag op het beginscherm
            // terugvallen. Elke andere mislukte GET (een script, een fetch
            // vanuit een app) kreeg hier ook app.html terug: de app "viel
            // terug naar het beginscherm" bij elke netwerkhapering, en een
            // script-URL kreeg HTML als JavaScript.
            if (e.request.mode === 'navigate' && !url.search) return caches.match('/apps/app.html');
            return Response.error();
          });
        })
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
