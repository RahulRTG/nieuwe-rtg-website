/* RTG scan-codes: het kleine, vaste formaat achter onze QR's. Een zaak print
   tafel- en entree-QR's, een lid toont een betaalcode; de scanner leest ze en
   deze module zegt wat het is. Bewust kort gehouden zodat de QR laag-versie en
   dus makkelijk leesbaar blijft. Bevat nooit persoonsdata: alleen een zaakcode,
   een tafelnaam of een tijdelijke betaalcode.

   Vormen:
     rtg:tafel:<zaakcode>:<tafel>   -> bestellen aan die tafel
     rtg:kas:<betaalcode>           -> lid laat de kassa de code scannen
     rtg:entree:<zaakcode>          -> inchecken bij een receptie/entree
     rtg:pin:<contactpin>           -> iemand toevoegen op zijn eigen pin
   Alles zonder 'rtg:' ervoor is gewone tekst (bv. een Zegel-token).

   De contactpin staat er LEESBAAR in, en dat is geen vergissing. Hij is geen
   geheim maar een adres (zie server/kern/sociaal/pin.js): een lid houdt hem
   voor, leest hem voor of laat hem scannen, en zonder dat hij aan te wijzen is
   heeft hij geen nut. Een vreemde die de code fotografeert kan er precies een
   ding mee: een vriendschapsverzoek sturen, dat de ander moet accepteren. */
(function (root) {
  'use strict';
  function bouwTafel(code, tafel) { return 'rtg:tafel:' + String(code || '') + ':' + encodeURIComponent(String(tafel == null ? '' : tafel)); }
  function bouwKas(code) { return 'rtg:kas:' + String(code || ''); }
  function bouwEntree(code) { return 'rtg:entree:' + String(code || ''); }
  // de contactpin zonder streepje: het scherm toont 'A1B2-C3D4', de code draagt
  // 'A1B2C3D4' -- de server normaliseert allebei, maar kort scant prettiger
  function bouwPin(pin) { return 'rtg:pin:' + String(pin || '').toUpperCase().replace(/[^0-9A-Z]/g, ''); }

  // lees een gescande tekst; geeft altijd een object met .soort terug
  function lees(tekst) {
    var s = String(tekst == null ? '' : tekst).trim();
    // de nieuwe, gesloten dynamische code: alleen de server kan hem duiden, dus
    // hier geven we enkel terug dat het er een is; de app haalt hem langs
    // /api/code/scan om te verifieren (verlopen/vreemd wordt daar geweigerd).
    if (s.slice(0, 5) === 'RTG1.') return { soort: 'rtg1', token: s };
    if (s.slice(0, 10) === 'rtg:tafel:') {
      var r = s.slice(10), i = r.indexOf(':');
      if (i < 0) return { soort: 'tafel', code: r, tafel: '' };
      var tafel = r.slice(i + 1);
      try { tafel = decodeURIComponent(tafel); } catch (e) {}
      return { soort: 'tafel', code: r.slice(0, i), tafel: tafel };
    }
    if (s.slice(0, 8) === 'rtg:kas:') return { soort: 'kas', code: s.slice(8) };
    if (s.slice(0, 8) === 'rtg:pin:') return { soort: 'pin', pin: s.slice(8) };
    if (s.slice(0, 11) === 'rtg:entree:') return { soort: 'entree', code: s.slice(11) };
    return { soort: 'tekst', tekst: s };
  }

  var api = { bouwTafel: bouwTafel, bouwKas: bouwKas, bouwEntree: bouwEntree, bouwPin: bouwPin, lees: lees };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RTGCode = api;
})(typeof self !== 'undefined' ? self : this);
