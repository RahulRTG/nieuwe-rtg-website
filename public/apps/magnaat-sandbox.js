/* Alleen actief in de expliciete Magnaat-trainingskopie van de echte RTG-app.
   De schermen en lokale demo-interacties blijven echt; verkeer naar API's en
   toegang tot apparaatfuncties worden vóór de overige app-code afgevangen. */
(function () {
  'use strict';
  var proef = new URLSearchParams(location.search).get('magnaat') === '1';
  if (!proef) return;

  window.RTG_MAGNAAT_PROEF = true;

  /* De trainingskopie deelt wel dezelfde vormgeving en scripts, maar nooit de
     echte browseropslag. Daardoor kan een bestaand scherm vrij lokaal werken
     zonder tokens, voorkeuren of concepten uit de gewone RTG-sessie te lezen
     of te overschrijven. */
  (function isoleerOpslag() {
    function geheugen() {
      var data = new Map();
      return {
        get length() { return data.size; },
        key: function (i) { return Array.from(data.keys())[Number(i)] || null; },
        getItem: function (k) { k = String(k); return data.has(k) ? data.get(k) : null; },
        setItem: function (k, v) { data.set(String(k), String(v)); },
        removeItem: function (k) { data.delete(String(k)); },
        clear: function () { data.clear(); }
      };
    }
    try { Object.defineProperty(window, 'localStorage', { configurable: true, value: geheugen() }); } catch (e) {}
    try { Object.defineProperty(window, 'sessionStorage', { configurable: true, value: geheugen() }); } catch (e) {}
  })();

  var echteFetch = window.fetch && window.fetch.bind(window);
  if (echteFetch) {
    window.fetch = function (input, opties) {
      var rauw = typeof input === 'string' ? input : (input && input.url) || '';
      var url;
      try { url = new URL(rauw, location.href); } catch (e) { url = null; }
      if (url && url.origin === location.origin && url.pathname.indexOf('/api/') === 0) {
        return Promise.resolve(new Response(JSON.stringify({
          error: 'Magnaat gebruikt een afgeschermde trainingskopie.',
          magnaat: true
        }), { status: 409, headers: { 'Content-Type': 'application/json' } }));
      }
      return echteFetch(input, opties);
    };
  }

  // Ook oudere uploadschermen mogen geen API-verzoek via XMLHttpRequest doen.
  if (window.XMLHttpRequest && window.XMLHttpRequest.prototype) {
    var echteOpen = window.XMLHttpRequest.prototype.open;
    var echteSend = window.XMLHttpRequest.prototype.send;
    window.XMLHttpRequest.prototype.open = function (methode, url) {
      var doel;
      try { doel = new URL(String(url || ''), location.href); } catch (e) { doel = null; }
      this.__rtgMagnaatBlok = !!(doel && doel.origin === location.origin && doel.pathname.indexOf('/api/') === 0);
      return echteOpen.apply(this, arguments);
    };
    window.XMLHttpRequest.prototype.send = function () {
      if (this.__rtgMagnaatBlok) throw new DOMException('API-verkeer is uit in de Magnaat-trainingskopie.', 'NotAllowedError');
      return echteSend.apply(this, arguments);
    };
  }

  // Realtime-kanalen en peer-to-peerverbindingen horen nooit bij een missie.
  try { window.EventSource = undefined; } catch (e) {}
  try { window.WebSocket = undefined; } catch (e) {}
  try {
    window.RTCPeerConnection = function () {
      throw new DOMException('Niet beschikbaar in de Magnaat-trainingskopie.', 'NotAllowedError');
    };
  } catch (e) {}

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      navigator.mediaDevices.getUserMedia = function () {
        return Promise.reject(new DOMException('Camera en microfoon zijn uit in Magnaat.', 'NotAllowedError'));
      };
    } catch (e) {}
  }
  if (navigator.geolocation) {
    var geweigerd = function (succes, fout) {
      if (typeof fout === 'function') fout({ code: 1, message: 'Locatie is uit in Magnaat.' });
      return 0;
    };
    try { navigator.geolocation.getCurrentPosition = geweigerd; } catch (e) {}
    try { navigator.geolocation.watchPosition = geweigerd; } catch (e) {}
    try { navigator.geolocation.clearWatch = function () {}; } catch (e) {}
  }
  try { navigator.sendBeacon = function () { return false; }; } catch (e) {}
  try { window.open = function () { return null; }; } catch (e) {}
  if (navigator.serviceWorker && navigator.serviceWorker.register) {
    try {
      navigator.serviceWorker.register = function () {
        return Promise.reject(new DOMException('Geen serviceworker in Magnaat.', 'NotAllowedError'));
      };
    } catch (e) {}
  }

  /* Formulieren blijven lokaal. Links naar een ander bestaand RTG-scherm
     houden ?magnaat=1; alle andere navigatie blijft in het dossier. */
  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var doel;
    try { doel = new URL(a.getAttribute('href'), location.href); } catch (x) { doel = null; }
    if (!doel || doel.origin !== location.origin || doel.pathname.indexOf('/apps/') !== 0) {
      e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    doel.searchParams.set('magnaat', '1');
    a.href = doel.pathname + doel.search + doel.hash;
  }, true);
})();
