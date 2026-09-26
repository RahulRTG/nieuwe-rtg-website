/* EEN ZWARE HANDELING MET DE PASSKEY AFMAKEN.

   De server (server/kern/zwaarbewijs.js) antwoordt op een zware handeling
   zonder bevestiging met 401 en `bevestigingNodig`. Twee schermen deden daar
   niets mee: kantoren.html las ELKE 401 als "uitgelogd" en stuurde de eigenaar
   naar de inlog, en boardroom.html toonde alleen de zin. Met een passkey op het
   account was boardroom-toegang geven daardoor vanaf het scherm niet te doen.

   Deze helper doet het ene stukje dat die schermen misten: vangt hij de vraag
   om een bevestiging, dan tekent de browser (via /shared/passkey.js, geen
   tweede kopie van de ceremonie) en gaat dezelfde handeling nog EEN keer, met
   het bewijs erbij. Geen lus: een tweede weigering gaat gewoon terug.

   doe(extra)         -> Promise<{ status, body }>; extra is {} of { ceremonie, antwoord }
   vraagOpties(actie) -> Promise<body van .../bevestig/opties> */
(function (global) {
  'use strict';
  function metVinger(doe, vraagOpties) {
    return Promise.resolve(doe({})).then(function (r) {
      if (!r || r.status !== 401 || !r.body || !r.body.bevestigingNodig) return r;
      if (!global.RTGPasskey) {
        return { status: 401, body: { error: 'Bevestig deze handeling met uw passkey; deze pagina kon de passkey niet starten.' } };
      }
      return global.RTGPasskey.bevestig(function () { return vraagOpties(r.body.actie); }).then(function (b) {
        if (b.fout) return { status: 401, body: { error: b.fout } };
        return doe({ ceremonie: b.ceremonie, antwoord: b.antwoord });
      });
    });
  }
  global.RTGZwaar = { metVinger: metVinger };
})(typeof window !== 'undefined' ? window : this);
