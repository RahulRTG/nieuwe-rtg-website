  /* ------------------------------------------------------------ opstarten --
     Dit deel sluit de omhulsel-functie af en hangt RTGSchil op. Het MOET het
     laatste deel van de reeks zijn: alles wat er hierna nog geschreven wordt,
     staat buiten de IIFE en doet niets. De delen worden op bestandsnaam
     aaneengeplakt (scripts/bundel.js), dus "laatste" betekent hier letterlijk
     "hoogste nummer". Toets 43 in scripts/check.js vangt het als iemand dat
     alsnog vergeet. */
  function start(opties) {
    opties = opties || {};
    schil.vak = opties.vak || d.querySelector('.rtg-werkruimte');
    schil.console = opties.console || schil.vak.querySelector('.rtg-console');
    schil.dok = el('div', 'rtg-dok', schil.vak);
    /* De apps die dit scherm kan openen. De shell KENT ze niet uit zichzelf --
       hij weet niets van domeinen -- maar het palet moet ergens uit kunnen
       putten, dus geeft de pagina zijn lijst mee. */
    schil.apps = (opties.apps || []).slice();
    w.addEventListener('resize', schik);
    // een surface die zelf om context roept (uit een frame, zelfde herkomst)
    w.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.rtg !== 'context') return;
      context(e.data.ref);
    });
    schik(); tekenConsole();
    return w.RTGSchil;
  }

  w.RTGSchil = {
    start: start, open: open, sluit: sluit, zoom: zoom,
    context: context, opContext: opContext,
    // stap 5: werkruimtes
    bewaarRuimte: bewaarRuimte, haalRuimte: haalRuimte, wisRuimte: wisRuimte,
    get ruimtes() { return Object.keys(alleRuimtes()); },
    // stap 6: het palet
    palet: paletTreffers,
    get surfaces() { return schil.surfaces.slice(); },
    get actief() { return schil.actief; }
  };
})(window, document);
