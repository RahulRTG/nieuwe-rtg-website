/* EEN ZWARE HANDELING VANAF HET SCHERM -- sturen, en als de server om een
   passkey vraagt, die ceremonie doen en opnieuw sturen.

   WAAROM DIT BESTAND ER IS. De server kent de zware poort al lang
   (server/kern/zwaarbewijs.js): hij antwoordt 401 met `bevestigingNodig` en de
   actienaam, en het loket voor de ceremonie staat klaar
   (/api/office/boardroom/bevestig/opties, /api/techniek/bevestig/opties). Maar
   geen enkel scherm las dat antwoord. Zolang de eigenaar geen passkey had, viel
   dat niet op -- de poort laat dan door met een melding op het
   beveiligingsbord -- en zodra hij er een zette, liep elke zware knop vast op
   "Bevestig deze handeling met uw passkey." zonder een weg om dat te doen. Op
   apps/kantoren.html was het erger: daar logt een 401 je uit.

   WAT HIER NIET IN ZIT. De binaire vertaling (dat is ./passkey.js, en die moet
   op de pagina geladen zijn), en het oordeel of iets mag. De server beslist; dit
   bestand draagt het gesprek alleen over de drempel.

   Geeft een belofte op het antwoord van de server, of verwerpt met een Error
   waarvan de tekst voor een mens bedoeld is. Een mens die zijn vinger weghaalt
   krijgt dus een gewone melding, geen foutscherm. */
(function (global) {
  'use strict';

  function stuur(pad, body, token) {
    return fetch(pad, { method: 'POST', body: JSON.stringify(body || {}),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') }
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, ok: r.ok, d: d }; });
    });
  }

  /* opties: { token, optiesPad } -- het loket hoort bij de deur waar de
     handeling doorheen gaat, en dat weet alleen de aanroeper. */
  function doe(pad, body, opties) {
    var o = opties || {};
    return stuur(pad, body, o.token).then(function (a) {
      if (a.ok) return a.d;
      if (!(a.status === 401 && a.d && a.d.bevestigingNodig && a.d.actie)) {
        throw new Error((a.d && a.d.error) || 'Dat lukte niet.');
      }
      if (!global.RTGPasskey || !global.RTGPasskey.bevestig) {
        throw new Error('Deze handeling vraagt uw passkey, en dit scherm kan die ceremonie niet starten.');
      }
      return global.RTGPasskey.bevestig(function () {
        return stuur(o.optiesPad, { actie: a.d.actie }, o.token).then(function (x) { return x.d; });
      }).then(function (b) {
        if (!b || b.fout) throw new Error((b && b.fout) || 'De bevestiging is niet gelukt.');
        var tweede = Object.assign({}, body || {}, { ceremonie: b.ceremonie, antwoord: b.antwoord });
        return stuur(pad, tweede, o.token).then(function (c) {
          if (!c.ok) throw new Error((c.d && c.d.error) || 'Dat lukte niet.');
          return c.d;
        });
      });
    });
  }

  global.RTGZwaar = { doe: doe };
})(typeof window !== 'undefined' ? window : this);
