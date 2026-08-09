/* De toegankelijkheidslaag, de trage helft.

   De SNELLE helft staat bovenin shared/basis.js: die leest de stand uit
   localStorage en zet hem meteen op <html>, want wie grote tekst nodig heeft
   heeft hem nodig bij het eerste beeld. Dit bestand doet de rest, en mag
   daarvoor de tijd nemen:

   - de stand bij de server ophalen, zodat een tweede toestel hem ook krijgt;
   - de stand zetten vanuit het scherm dat hem laat instellen (apps/ik.html).

   De server is de eigenaar, localStorage is de kopie die snel is. Als ze uit
   elkaar lopen wint de server, want daar heeft het lid hem gezet. Zonder
   account is er niets om op te halen: dan blijft de plaatselijke stand staan
   en werkt alles gewoon, alleen niet op een ander toestel. */
(function () {
  'use strict';
  if (window.RTGToegankelijk) return;

  var SLEUTEL = 'rtg_toegankelijk';
  var KLASSEN = {
    tekst: { groot: 'rtg-tekst-groot', groter: 'rtg-tekst-groter' },
    contrast: { hoog: 'rtg-contrast' },
    beweging: { stil: 'rtg-stil' },
    links: { streep: 'rtg-linkstreep' }
  };

  function lees() {
    try { return JSON.parse(localStorage.getItem(SLEUTEL) || 'null') || {}; } catch (e) { return {}; }
  }

  /* Elke klas die dit profiel kent gaat er eerst af en daarna weer op wat er
     aan hoort te staan. Alleen toevoegen zou betekenen dat 'terug naar
     normaal' niets doet -- de stille variant van een instelling die vastzit. */
  function pas(profiel) {
    var el = document.documentElement;
    for (var veld in KLASSEN) {
      for (var waarde in KLASSEN[veld]) el.classList.remove(KLASSEN[veld][waarde]);
    }
    for (var v in KLASSEN) {
      var k = KLASSEN[v][(profiel || {})[v]];
      if (k) el.classList.add(k);
    }
  }

  function bewaarLokaal(profiel) {
    try { localStorage.setItem(SLEUTEL, JSON.stringify(profiel || {})); } catch (e) {}
    pas(profiel);
  }

  function token() {
    try { return localStorage.getItem('rtg_member_token') || null; } catch (e) { return null; }
  }

  function roep(pad, body) {
    var t = token();
    if (!t) return Promise.resolve(null);
    return fetch(pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  /* Ophalen bij de server en de plaatselijke kopie bijwerken. Levert null op
     als er geen account is of de server niet bereikbaar is; de aanroeper hoort
     dan NIETS te wissen, want een lege stand is hier niet hetzelfde als
     "normaal" -- dat zou de instelling van iemand stil uitzetten zodra hij
     even offline is. */
  function haal() {
    return roep('/api/ik/toegankelijk', {}).then(function (d) {
      if (d && d.toegankelijk) bewaarLokaal(d.toegankelijk);
      return d ? d.toegankelijk : null;
    });
  }

  function zet(deel) {
    var nieuw = lees();
    for (var k in deel) nieuw[k] = deel[k];
    bewaarLokaal(nieuw); // meteen zichtbaar, ook als de server traag is
    return roep('/api/ik/toegankelijk/zet', deel).then(function (d) {
      if (d && d.toegankelijk) bewaarLokaal(d.toegankelijk); // de server heeft het laatste woord
      return d;
    });
  }

  window.RTGToegankelijk = { lees: lees, zet: zet, haal: haal, pas: pas };
  haal();
})();
