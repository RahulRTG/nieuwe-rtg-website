/* DE BRUG OVER DE FRAME-GRENS.

   HET PROBLEEM, IN EEN ZIN: de balk staat in het bovendocument en de selectie
   gebeurt in een werkblad, en dat werkblad is een iframe (shared/command/
   werktafel.js, toon()). Een tekstverwerker die "er staat nu tekst geselecteerd"
   roept, roept dat dus in een ander document dan waar de knoppen staan.

   Zonder brug zijn er twee slechte uitwegen. De ene is dat de balk in het
   werkblad gaat wonen -- dan heeft elk werkblad zijn eigen balk en zijn we terug
   bij honderd uitzonderingen. De andere is dat het bovendocument in het frame
   gaat graaien -- dan kent de schil de binnenkant van elke app, en dat is
   precies wat de schil niet mag weten (WERKRUIMTE.md).

   Wat er wél kan: het werkblad stuurt zijn DECLARATIES en zijn CONTEXT omhoog,
   en krijgt handelingen terug omlaag. Beide kanten kennen alleen ids.

   DRIE DINGEN DIE HIER BEWAKEN, EN ALLE DRIE OM EEN REDEN:

   1. Alleen dezelfde herkomst. Een bericht van elders is geen context maar een
      poging om de balk van een lid te laten zeggen wat iemand anders wil.
   2. Alleen het ACTIEVE blad. Twee bladen kunnen naast elkaar staan; zonder deze
      eis zou het blad waar je niet naar kijkt de balk overnemen -- en dan wijst
      "vet" naar het verkeerde document.
   3. Alleen wat serialiseerbaar is. Een teken is in het frame een SVG-element;
      dat gaat niet over de grens. Wat overgaat is het label, en dat is genoeg:
      de balk toont letters waar hij geen glyf heeft.

   Levert niets aan de buitenkant; hij hangt zichzelf op aan beide kanten. */
(function (w, d) {
  'use strict';
  var A = w.RTGAdaptief;
  if (!A) return;
  var HERKOMST = w.location.origin;
  var MERK = 'rtg-adaptief';

  /* Wat er van een declaratie over de grens gaat. Geen functies, geen DOM --
     alleen de afspraak zelf. */
  function plat(c) {
    return { id: c.id, naam: c.naam, label: c.label || c.naam, groep: c.groep,
      primair: !!c.primair, telefoon: c.vormen.telefoon, tablet: c.vormen.tablet,
      bureau: c.vormen.bureau, stem: c.vormen.stem,
      /* HET GEWICHT MOET MEE, en dat is geen detail. Bleef het achter, dan werd
         een handeling die in het werkblad "zwaar" heet in het dock een gewone
         tik -- de bevestiging zou verdwijnen precies doordat je hem van een
         andere kant aanraakt. De verhindering gaat om dezelfde reden mee. */
      gewicht: c.gewicht || 'licht',
      verhinderd: c.verhinderd || null };
  }

  /* EEN FUNCTIE GAAT NIET OVER DE GRENS, EN DAT MAG NIET STIL MISLUKKEN.

     `ongedaan` is een functie: de weg terug hoort te draaien waar de handeling
     zelf draait, in het werkblad. postMessage kan hem niet klonen -- hij gooit
     dan op het HELE bericht, en dus verdween niet alleen de weg terug maar de
     complete context. Een handeling met gewicht "terug" en geen ongedaan wordt
     bovendien van rechtswege een trap hoger (gewicht.js), dus je zou stilzwijgend
     een bevestiging krijgen waar een ongedaan-knop hoorde.

     Wat er wél overgaat is de MEDEDELING dat er een weg terug is. Het
     bovendocument maakt daar een postbode van, precies zoals bij doe(). */
  function platteStaat(staat) {
    var uit = {};
    Object.keys(staat || {}).forEach(function (id) {
      var s = staat[id] || {}, kopie = {};
      Object.keys(s).forEach(function (k) {
        if (typeof s[k] === 'function') { if (k === 'ongedaan') kopie.kanOngedaan = true; return; }
        kopie[k] = s[k];
      });
      uit[id] = kopie;
    });
    return uit;
  }

  /* ======================================================= in het werkblad == */
  if (w.parent && w.parent !== w) {
    /* Declaraties en context gaan in EEN bericht omhoog. Dat is geen zuinigheid
       maar een volgorde-eis: kwam de context eerder aan dan de declaratie
       waarnaar hij verwijst, dan tekende de balk een lege rij en kwam er niets
       meer achteraan -- een fout die alleen optreedt als het frame traag laadt,
       en dus precies het soort fout dat je op je eigen machine nooit ziet. */
    A.opContext(function (ctx) {
      var caps = (ctx.acties || []).map(function (id) {
        var c = A.capability(id);
        return c ? plat(c) : null;
      }).filter(Boolean);
      try {
        w.parent.postMessage({ merk: MERK, soort: 'context', caps: caps,
          ctx: { bron: ctx.bron, titel: ctx.titel, acties: ctx.acties,
            selectie: ctx.selectie, staat: platteStaat(ctx.staat), rail: ctx.rail || [] } }, HERKOMST);
      } catch (e) {}
    });
    w.addEventListener('message', function (e) {
      if (e.origin !== HERKOMST || e.source !== w.parent) return;
      var m = e.data;
      if (!m || m.merk !== MERK) return;
      var id = String(m.id || '');
      if (m.soort === 'doe') { A.doe(id, m.extra || undefined); return; }
      /* De weg terug draait hier, want hier woont de handeling. De functie wordt
         uit de LEVENDE context gehaald en niet uit een kopie: wie hem zou
         bewaren, houdt straks een ongedaan vast van een bestand dat allang dicht
         is. */
      if (m.soort !== 'ongedaan') return;
      var st = (A.context().staat || {})[id];
      if (st && typeof st.ongedaan === 'function') { try { st.ongedaan(); } catch (x) {} }
    });
    /* Weggaan hoort ook een bericht te zijn. Zonder dit bleef de balk de
       handelingen van een document tonen dat al gesloten was -- knoppen die naar
       niets wijzen zijn erger dan geen knoppen. */
    w.addEventListener('pagehide', function () {
      try { w.parent.postMessage({ merk: MERK, soort: 'weg' }, HERKOMST); } catch (e) {}
    });
    return;
  }

  /* ==================================================== in het bovendocument == */
  var bron = null;                     // het frame dat nu de context levert

  function actiefFrame() {
    var p = d.querySelector('#rtgCommand .cmd-pane.actief iframe');
    return p || null;
  }
  function frameVan(venster) {
    var fr = d.querySelectorAll('#rtgCommand .cmd-pane iframe');
    for (var i = 0; i < fr.length; i++) if (fr[i].contentWindow === venster) return fr[i];
    return null;
  }

  w.addEventListener('message', function (e) {
    if (e.origin !== HERKOMST) return;
    var m = e.data;
    if (!m || m.merk !== MERK) return;
    var frame = frameVan(e.source);
    if (!frame) return;                                  // niet een van onze bladen
    if (m.soort === 'weg') { if (frame === bron) { bron = null; A.wisContext(); } return; }
    if (m.soort !== 'context') return;
    if (frame !== actiefFrame()) return;                 // het blad waar je niet naar kijkt zwijgt
    bron = frame;
    (m.caps || []).forEach(function (c) {
      A.declareer({ id: c.id, naam: c.naam, label: c.label, groep: c.groep, primair: c.primair,
        telefoon: c.telefoon, tablet: c.tablet, bureau: c.bureau, stem: c.stem,
        gewicht: c.gewicht, verhinderd: c.verhinderd,
        /* De handeling zelf blijft in het frame. Wat hier staat is de postbode
           en niet de uitvoering: het bovendocument weet niet wat "vet" doet en
           hoort dat ook niet te weten. */
        doe: function () {
          if (!bron || !bron.contentWindow) return;
          try { bron.contentWindow.postMessage({ merk: MERK, soort: 'doe', id: c.id }, HERKOMST); } catch (x) {}
        } });
    });
    /* De mededeling "hier is een weg terug" wordt hier weer een functie. Zo ziet
       gewicht.js in het bovendocument precies wat hij zou zien als de handeling
       hier woonde -- en hoeft hij van deze hele grens niets te weten. */
    var ctx = m.ctx || {};
    Object.keys(ctx.staat || {}).forEach(function (id) {
      if (!ctx.staat[id] || !ctx.staat[id].kanOngedaan) return;
      ctx.staat[id].ongedaan = function () {
        if (!bron || !bron.contentWindow) return;
        try { bron.contentWindow.postMessage({ merk: MERK, soort: 'ongedaan', id: id }, HERKOMST); } catch (x) {}
      };
    });
    A.context(ctx);
  });

  /* HET BLAD WISSELT, DE CONTEXT NIET -- en dat was stil fout.

     select() in de werktafel zet alleen een klasse; er komt geen bericht van het
     blad dat je verlaat. De balk bleef daardoor de documentacties van blad 1
     tonen terwijl blad 2 in beeld stond. Vandaar een waarnemer op de bladen zelf
     in plaats van vertrouwen op een melding die niemand stuurt. */
  function bewaakBladen() {
    var vak = d.querySelector('#rtgCommand .cmd-panes');
    if (!vak || !w.MutationObserver) return;
    new w.MutationObserver(function () {
      if (!bron) return;
      if (bron !== actiefFrame() || !bron.isConnected) { bron = null; A.wisContext(); }
    }).observe(vak, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] });
  }
  /* De werktafel bestaat nog niet bij het laden -- hij wordt gebouwd zodra er een
     sessie is. Daarom wachten we op #rtgCommand zelf en niet op DOMContentLoaded. */
  if (d.querySelector('#rtgCommand .cmd-panes')) bewaakBladen();
  else if (w.MutationObserver) {
    var wacht = new w.MutationObserver(function () {
      if (!d.querySelector('#rtgCommand .cmd-panes')) return;
      wacht.disconnect();
      bewaakBladen();
    });
    wacht.observe(d.body || d.documentElement, { childList: true, subtree: true });
  }
})(window, document);
