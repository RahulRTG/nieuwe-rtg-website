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
    /* VERHINDERD IS NIET WEG EN NIET DOOD -- EN OOK NIET `disabled`.

       Hier stond eerst aria-disabled. Dat leest als "deze knop doet niets", en
       dat is precies wat hij niet is: hij doet iets ANDERS, namelijk zichzelf
       uitleggen. Een schermlezer die "uitgeschakeld" hoort, slaat hem over -- en
       dan is de uitleg onbereikbaar voor precies degene die hem het hardst
       nodig heeft.

       Wat er nu staat: een gewone, bedienbare knop met de stand in zijn NAAM.
       Wie hem hoort, hoort meteen wat er aan de hand is en dat er meer te weten
       valt. */
    if (it.verhinderd) {
      b.classList.add('verhinderd');
      b.dataset.verhinderd = '1';
      b.setAttribute('aria-label', it.naam + ', niet beschikbaar. Tik voor de reden.');
      b.title = it.naam + ' · waarom kan dit niet?';
    }
    zetTeken(b, it);
    b.onclick = function () { voer(it); };
    /* LANG DRUKKEN LEGT UIT. Dat is de betekenis die dit gebaar in het hele huis
       heeft (grammatica.js: tik doet, lang legt uit), en hier stond iets anders:
       lang drukken opende de uitgebreide lade. Dat was een tweede betekenis voor
       hetzelfde gebaar, en precies zo verliest een taal zijn woorden. Meer
       gereedschap zit nu waar het hoort: omhoog trekken, of de ⋯ ernaast. */
    var klok = null;
    b.addEventListener('pointerdown', function () {
      klok = w.setTimeout(function () { klok = null; uitleg(it); }, 480);
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

  /* ELKE TIK LOOPT LANGS HET GEWICHT. Dat is de reden dat een zware handeling
     niet per ongeluk licht kan worden: er is één ingang, en die kent de trap.
     Ontbreekt de gewichtlaag, dan draait alleen wat licht is -- stil zwaar
     uitvoeren is de enige uitkomst die hier niet mag. */
  function voer(it) {
    if (it.verhinderd) { uitleg(it); return; }
    if (w.RTGGewicht) { w.RTGGewicht.voer(it); return; }
    if ((it.gewicht || 'licht') !== 'licht') {
      if (w.console && w.console.warn) w.console.warn('[balk] ' + it.id + ': gewicht zonder gewichtlaag');
      return;
    }
    if (it.doe) { try { it.doe(); } catch (e) {} return; }
    if (A) A.doe(it.id);
  }
  /* Uitleg is er ook zonder de waarom-laag: dan blijft er tenminste de naam. Een
     lang ingedrukte knop die niets doet, leest als kapot. */
  function uitleg(it) {
    if (w.RTGWaarom) { w.RTGWaarom.leguit(it); return; }
    if (w.RTGLagen) w.RTGLagen.lade({ titel: it.naam });
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
          r.type = 'button'; r.className = 'lg-rij' + (it.verhinderd ? ' verhinderd' : '');
          if (it.aan !== undefined) r.setAttribute('aria-pressed', it.aan ? 'true' : 'false');
          if (it.verhinderd) r.setAttribute('aria-label', it.naam + ', niet beschikbaar. Tik voor de reden.');
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

  /* EEN STANDSWISSEL MAG DE TOETSENBORDCURSOR NIET WEGGOOIEN. De balk tekent
     na een gewijzigde aan/uit-stand zijn knoppen opnieuw; draag focus dan over
     naar dezelfde capability, of naar Meer als juist die knop overliep. Focus
     buiten de actierij blijft ongemoeid. */
  function focusVan(rij) {
    return rij.contains(d.activeElement) && d.activeElement.dataset ? d.activeElement.dataset.cap : '';
  }
  function herstelFocus(rij, meer, id) {
    if (!id) return;
    for (var i = 0; i < rij.children.length; i++) {
      if (rij.children[i].dataset.cap === id) { rij.children[i].focus(); return; }
    }
    if (!meer.hidden) meer.focus();
  }

    return { knop: knop, zetTeken: zetTeken, voer: voer, openLade: openLade,
      focusVan: focusVan, herstelFocus: herstelFocus };
  };
})(window, document);
