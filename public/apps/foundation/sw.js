/* RTFoundation-lesapp, service worker: maakt de app installeerbaar en laat hem
   offline openen. Pagina's en scripts zijn network-first (een update komt direct
   door), de cache is het vangnet zonder verbinding. API-verkeer en de live-stream
   gaan altijd naar het netwerk. */
const CACHE = 'rtf-hulp-leerpas-8ac8d29b';
const SHELL = [
  '/apps/foundation/', '/apps/foundation/index.html', '/apps/foundation/campus.html',
  '/apps/foundation/leren.html', '/apps/foundation/leerpaspoort.html', '/apps/foundation/bord.html', '/apps/foundation/schrift.html',
  '/apps/foundation/cv.html', '/apps/foundation/rust.html', '/apps/foundation/reis.html',
  '/apps/foundation/geld.html', '/apps/foundation/hulpwijzer.html', '/apps/foundation/dromen.html',
  '/apps/foundation/opvoeden.html', '/apps/foundation/steun.html', '/apps/foundation/studie.html',
  '/apps/foundation/veilig.html', '/apps/foundation/pesten.html', '/apps/foundation/oppasinfo.html',
  '/apps/foundation/agenda.html', '/apps/foundation/klusjes.html',
  '/apps/foundation/keuken.html', '/apps/foundation/ochtend.html', '/apps/foundation/verjaardagen.html', '/apps/foundation/gezondheid.html',
  '/apps/foundation/overhoren.html', '/apps/foundation/schrijven.html', '/apps/foundation/projecten.html',
  '/apps/foundation/babyboek.html',
  '/apps/foundation/toetsen.html', '/apps/foundation/zakgeld.html', '/apps/foundation/kompas.html',
  '/apps/foundation/tellen.html', '/apps/foundation/kleuren.html', '/apps/foundation/memorie.html',
  '/apps/foundation/verhaaltje.html', '/apps/foundation/liedjes.html', '/apps/foundation/gevoel.html',
  '/apps/foundation/presenteren.html', '/apps/foundation/budget.html', '/apps/foundation/rechten.html',
  '/apps/foundation/mediawijs.html',
  // de levenspas aan de gezinskant, met de gedeelde schil eronder
  '/apps/foundation/mijnbanden.html', '/shared/levenspas.js', '/shared/levenspas.css',
  /* mail.html en registreren.html kwamen met de samenvoeging van 22 augustus
     2026 op de hub te staan maar niet hier. Een tegel die de service worker niet
     kent, geeft offline een wit scherm -- en dat is erger dan geen tegel, want
     de gebruiker denkt dat de app stuk is. test/foundationschil.test.js meet dit. */
  '/apps/foundation/mail.html', '/apps/foundation/registreren.html',
  '/apps/foundation/contact.html', '/apps/foundation/gezin-rt.js', '/apps/foundation/werk.html', '/apps/foundation/werk-premium.css', '/apps/foundation/vrienden.html', '/apps/foundation/markt.html',
  /* club en klas kwamen op de hub te staan toen elk scherm een klikroute
     kreeg; zonder deze twee regels geeft de app ze offline als wit scherm.
     test/foundationschil.js ving dat meteen -- de eerste keer dat die toets
     iets ving, want hij draaide voorheen nooit (geen browser). */
  '/apps/foundation/club.html', '/apps/foundation/klas.html',
  '/apps/foundation/beheer.html', '/apps/foundation/privacy.html', '/apps/foundation/sessie.js',
  /* Deze tien stonden WEL op de hub en NIET in de schil: spelen, de biebs, de
     schoolkant en het magazine. Precies de tegels waarmee een kind zich
     bezighoudt als er niets anders is -- en dus juist de tegels die je nodig
     hebt in een auto, een wachtkamer of een buurthuis met slecht bereik. Wie
     hier een pagina bijzet op de hub, zet hem ook hier neer; de gaten waren
     niet te zien omdat niets ze telde. */
  '/apps/foundation/speeltuin.html', '/apps/foundation/speelhal.html', '/apps/foundation/arena.html',
  '/apps/foundation/societeit.html', '/apps/foundation/bieb.html', '/apps/foundation/geloofbieb.html',
  '/apps/foundation/schoolbieb.html', '/apps/foundation/beroepen.html', '/apps/foundation/school.html',
  '/apps/foundation/magazine.html',
  /* De ZES rolschermen van het Foundation OS (het commentaar zei drie; er
     stonden er al zes). Ze staan in dezelfde schil omdat ze
     in dezelfde scope liggen: een tweede service worker op /apps/foundation/
     zou deze eerste vervangen, en dan is de gezinsapp zijn cache kwijt. Ze
     draaien op een POST-API en die gaat nooit uit de cache -- wat hier offline
     komt is de pagina zelf, zodat de vrijwilliger in een buurthuis met slecht
     bereik niet naar een wit scherm kijkt. */
  '/apps/foundation/os-vrijwilliger.html', '/apps/foundation/os-deelnemer.html', '/apps/foundation/os-publiek.html',
  '/apps/foundation/os-bestuur.html',
  '/apps/foundation/os-veld.html', '/apps/foundation/os-donateur.html',
  '/apps/foundation/tekenen.js', '/apps/foundation/realtime.js', '/apps/foundation/stijl.css', '/apps/foundation/palet.js',
  '/apps/rtgschool/leer.js', '/apps/rtgschool/examen.js', '/apps/rtgschool/bijles.js',
  '/shared/rtg-school-shell.css', '/shared/rtg-school-session.js', '/shared/seizoen.js', '/shared/dagkleur.css', '/shared/verbinding.js', '/apps/geo.js', '/apps/translate.js', '/apps/util.js',
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
    }).catch(() => caches.match(e.request).then(r => {
      if (r) return r;
      // alleen een echte pagina-navigatie valt terug op de beginpagina;
      // een mislukt script of fetch-verzoek hoort gewoon te falen
      if (e.request.mode === 'navigate') return caches.match('/apps/foundation/');
      return Response.error();
    }))
  );
});
