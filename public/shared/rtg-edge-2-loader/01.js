    for (var i = 0; i < lijst.length; i++) if (zichtbaarVenster(lijst[i])) { open = true; break; }
    if (b.hasAttribute(VENSTER_ATTR) === open) return;
    if (open) b.setAttribute(VENSTER_ATTR, 'true'); else b.removeAttribute(VENSTER_ATTR);
  }
  function bewaakVensters() {
    stemVensterAf();
    if (!w.MutationObserver) return;
    new w.MutationObserver(stemVensterAf).observe(b, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ['class', 'hidden', 'style', 'open', 'role', 'aria-modal']
    });
  }
  var pad = w.location.pathname;
  if (pad === '/apps/rtg.html') {
    hoofdactie('Bekijk uw dag', function () { klik('.rtg-dashboard-hero-cta'); });
    neemRandknop('.xp-trigger');
  }
  else if (pad === '/apps/kantoor.html') hoofdactie('Open werkbank', function () { klik('.wereldtab-plus'); });
  else if (pad === '/apps/reizen.html') hoofdactie('Open reizen', function () { klik('[data-tab="reizen"]'); });
  else if (pad === '/apps/foundation/os-publiek.html') hoofdactie('Bekijk uw stad', function () {
    var a = vind('[data-heen="activiteiten"]'); if (b.getAttribute('data-rtg-foundation-city') === 'true' && a) a.click(); else focus('#steden');
  });
  else if (pad === '/apps/agenda.html') hoofdactie('Nieuwe afspraak', function () { klik('#nieuwBtn'); });
  else if (pad === '/apps/reisboek.html') hoofdactie('Naar reisinhoud', function () { focus('#main'); });
  else if (pad === '/apps/living-world.html') {
    function livingWorldAction() {
      var source = vind('[data-lw-primary]') || vind('[data-hoofdactie]');
      hoofdactie(source ? source.textContent : 'Ontdek uw wereld', function () {
        var current = vind('[data-lw-primary]') || vind('[data-hoofdactie]');
        if (current) current.click(); else klik('[data-lw-tab="world"]');
      });
    }
    livingWorldAction();
    d.addEventListener('rtg:living-world-render', livingWorldAction);
  }
  else if (pad === '/apps/werk.html') {
    hoofdactie('Nieuw project', function () {
      var inlog = vind('#inlogGa');
      if (inlog && inlog.offsetParent !== null) inlog.click(); else focus('#a_h0_naam, #mKeuze, #main');
    });
    koppelWerkRahul();
    koppelWerkScroll();
  }
  else if (pad === '/apps/move.html') neemRandknop('#verder');
  else if (pad === '/apps/clips.html') neemHoofdactie('Maak een clip', '#studioOpen');

  function bron(tag, attribuut, pad) {
    var lijst = d.querySelectorAll(tag + '[' + attribuut + ']');
    for (var i = 0; i < lijst.length; i++) {
      try { if (new URL(lijst[i].getAttribute(attribuut), w.location.href).pathname === pad) return lijst[i]; }
      catch (fout) {}
    }
    return null;
  }
  function wacht(el, naam, klaar) {
    if (naam && w[naam]) { klaar(true); return; }
    var gedaan = false;
    function af(ok) {
      if (gedaan) return; gedaan = true;
      if (ok) el.setAttribute('data-rtg-geladen', 'true');
      klaar(ok && (!naam || !!w[naam]));
    }
    el.addEventListener('load', function () { af(true); }, { once: true });
    el.addEventListener('error', function () { af(false); }, { once: true });
    if (el.getAttribute('data-rtg-geladen') === 'true' || (!naam && el.sheet)) af(true);
  }
  function script(pad, naam, klaar) {
    if (w[naam]) { klaar(true); return; }
    var bestaandScript = bron('script', 'src', pad);
    if (bestaandScript) { wacht(bestaandScript, naam, klaar); return; }
    var edgeScriptNode = document.createElement('script');
    edgeScriptNode.src = pad; edgeScriptNode.async = true;
    wacht(edgeScriptNode, naam, klaar);
    document.head.appendChild(edgeScriptNode);
  }
  function blad(pad, klaar) {
    var bestaandBlad = bron('link[rel~="stylesheet"]', 'href', pad);
    if (bestaandBlad) { wacht(bestaandBlad, '', klaar); return; }
    var edgeStyleNode = document.createElement('link');
    edgeStyleNode.id = 'rtg-edge-2-css'; edgeStyleNode.rel = 'stylesheet'; edgeStyleNode.href = pad;
    wacht(edgeStyleNode, '', klaar);
    document.head.appendChild(edgeStyleNode);
  }
  var over = 4, mislukt = false;
  function afhankelijk(ok) {
    if (!ok) mislukt = true;
    if (--over || mislukt) return;
    script('/shared/rtg-edge-2.js', 'RTGEdge2', function (klaar) {
      if (!klaar || !w.RTGEdge2) return;
      try {
        w.RTGEdge2.start(d, w); w.RTGEdge2Reveal.start(d, w); bewaakVensters(); w.RTGEdgeCommand.koppel(d, w);
        script('/shared/rtg-adaptive-edge-loader.js', 'RTGAdaptiveEdgeLoader', function (adaptief) {
          if (adaptief) w.RTGAdaptiveEdgeLoader.start(d, w);
        });
        script('/shared/rtg-edge-appbar.js', 'RTGEdgeAppBar', function (appbar) {
          if (appbar) w.RTGEdgeAppBar.start(d);
          script('/shared/rtg-edge-smart-menu.js', 'RTGEdgeSmartMenu', function (slim) {
            if (slim) w.RTGEdgeSmartMenu.start(d);
          });
        });
      } catch (fout) {}
    });
  }
  /* Vorm en contextkern downloaden samen; de uitvoerder volgt pas na beide. */
  blad('/shared/rtg-edge-2.css', afhankelijk);
  script('/shared/rtg-edge-2-context.js', 'RTGEdge2Context', afhankelijk);
  script('/shared/rtg-edge-command.js', 'RTGEdgeCommand', afhankelijk);
  script('/shared/rtg-edge-2-reveal.js', 'RTGEdge2Reveal', afhankelijk);
})(window, document);
