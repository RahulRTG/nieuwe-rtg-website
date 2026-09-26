(function (w, d) {
  'use strict';
  if (w.RTGAdaptiveEdgeLoader) return;
  function add(kind, path, global, done) {
    if (global && w[global]) { done(true); return; }
    var node = d.createElement(kind);
    if (kind === 'link') { node.rel = 'stylesheet'; node.href = path; }
    else { node.src = path; node.async = true; }
    node.addEventListener('load', function () { done(!global || !!w[global]); }, { once: true });
    node.addEventListener('error', function () { done(false); }, { once: true });
    (d.head || d.documentElement).appendChild(node);
  }
  /* DE GEWICHTLAAG REIST MEE MET DE BALK (EDGE.md par. 11). Deze lader bracht
     de knoppen van het register mee maar niet wat ze weegt: op een los scherm
     met een register (Office) deed een `bewust`-handeling in het Edge-blad
     niets, en een verhinderde knop zei alleen zijn naam. Pas na
     DOMContentLoaded, want dan hebben de defer-scripts van het scherm gedraaid
     en is bekend of er een register is; en zacht, want zonder deze laag gaat
     een zware handeling dicht en niet open. */
  function stijl(pad) {
    if (!d.querySelector('link[href^="' + pad + '"]')) add('link', pad, '', function () {});
  }
  function gewichtlaag(verder) {
    function ga() {
      if (!w.RTGAdaptief || !w.RTGGrammatica) { verder(); return; }
      stijl('/shared/adaptief.css'); stijl('/shared/grammatica.css');
      add('script', '/shared/adaptief/lagen.js', 'RTGLagen', function () {
        add('script', '/shared/adaptief/vasthoud.js', 'RTGVasthoud', function () {
          add('script', '/shared/adaptief/waarom.js', 'RTGWaarom', function () {
            add('script', '/shared/adaptief/gewicht.js', 'RTGGewicht', function () { verder(); });
          });
        });
      });
    }
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', ga, { once: true }); else ga();
  }
  function start(doc, win) {
    if (doc !== d || win !== w) return false;
    add('link', '/shared/rtg-adaptive-edge.css', '', function (vorm) {
      if (!vorm) return;
      add('script', '/shared/rtg-adaptive-edge-core.js', 'RTGAdaptiveEdgeCore', function (kern) {
        if (!kern) return;
        /* Het blikveld (EDGE.md) is ZACHT: laadt het niet, dan leest de balk
           zoals hij deed, en de rest van de keten gaat door. */
        add('script', '/shared/edge/actiestaat.js', 'RTGEdgeActiestaat', function () {
        add('script', '/shared/edge/blikveld-hoofdactie.js', 'RTGEdgeBlikveldHoofdactie', function () {
        add('script', '/shared/edge/blikveld.js', 'RTGEdgeBlikveld', function () {
        gewichtlaag(function () {
        /* De gebaardrempels wonen in de grammatica; ZACHT, want zonder tabel zijn
           alleen de gebaren uit en werkt de rest van de balk gewoon. */
        add('script', '/shared/adaptief/grammatica.js', 'RTGGrammatica', function () {
        add('script', '/shared/rtg-adaptive-edge-input.js', 'RTGAdaptiveEdgeInput', function (invoer) {
          if (!invoer) return;
          add('script', '/shared/adaptief/balkknop.js', 'RTGAdaptiefBalkKnoppen', function (knoppen) {
          if (!knoppen) return;
          add('script', '/shared/rtg-adaptive-edge-claim.js', 'RTGAdaptiveEdgeClaim', function (claim) {
          if (!claim) return;
          add('script', '/shared/rtg-adaptive-edge-controls.js', 'RTGAdaptiveEdgeControls', function (bediening) {
          if (!bediening) return;
          add('script', '/shared/rtg-adaptive-edge.js', 'RTGAdaptiveEdge', function (klaar) {
            if (!klaar) return;
            w.RTGAdaptiveEdge.start(d, w);
            add('script', '/shared/rtg-adaptive-edge-signals.js', 'RTGAdaptiveEdgeSignals', function (brug) {
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
    return true;
  }
  w.RTGAdaptiveEdgeLoader = Object.freeze({ start: start });
}(window, document));
