/* Alleen actief in de expliciete Magnaat-trainingskopie van de echte RTG-app.
   De schermen en lokale demo-interacties blijven echt; verkeer naar API's en
   toegang tot apparaatfuncties worden vóór de overige app-code afgevangen. */
(function () {
  'use strict';
  var proef = new URLSearchParams(location.search).get('magnaat') === '1';
  if (!proef) return;

  window.RTG_MAGNAAT_PROEF = true;

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
  if (navigator.serviceWorker && navigator.serviceWorker.register) {
    try {
      navigator.serviceWorker.register = function () {
        return Promise.reject(new DOMException('Geen serviceworker in Magnaat.', 'NotAllowedError'));
      };
    } catch (e) {}
  }
})();
