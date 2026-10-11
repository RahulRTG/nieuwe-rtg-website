/* WAT RAHUL VAN HET BLIKVELD ZIET -- en wat met opzet niet.

   EDGE.md punt 36: "Rahul leest het blikveld nog niet, en alleen via een
   positieve veldenlijst (AI-CONTEXT-01)." Tot hier bouwde de Rahul-helper zijn
   schermcontext uit de DOM van het BOVENDOCUMENT (document.title, `nav
   .actief`). In de schil van app.html is dat de schil zelf: welk blad er open
   staat, in welke wereld en waarnaar het wijst, zag Rahul niet -- terwijl het
   blikveld (./blikveld.js) dat allemaal al wist, met herkomst.

   DIT BESTAND IS EEN PROJECTIE EN GEEN TWEEDE CONTEXTMODEL. Het leest
   RTGEdgeBlikveld.lees() op het moment van vragen, onthoudt niets, schrijft
   niets terug en geeft precies de vorm die server/kern/stuur/menscontext.js
   al kent (`wereld`, `deel`, `verwijzingen` -- drie van zijn CONTRACTSLEUTELS).
   Er komt dus geen vijfde contextvorm bij; wat de server niet kent, wordt hier
   niet eens samengesteld.

   DE RICHTING IS DE HELE REGEL (AI-CONTEXT-01). Het antwoord wordt veld voor
   veld OPGEBOUWD uit MEE; er wordt nergens een blikveld of een veld gekopieerd
   met een spread en daarna iets uit verwijderd. Een NIEUW veld in het blikveld
   gaat daardoor niet vanzelf naar Rahul: het staat in geen van beide lijsten,
   en test/rahulzicht.test.js zakt tot iemand besluit in welke het hoort.

   WAT NIET MEEGAAT, MET DE REDEN (NIET_MEE). De identiteit niet (wie iemand is
   gaat langs de kluis en nooit langs de Edge, besluit 2), de voortzetting niet
   (de lijst open bladen is een spoor van waar iemand was -- besluit 1 en
   KOSTEN.md: tellers, geen journaal), de handelingen en de hoofdactie niet (wat
   Rahul mag klaarzetten bepaalt de SERVER met beleid.js en de resolver; een
   lijst knoppen van de client zou een capability suggereren die context nooit
   mag scheppen), en de rest omdat het contract er geen plek voor heeft.

   VAN EEN OBJECT GAAN ALLEEN SOORT EN ID MEE. Het label en de velden staan
   wel in het blikveld, maar menscontext.js gooit ze toch weg (`verwijzing()`:
   "de server kijkt dat zelf op, of het bestaat niet"), en een documenttitel
   naar een model sturen die de server niet eens leest, is een lek zonder nut.

   Levert window.RTGEdgeRahulzicht, en in node module.exports. */
(function (root, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (root && !root.RTGEdgeRahulzicht) root.RTGEdgeRahulzicht = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var WERELDEN = ['living', 'travel', 'work', 'foundation'];
  /* De herkomsten die zeggen dat het SCHERM (of het blad via de brug, of het
     casco van de Edge) het zelf zei. `document` staat er niet in: een kale
     paginatitel weet de helper zelf ook, en hem hier als blikveld-waarheid
     doorgeven zou herkomst verzinnen. */
  var TITELBRON = ['scherm', 'blad', 'edge-casco'];
  var GRENS = { deel: 70, soort: 24, id: 40 };

  var MEE = Object.freeze({
    wereld: 'de wereld waarin het scherm of het open blad staat (living, travel, work, foundation)',
    context: 'alleen de TITEL, en alleen als het scherm hem zelf zei; de server leest hem als `deel`',
    object: 'alleen soort en id, als verwijzing; de server zoekt het object zelf op of het bestaat niet'
  });
  var NIET_MEE = Object.freeze({
    identiteit: 'wie iemand is gaat langs de kluis en nooit langs de Edge (EDGE.md besluit 2)',
    activiteit: 'het contract van menscontext.js heeft er geen plek voor; samenstellen wat niemand leest is een lek zonder nut',
    presence: 'wie of wat er meekijkt is geen context voor een vraag, en kan een naam dragen (besluit 2)',
    voortzetting: 'de lijst open bladen is een spoor van waar iemand was (besluit 1); een gedragslogboek gaat niet naar een model',
    hoofdactie: 'wat Rahul mag klaarzetten bepaalt de server (beleid.js, resolver.js); context schept nooit een capability',
    trust: 'de Trust Rail toont een toestand aan een mens; het contract kent hem niet',
    bevoegdheid: 'de Edge verleent niets, en de server weet zelf wat iemand mag'
  });

  function kort(x, n) {
    return String(x == null ? '' : x).replace(/[\x00-\x1f\x7f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  }
  function woord(x, n) {
    return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, n);
  }

  /* Van een blikveld (de uitslag van lees()) naar de context voor Rahul.
     Geeft null als er niets bruikbaars in staat -- dan houdt de aanroeper wat
     hij zelf al had, en zegt deze laag niet dat ze iets zag. */
  function projecteer(blik) {
    var v = blik && blik.velden;
    if (!v || typeof v !== 'object') return null;
    var context = {}, herkomst = {}, iets = false;

    var w = v.wereld;
    if (w && WERELDEN.indexOf(w.waarde) >= 0) {
      context.wereld = w.waarde; herkomst.wereld = String(w.herkomst || ''); iets = true;
    }
    var c = v.context, cw = c && c.waarde;
    if (cw && TITELBRON.indexOf(c.herkomst) >= 0 && kort(cw.titel, GRENS.deel)) {
      context.deel = kort(cw.titel, GRENS.deel); herkomst.deel = String(c.herkomst); iets = true;
    }
    var o = v.object, ow = o && o.waarde;
    if (ow && ow.id != null && String(ow.id) !== '') {
      context.verwijzingen = [{ soort: woord(ow.soort, GRENS.soort) || 'onbekend', id: kort(ow.id, GRENS.id) }];
      herkomst.verwijzingen = String(o.herkomst || ''); iets = true;
    }
    return iets ? { context: context, herkomst: herkomst } : null;
  }

  /* Leest het blikveld van dit venster. Zacht: zonder blikveld, of als het
     gooit, is er niets gezien -- en dat is geen fout. */
  function lees(w) {
    var B = w && w.RTGEdgeBlikveld;
    if (!B || typeof B.lees !== 'function') return null;
    try { return projecteer(B.lees()); } catch (e) { return null; }
  }

  return Object.freeze({ projecteer: projecteer, lees: lees, MEE: MEE, NIET_MEE: NIET_MEE });
}));
