/* DE HOOFDACTIE ZOALS DE EDGE HEM ZIET -- in dit document, of in het actieve blad.

   Een eigen bestand en geen regels in blikveld.js: dat stond tegen de 10 KB van
   scripts/check.js regel 13 aan, en "welk blad kijk ik in" is een eigen onderwerp.
   Dezelfde snede als command/bladstand.js uit werktafel.js.

   WAT DE SCHIL NIET ZAG (EDGE.md par. 2). Een scherm in een blad laadt zijn eigen
   Edge niet; de schil claimt hem. Een [data-hoofdactie] in dat blad staat in een
   ander document, dus meldde het blikveld van de schil "het scherm wijst geen
   hoofdactie aan" -- een lege waarde met een reden die niet klopte.

   WAAROM LEZEN MAG, terwijl adaptief/brug.js het "graaien" noemt: de schil leest
   hier niets van de BINNENKANT van een app, alleen wat het scherm voor de Edge
   heeft verklaard (data-hoofdactie, GRAMMATICA.md), en onder de drie eisen van de
   brug -- alleen het ACTIEVE blad, alleen dezelfde herkomst, alleen platte tekst.
   De brug zelf kon het niet: van de schermen met een data-hoofdactie laden er
   vrijwel geen de brug, en wie hem laadt meldt bij binnenkomst geen context.

   Het schrijft NIETS, ook niet in het blad, en het onthoudt niets: elke lees()
   kijkt opnieuw. Een kopie van het label in de schil zou een tweede plek zijn die
   de waarheid vasthoudt (LAT.md regel 4) en achterlopen zodra het blad wisselt. */
(function (root, fabriek) {
  'use strict';
  if (typeof module === 'object' && module.exports) { module.exports = fabriek(); return; }
  if (root && root.document && !root.RTGEdgeBlikveldHoofdactie) root.RTGEdgeBlikveldHoofdactie = fabriek();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  /* AANGEWEZEN, niet getekend: de Edge neemt de balk van het scherm op in zijn
     eigen (dichte) blad of contextpaneel, dus een voorouder is dan [hidden] en
     de maat is 0x0. De vraag is of het scherm een hoofdactie aanwijst. */
  function aangewezen(el) { return !!el && !el.disabled && !el.hidden; }
  /* De Ga verder-toets zet vier teksten in de knop; het label is die in rust. */
  function tekstVan(el) {
    var rust = el && el.querySelector && el.querySelector('[data-rtg-action-copy-for="idle"]');
    return String((el && (el.getAttribute('aria-label') || (rust || el).textContent)) || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  /* Het actieve blad: null als er geen is, anders zijn document of de reden
     waarom het niet te lezen is. Dezelfde selector als de brug. */
  function blad(w) {
    var f = w.document.querySelector('#rtgCommand .cmd-pane.actief iframe');
    if (!f) return null;
    try {
      var bw = f.contentWindow, bd = f.contentDocument;
      if (!bw || !bd || bw.location.origin !== w.location.origin) return { reden: 'het blad is niet van dezelfde herkomst; de schil leest daar niets' };
      if (bw.location.pathname === 'blank' || bd.readyState === 'loading') return { reden: 'het blad laadt nog' };
      return { doc: bd };
    } catch (e) { return { reden: 'het blad is vanuit de schil niet te lezen' }; }
  }
  function lees(w) {
    var d = w.document, b = blad(w), gebreken = [];
    if (b && !b.doc) return { label: null, herkomst: 'blad', reden: b.reden, gebreken: gebreken };
    var scherm = Array.prototype.filter.call((b ? b.doc : d).querySelectorAll('[data-hoofdactie]'), aangewezen);
    var edge = d.querySelector('[data-rtg-edge-primary]:not([hidden])');
    var edgeLabel = aangewezen(edge) ? tekstVan(edge) : '';
    if (scherm.length > 1) gebreken.push('hoofdactie-meervoudig');
    if (scherm.length && edgeLabel && edgeLabel !== tekstVan(scherm[0])) gebreken.push('hoofdactie-dubbel');
    if (scherm.length) return { label: tekstVan(scherm[0]), herkomst: b ? 'blad:data-hoofdactie' : 'scherm:data-hoofdactie', gebreken: gebreken };
    /* Geen terugval op de Edge van de SCHIL: die hoort bij app.html en niet bij
       het blad, en de padtabel van Edge 2 draait in een blad niet. */
    if (b) return { label: null, herkomst: 'blad', gebreken: gebreken,
      reden: 'het blad wijst geen hoofdactie aan (data-hoofdactie); de padtabel van Edge 2 draait niet in een blad' };
    if (edgeLabel) return { label: edgeLabel, herkomst: 'edge-padtabel', gebreken: gebreken };
    return { label: null, herkomst: 'geen', gebreken: gebreken, reden: 'het scherm wijst geen hoofdactie aan (GRAMMATICA.md: data-hoofdactie)' };
  }
  return Object.freeze({ lees: lees });
}));
