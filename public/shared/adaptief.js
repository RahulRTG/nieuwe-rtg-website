/* DE ADAPTIEVE LAAG: dezelfde capability, opnieuw samengesteld voor het apparaat.

   WAAROM DIT BESTAAT. Een desktopscherm verkleinen is geen mobiel ontwerp. Wat
   er dan gebeurt is elke keer hetzelfde: de werkbalk past niet, dus gaat hij op
   `display:none`, en daarmee is de handeling weg -- niet verplaatst maar weg.
   Bij 184 schermen wordt dat 184 losse uitzonderingen, en niemand kan meer
   zeggen wat een lid op zijn telefoon nog kán.

   DE REGEL, IN EEN ZIN: bureau toont veel context tegelijk, telefoon toont EEN
   duidelijke taak met zijn context en handelingen binnen bereik -- en de
   capability zelf verandert niet, alleen zijn vorm.

   Dit bestand is de LEER en niet het meubel: maten, de namen van de vormen, en
   de keuring die zegt of een declaratie deugt. Geen DOM, geen stijl, geen
   register -- die staan in shared/adaptief/. Zo kan test/adaptief.test.js deze
   regels in Node meten zonder browser, en meet hij de regel zelf en niet een
   kopie ervan (LAT.md regel 4).

   Levert window.RTGAdaptiefLeer, en in Node module.exports. */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------- de maten --
     EEN GRENS, OP EEN PLEK. shared/command.css kent 1000px al als de breedte
     waarop de bank een vaste rail wordt; die grens is hier de ondergrens van
     `bureau` en niet een tweede getal dat er toevallig naast ligt. Wie hem
     verzet, verzet hem hier, en test/adaptief.test.js meet of het blad meeging.

     RAAK is 44 en niet 24. TOEGANKELIJK.md houdt 24x24 aan als harde poort --
     dat is WCAG 2.2 AA, de ondergrens waaronder iets kapot is. Deze laag is
     geen ondergrens maar een ontwerp voor duimen, en dan is 44 de maat. De
     poort blijft de poort; dit is strenger en mag dat zijn. */
  var MAAT = { telefoon: 0, tablet: 640, bureau: 1000 };
  var RAAK = 44;

  /* De vormen, van klein naar groot. `stem` staat er los van: dat is geen
     breedte maar een kanaal, en een capability die alleen met stem bestaat
     bestaat op geen enkel scherm. Hij telt dus niet mee in de reeks. */
  var REEKS = ['telefoon', 'tablet', 'bureau'];
  var VORMEN = REEKS.concat(['stem']);

  /* ---------------------------------------------------------- de vormtaal --
     Welke presentaties er zijn, op welke vorm ze thuishoren, hoeveel
     handelingen ze diep liggen, en of ze DOMINANT zijn.

     `diepte` telt tikken vanaf het scherm waar je staat tot de handeling
     gedaan is. Een knop die er al staat is 1. Iets wat eerst een laag moet
     openen is 2. Iets in een tweede laag daarbinnen is 3, en dat is de grens.

     `dominant` betekent: hij legt beslag op het scherm en er kan er maar EEN
     van tegelijk open zijn. Twee laden over elkaar is de vorm waarin een mens
     niet meer weet waar "terug" heen gaat. */
  var PRESENTATIES = {
    werkbalk:       { vormen: ['tablet', 'bureau'], diepte: 1, dominant: false },
    contextmenu:    { vormen: ['tablet', 'bureau'], diepte: 2, dominant: false },
    sneltoets:      { vormen: ['bureau'],           diepte: 1, dominant: false },
    contextvlak:    { vormen: ['tablet', 'bureau'], diepte: 1, dominant: false },
    selectiepopover:{ vormen: ['tablet'],           diepte: 1, dominant: false },
    selectiebalk:   { vormen: ['telefoon', 'tablet'], diepte: 1, dominant: false },
    balk:           { vormen: ['telefoon', 'tablet'], diepte: 1, dominant: false },
    lade:           { vormen: ['telefoon', 'tablet'], diepte: 2, dominant: true },
    paneel:         { vormen: ['telefoon', 'tablet', 'bureau'], diepte: 2, dominant: true },
    taakmodus:      { vormen: ['telefoon', 'tablet'], diepte: 2, dominant: true },
    gesprek:        { vormen: ['stem'],              diepte: 1, dominant: false }
  };

  function lijst(x) { return Array.isArray(x) ? x.slice() : (x ? [x] : []); }

  /* ------------------------------------------------------- normaliseren --
     Een declaratie mag kort geschreven worden (een string in plaats van een
     lijst). Wat hieronder uitkomt is altijd dezelfde vorm, zodat de keuring en
     het register niet allebei hoeven te raden. */
  function normaliseer(spec) {
    var c = { id: String((spec && spec.id) || ''), naam: String((spec && spec.naam) || ''),
      groep: (spec && spec.groep) || '', primair: !!(spec && spec.primair), vormen: {} };
    VORMEN.forEach(function (v) { c.vormen[v] = lijst(spec && spec[v]); });
    if (spec && typeof spec.doe === 'function') c.doe = spec.doe;
    if (spec && spec.teken) c.teken = spec.teken;
    if (spec && spec.label) c.label = spec.label;
    return c;
  }

  /* De diepte van een capability op een vorm: de KORTSTE weg die hij daar
     heeft. Een handeling die zowel in de balk als in de lade staat, is 1 diep
     -- de lade is dan de uitgebreide vorm en niet de enige weg. Nul vormen is
     geen diepte maar afwezigheid, en dat is wat gebrek() meet. */
  function diepte(cap, vorm) {
    var d = 0;
    (cap.vormen[vorm] || []).forEach(function (p) {
      var P = PRESENTATIES[p];
      if (!P) return;
      if (!d || P.diepte < d) d = P.diepte;
    });
    return d;
  }

  /* ------------------------------------------------------------ de keuring --
     Vijf bevindingen, en de eerste is de reden dat deze laag bestaat.

     `verdwenen`  -- op bureau wel, op telefoon niet. Dit IS de fout waar het
                     hele document over gaat: functionaliteit die op een klein
                     scherm gewoon ophoudt te bestaan. Een lege lijst is hier
                     geen "niet van toepassing" maar een gat.
     `onbekend`   -- een presentatie die niet bestaat. Een typefout in een
                     declaratie hoort niet stil een lege balk op te leveren.
     `misplaatst` -- een presentatie op een vorm waar hij niet hoort (een
                     sneltoets op een telefoon, een lade op een bureau).
     `tediep`     -- meer dan drie handelingen om erbij te komen.
     `dubbeldominant` -- twee dominante lagen op dezelfde vorm. Dan is al bij de
                     declaratie besloten dat er twee dingen tegelijk open gaan.

     Puur: geen DOM, geen globale staat. Wat erin gaat is een lijst declaraties,
     wat eruit komt is een lijst bevindingen. */
  function keur(specs) {
    var uit = [];
    (Array.isArray(specs) ? specs : []).forEach(function (spec) {
      var c = spec && spec.vormen ? spec : normaliseer(spec);
      var waar = c.id || '(zonder id)';
      if (!c.id) uit.push({ soort: 'naamloos', id: waar, wat: 'een capability zonder id' });
      if (!c.naam) uit.push({ soort: 'naamloos', id: waar, wat: 'een capability zonder naam' });
      var opBureau = (c.vormen.bureau || []).length;
      if (opBureau && !(c.vormen.telefoon || []).length) {
        uit.push({ soort: 'verdwenen', id: waar,
          wat: 'bestaat op bureau maar heeft geen vorm op telefoon' });
      }
      REEKS.concat(['stem']).forEach(function (v) {
        var dom = 0;
        (c.vormen[v] || []).forEach(function (p) {
          var P = PRESENTATIES[p];
          if (!P) { uit.push({ soort: 'onbekend', id: waar, wat: 'presentatie "' + p + '" bestaat niet' }); return; }
          if (P.vormen.indexOf(v) < 0) uit.push({ soort: 'misplaatst', id: waar, wat: '"' + p + '" hoort niet op ' + v });
          if (P.dominant) dom++;
        });
        if (dom > 1) uit.push({ soort: 'dubbeldominant', id: waar, wat: v + ' krijgt ' + dom + ' dominante lagen' });
        var d = diepte(c, v);
        if (d > 3) uit.push({ soort: 'tediep', id: waar, wat: v + ' ligt ' + d + ' handelingen diep' });
      });
    });
    return uit;
  }

  /* De vorm bij een breedte. Eén trap, van groot naar klein, zodat er geen
     breedte bestaat die tussen twee vormen in valt. */
  function vormBij(breedte) {
    var b = Number(breedte) || 0;
    if (b >= MAAT.bureau) return 'bureau';
    if (b >= MAAT.tablet) return 'tablet';
    return 'telefoon';
  }

  /* Wat toont deze capability HIER? De presentaties van deze vorm, op volgorde
     van ondiep naar diep -- zo staat wat in de balk past vooraan en valt de rest
     vanzelf in de overloop. */
  function presentaties(cap, vorm) {
    var c = cap && cap.vormen ? cap : normaliseer(cap);
    return (c.vormen[vorm] || []).filter(function (p) { return !!PRESENTATIES[p]; })
      .sort(function (a, b) { return PRESENTATIES[a].diepte - PRESENTATIES[b].diepte; });
  }

  var leer = { MAAT: MAAT, RAAK: RAAK, VORMEN: VORMEN, REEKS: REEKS,
    PRESENTATIES: PRESENTATIES, normaliseer: normaliseer, keur: keur,
    diepte: diepte, vormBij: vormBij, presentaties: presentaties };

  if (typeof module !== 'undefined' && module.exports) { module.exports = leer; return; }
  root.RTGAdaptiefLeer = leer;
})(typeof self !== 'undefined' ? self : this);
