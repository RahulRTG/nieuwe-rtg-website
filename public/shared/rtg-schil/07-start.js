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
    schil.tabs = el('nav', 'rtg-tabbar', schil.vak);
    schil.tabs.setAttribute('aria-label', 'Open software');
    schil.dok = el('div', 'rtg-dok', schil.vak);
    /* De apps die dit scherm kan openen. De shell KENT ze niet uit zichzelf --
       hij weet niets van domeinen -- maar het palet moet ergens uit kunnen
       putten, dus geeft de pagina zijn lijst mee. */
    schil.apps = (opties.apps || []).slice();
    schil.actionPrefix = opties.actionPrefix || 'Open';
    w.addEventListener('resize', schik);
    w.addEventListener('rtg-edge-layout', schik);
    /* Berichten uit de surfaces. Alleen van dezelfde herkomst -- een surface
       is een eigen pagina, maar altijd onze eigen. */
    w.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data) return;
      if (e.data.rtg === 'context') { context(e.data.ref); return; }
      var s = surfaceVanVenster(e.source);
      if (!s) return;                       // een venster dat geen surface is, telt niet mee
      if (e.data.rtg === 'sleep-start') {
        var v = schoneVerwijzing(e.data.object);
        if (v) sleepStart(s, v);
      } else if (e.data.rtg === 'sleep-kan-ja') {
        sleepKanJa(s, e.data.wat);
      }
    });
    schik(); tekenConsole(); tekenTabs();
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
    /* stap 7: objecten tussen apps. Een app in een surface roept dit NIET aan --
       die praat via postMessage, want hij draait in een eigen venster. Dit staat
       er voor de werkruimte-pagina zelf en voor de toetsen. */
    sleepStart: sleepStart, schoneVerwijzing: schoneVerwijzing,
    get surfaces() { return schil.surfaces.slice(); },
    get actief() { return schil.actief; }
  };
})(window, document);
