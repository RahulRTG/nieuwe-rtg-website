/* DE STAND VAN EEN HANDELING IN DE EDGE -- vier woorden, en geen vijfde.

   Een handeling staat in de Edge in precies een van vier standen:

     AFWEZIG      bestaat voor deze principal in deze context niet; niet tonen.
     GEBLOKKEERD  bestaat, maar kan nu niet; tonen MET een reden (waarom).
     BESCHIKBAAR  uitvoerbaar.
     LOPEND       loopt al, of wacht op een andere partij.

   (In het voorstel van 23 september 2026 heetten ze ABSENT, BLOCKED, AVAILABLE
   en PENDING; dit huis schrijft zijn standen in het Nederlands, zie EDGE.md.)

   WAT DEZE MODULE NIET DOET, en dat is de hele reden dat hij klein is:

   - Hij VERLEENT GEEN BEVOEGDHEID. Een oordeel telt alleen als het van de server
     komt (`oordeel.bron === 'server'`); elk ander oordeel wordt genegeerd en als
     gebrek gemeld. De Edge presenteert bevoegdheid, hij verleent haar nooit.
   - Hij verzint GEEN ZWAARTE. Het gewicht, de bevestiging en de reden komen uit
     de tabellen van shared/adaptief/grammatica.js (RTGGrammatica). Een tweede
     tabel hier zou de zesde gezagsschaal zijn (INT-01, EXECUTIE.md).
   - Hij beslist NIET wat urgent is. Gewicht is de zwaarte van een handeling;
     voorrang (wat nu zichtbaar moet zijn) is een andere vraag, voor een andere
     laag (EDGE.md, ronde 3).

   Puur: geen DOM, geen opslag, geen netwerk. Laadt in de browser als
   window.RTGEdgeActiestaat en in Node via require (test/edgeactiestaat.test.js). */
(function (root, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RTGEdgeActiestaat = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STAAT = Object.freeze({ AFWEZIG: 'AFWEZIG', GEBLOKKEERD: 'GEBLOKKEERD',
    BESCHIKBAAR: 'BESCHIKBAAR', LOPEND: 'LOPEND' });

  /* De uitkomsten die een SERVERoordeel kan hebben. `onbekend` is met opzet geen
     weigering: een storing hoort niet te klinken als een overtreding
     (CONTROLPLANE.md). Zonder oordeel is het gezag `onbekend`, en dat staat er. */
  var OORDEEL = Object.freeze(['toegestaan', 'geblokkeerd', 'afwezig', 'onbekend']);

  /* Wat een gevolg-graad voor de mens betekent. De graden zelf komen van
     server/kern/stuur/gevolg.js. 'onbekend' zegt NOOIT "geen gevolgen": dat de
     proef er niet bij kwam, is iets anders dan dat er niets gebeurt. */
  var GEVOLG = Object.freeze({
    gemeten: { klasse: 'bekend', tekst: 'Wat dit aanraakt is gemeten.' },
    'geen-effect-gemeten': { klasse: 'bekend', tekst: 'Gemeten: dit verandert niets aan opgeslagen gegevens.' },
    onvolledig: { klasse: 'onvolledig', tekst: 'Een deel van wat dit verandert is gemeten; de rest niet.' },
    onbekend: { klasse: 'onbekend', tekst: 'Wat dit verandert is niet gemeten.' }
  });

  var HERSTEL = Object.freeze(['exact', 'compensatie', 'geen', 'onbekend']);

  /* De bevestiging volgt uit de VLAGGEN van de trap, niet uit een eigen lijst:
     mens -> klaarzetten, nakijken en vasthouden; reden -> reden en vasthouden;
     vraagt -> een lade die zegt wat er gebeurt; ongedaan -> doen, met
     "Ongedaan maken" erna; anders -> gewoon doen. Zo loopt dit nooit uit de pas
     met gewicht.js, dat op dezelfde tabel draait. */
  function bevestigingVan(g) {
    if (!g) return 'geen';
    if (g.mens) return 'klaarzetten+nakijken+vasthouden';
    if (g.reden) return 'reden+vasthouden';
    if (g.vraagt) return 'lade';
    if (g.ongedaan) return 'ongedaan-maken';
    return 'geen';
  }

  function tekst(x) { return typeof x === 'string' ? x : ''; }

  /* bepaal(invoer, gram) -> de stand van EEN handeling.

     invoer: { id, gewicht, verhinderd, ongedaan (bool of functie), herstel,
               loopt (bool), effect ('lokaal' | 'server'), gevolg (graad),
               oordeel: { bron, uitkomst, reden, redenBron } }
     gram:   RTGGrammatica (in de browser window.RTGGrammatica; in Node de
             require van shared/adaptief/grammatica.js). Zonder gram is er geen
             gewichtstabel en dan is ALLES wat niet licht is geblokkeerd -- faal
             dicht, zoals balkknop.js doet zonder gewichtlaag. */
  function bepaal(invoer, gram) {
    var i = invoer || {}, gebreken = [];
    var G = gram && gram.GEWICHT ? gram.GEWICHT : null;

    var gevraagd = i.gewicht || 'licht';
    if (G && !G[gevraagd]) gebreken.push('onbekend-gewicht');

    var herstel = HERSTEL.indexOf(i.herstel) >= 0 ? i.herstel : 'onbekend';
    /* Een creditnota wist geen factuur (HERSTELPROEF.json, EXECUTIE.md): wat alleen
       met een tegenboeking te herstellen is, heeft geen weg terug. */
    var kanOngedaan = !!i.ongedaan && herstel !== 'compensatie';
    if (gevraagd === 'terug' && !kanOngedaan) {
      gebreken.push(herstel === 'compensatie' ? 'compensatie-als-ongedaan' : 'terug-zonder-ongedaan');
    }
    /* Het werkelijke gewicht komt uit dezelfde regel als gewicht.js gebruikt
       (grammatica.effectief), zodat tonen en uitvoeren niet uit elkaar lopen.
       Zonder tabel blijft het gevraagde staan en gaat hieronder dicht; zou het
       `licht` worden, dan faalde een plechtige handeling juist open. */
    var gewicht = G && gram.effectief ? gram.effectief(gevraagd, kanOngedaan) : String(gevraagd);

    var g = G ? G[gewicht] : null;
    var gevolgGraad = GEVOLG[i.gevolg] ? i.gevolg : 'onbekend';

    /* GEZAG: alleen de server verleent. Een oordeel van elders telt niet. */
    var oordeel = null, gezag = i.effect === 'lokaal' ? 'lokaal' : 'onbekend';
    if (i.oordeel) {
      if (i.oordeel.bron === 'server' && OORDEEL.indexOf(i.oordeel.uitkomst) >= 0) { oordeel = i.oordeel; gezag = 'server'; }
      else gebreken.push('oordeel-niet-van-server');
    }

    var uit = { id: tekst(i.id), staat: STAAT.BESCHIKBAAR, waarom: null, gewicht: gewicht,
      bevestiging: bevestigingVan(g), ongedaan: kanOngedaan && gewicht === 'terug',
      herstel: herstel, gezag: gezag,
      gevolg: { graad: gevolgGraad, klasse: GEVOLG[gevolgGraad].klasse, tekst: GEVOLG[gevolgGraad].tekst },
      gebreken: gebreken };

    if (oordeel && oordeel.uitkomst === 'afwezig') { uit.staat = STAAT.AFWEZIG; return uit; }

    var h = null;
    if (oordeel && oordeel.uitkomst === 'geblokkeerd') {
      h = { reden: tekst(oordeel.reden), bron: oordeel.redenBron || 'bevoegdheid' };
    } else if (i.verhinderd) {
      h = i.verhinderd;
    } else if (!G && gewicht !== 'licht') {
      h = { reden: 'De bevestigingslaag is hier niet geladen; een zware handeling gaat daarom niet door.', bron: 'toestand' };
    }
    if (h) {
      var v = gram && gram.verhindering ? gram.verhindering(h)
        : { reden: tekst(typeof h === 'string' ? h : h.reden), bron: 'toestand', los: true, stap: '' };
      if (!v.reden) {
        gebreken.push('redenloos');
        v.reden = gram && gram.uitleg ? gram.uitleg(v) : 'Dit kan nu niet.';
      }
      uit.staat = STAAT.GEBLOKKEERD; uit.waarom = v; uit.ongedaan = false;
      return uit;
    }
    if (i.loopt) uit.staat = STAAT.LOPEND;
    return uit;
  }

  return Object.freeze({ STAAT: STAAT, OORDEEL: OORDEEL, GEVOLG: GEVOLG, HERSTEL: HERSTEL,
    bevestigingVan: bevestigingVan, bepaal: bepaal });
}));
