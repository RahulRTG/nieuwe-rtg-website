/* DE KNOPPEN VAN DE CONTEXTZONE, en de lade waar de rest in valt.

   Een eigen bestand omdat het een eigen onderwerp is: shared/adaptief/balk.js
   gaat over de ZONE -- waar hij staat, wanneer hij verschijnt, hoeveel er past.
   Dit gaat over wat er in die zone staat en waar het heen gaat als het er niet
   in past.

   DE OVERLOOP IS DE HELE AFSPRAAK IN EEN KNOP. Wat niet in de balk past
   verdwijnt niet, het verhuist -- naar een lade met de VOLLEDIGE lijst, niet
   alleen met de rest. Moeten onthouden of iets nou in de balk stond of erachter,
   is precies wat progressive disclosure niet mag kosten.

   LANG DRUKKEN IS EEN SNELWEG EN NOOIT DE ENIGE WEG. Elk gebaar hier heeft een
   zichtbare tweelingweg; een functie die alleen achter een gebaar zit, is een
   verstopte functie met een strik erom.

   Levert window.RTGAdaptiefBalkKnoppen(o); balk.js roept hem aan met wat hij
   nodig heeft. */
(function (w, d) {
  'use strict';
  w.RTGAdaptiefBalkKnoppen = function (o) {
    var A = w.RTGAdaptief;
    /* De rij en de titel komen van de zone en worden per aanroep OPGEHAALD en
       niet vastgehouden: de zone wordt opnieuw opgebouwd zodra de werktafel van
       stand wisselt, en een vastgehouden verwijzing wijst dan naar DOM die er
       niet meer is. Dat is dezelfde fout die de praat-laag hier ooit maakte
       (WERELD.md). */
    function items() { return o.items() || []; }
    function titel() { return o.titel() || 'Handelingen'; }

  function knop(it) {
    var b = d.createElement('button');
    b.type = 'button';
    b.className = 'cmd-actie';
    b.dataset.cap = it.id;
    b.title = it.naam;
    b.setAttribute('aria-label', it.naam);
    if (it.aan !== undefined) b.setAttribute('aria-pressed', it.aan ? 'true' : 'false');
    zetTeken(b, it);
    b.onclick = function () { voer(it); };
    /* Lang drukken opent de uitgebreide vorm van diezelfde handeling. Dat is
       een SNELWEG en nooit de enige weg: alles wat hier achter zit, staat ook
       in de lade achter ⋯. Een gebaar dat je moet kennen om ergens te komen,
       is een verstopte functie met een strik erom. */
    var klok = null;
    b.addEventListener('pointerdown', function () {
      klok = w.setTimeout(function () { klok = null; openLade(); }, 480);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) {
      b.addEventListener(n, function () { if (klok) { w.clearTimeout(klok); klok = null; } });
    });
    return b;
  }

  function zetTeken(b, it) {
    if (it.teken && it.teken.nodeType === 1) { b.appendChild(it.teken.cloneNode(true)); return; }
    if (typeof it.teken === 'function') {
      var g = null; try { g = it.teken(); } catch (e) {}
      if (g && g.nodeType === 1) { b.appendChild(g); return; }
    }
    b.textContent = it.label || it.naam;
  }

  function voer(it) {
    if (it.doe) { try { it.doe(); } catch (e) {} return; }
    if (A) A.doe(it.id);
  }

  /* De lade met alles. Rijen op haarlijnen, gegroepeerd zoals de capability
     zelf zegt dat hij gegroepeerd hoort -- niet zoals deze balk denkt. */
  function openLade() {
    var lijst = items();
    if (!w.RTGLagen || !lijst.length) return;
    w.RTGLagen.lade({
      titel: titel(),
      inhoud: function (lijf) {
        var groep = '';
        lijst.forEach(function (it) {
          if (it.groep && it.groep !== groep) {
            groep = it.groep;
            var k = d.createElement('p'); k.className = 'lg-kopje'; k.textContent = groep;
            lijf.appendChild(k);
          }
          var r = d.createElement('button');
          r.type = 'button'; r.className = 'lg-rij';
          if (it.aan !== undefined) r.setAttribute('aria-pressed', it.aan ? 'true' : 'false');
          var t = d.createElement('span'); t.className = 'lg-teken';
          zetTeken(t, it);
          r.appendChild(t);
          r.appendChild(d.createTextNode(it.naam));
          r.onclick = function () { w.RTGLagen.sluit(); voer(it); };
          lijf.appendChild(r);
        });
      }
    });
  }
    return { knop: knop, zetTeken: zetTeken, voer: voer, openLade: openLade };
  };
})(window, document);
