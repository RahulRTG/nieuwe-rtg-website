(function (w, d) {
  'use strict';
  if (w.RTGAdaptiveEdgeLoader) return;
  function addScript(path, global, done) {
    if (global && w[global]) { done(true); return; }
    var scriptNode = document.createElement('script');
    scriptNode.src = path; scriptNode.async = true;
    scriptNode.addEventListener('load', function () { done(!global || !!w[global]); }, { once: true });
    scriptNode.addEventListener('error', function () { done(false); }, { once: true });
    document.head.appendChild(scriptNode);
  }
  function addStyle(path, done, id) {
    var styleNode = document.createElement('link');
    styleNode.rel = 'stylesheet'; styleNode.href = path;
    if (id) styleNode.id = id;
    styleNode.addEventListener('load', function () { done(true); }, { once: true });
    styleNode.addEventListener('error', function () { done(false); }, { once: true });
    document.head.appendChild(styleNode);
  }
  /* DE GEWICHTLAAG REIST MEE MET DE BALK (EDGE.md par. 11). Deze lader bracht
     de knoppen van het register mee maar niet wat ze weegt: op een los scherm
     met een register (Office) deed een `bewust`-handeling in het Edge-blad
     niets, en een verhinderde knop zei alleen zijn naam. Pas na
     DOMContentLoaded, want dan hebben de defer-scripts van het scherm gedraaid
     en is bekend of er een register is; en zacht, want zonder deze laag gaat
     een zware handeling dicht en niet open. */
  function gewichtlaag(verder) {
    function ga() {
      if (!w.RTGAdaptief || !w.RTGGrammatica) { verder(); return; }
      if (!d.getElementById('rtgAdaptiefCss')) addStyle('/shared/adaptief.css', function () {}, 'rtgAdaptiefCss');
      if (!d.getElementById('rtgGrammaticaCss')) addStyle('/shared/grammatica.css', function () {}, 'rtgGrammaticaCss');
      addScript('/shared/adaptief/lagen.js', 'RTGLagen', function () {
        addScript('/shared/adaptief/vasthoud.js', 'RTGVasthoud', function () {
          addScript('/shared/adaptief/waarom.js', 'RTGWaarom', function () {
            addScript('/shared/adaptief/gewicht.js', 'RTGGewicht', function () { verder(); });
          });
        });
      });
    }
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', ga, { once: true }); else ga();
  }
  function start(doc, win) {
    if (doc !== d || win !== w) return false;
    addStyle('/shared/rtg-adaptive-edge.css', function (vorm) {
      if (!vorm) return;
      addScript('/shared/rtg-adaptive-edge-core.js', 'RTGAdaptiveEdgeCore', function (kern) {
        if (!kern) return;
        /* Het blikveld (EDGE.md) is ZACHT: laadt het niet, dan leest de balk
           zoals hij deed, en de rest van de keten gaat door. */
        addScript('/shared/edge/actiestaat.js', 'RTGEdgeActiestaat', function () {
        addScript('/shared/edge/blikveld-hoofdactie.js', 'RTGEdgeBlikveldHoofdactie', function () {
        addScript('/shared/edge/blikveld.js', 'RTGEdgeBlikveld', function () {
        gewichtlaag(function () {
        /* De gebaardrempels wonen in de grammatica; ZACHT, want zonder tabel zijn
           alleen de gebaren uit en werkt de rest van de balk gewoon. */
        addScript('/shared/adaptief/grammatica.js', 'RTGGrammatica', function () {
        addScript('/shared/rtg-adaptive-edge-input.js', 'RTGAdaptiveEdgeInput', function (invoer) {
          if (!invoer) return;
          addScript('/shared/adaptief/balkknop.js', 'RTGAdaptiefBalkKnoppen', function (knoppen) {
          if (!knoppen) return;
          addScript('/shared/rtg-adaptive-edge-claim.js', 'RTGAdaptiveEdgeClaim', function (claim) {
          if (!claim) return;
          addScript('/shared/rtg-adaptive-edge-controls.js', 'RTGAdaptiveEdgeControls', function (bediening) {
          if (!bediening) return;
          addScript('/shared/rtg-adaptive-edge-surface.js', 'RTGAdaptiveEdgeSurface', function () {
          addScript('/shared/rtg-adaptive-edge-services.js', 'RTGAdaptiveEdgeServices', function (diensten) {
          if (!diensten) return;
          addScript('/shared/rtg-adaptive-edge-visual.js', 'RTGAdaptiveEdgeVisual', function (beeld) {
          if (!beeld) return;
          addScript('/shared/rtg-adaptive-edge-cinema.js', 'RTGAdaptiveEdgeCinema', function (cinema) {
          if (!cinema) return;
          addScript('/shared/rtg-adaptive-edge.js', 'RTGAdaptiveEdge', function (klaar) {
            if (!klaar) return;
            w.RTGAdaptiveEdge.start(d, w);
            addScript('/shared/rtg-edge-pages.js', 'RTGEdgePages', function () {});
            addScript('/shared/rtg-adaptive-edge-signals.js', 'RTGAdaptiveEdgeSignals', function (brug) {
              if (brug) w.RTGAdaptiveEdgeSignals.start(d, w);
            });
          });
          });
          });
          });
          });
          });
          });
          });
        });
        });
        });
        });
        });
        });
      });
    });
    return true;
  }
  w.RTGAdaptiveEdgeLoader = Object.freeze({ start: start });
}(window, document));
