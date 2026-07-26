/* RTG Office, de presentatie: het presenteren zelf.

   Staat los van apps/office/pres.js omdat het ander werk is: daar wordt een
   deck gebouwd, hier wordt het gehouden. Het scherm is schermvullend, de
   toetsen lopen door het deck, en de notitie is er alleen voor wie hem
   aanzet.

   Vult window.RTGOfficePres aan met presenteer(). */
(function () {
  'use strict';

  /* De presenteermodus: dezelfde dia's, schermvullend, in het thema van het
     deck, met de notitie die alleen de spreker aanzet. Naast de teller loopt
     een SPREEKTIMER mee: wie tien minuten heeft, wil niet achteraf horen dat
     het er achttien waren. De timer start bij het openen en telt gewoon op --
     geen aftellen en geen rood knipperen; u bent aan het woord, geen examen
     aan het doen. */
  function presenteer(opties) {
    var doos = opties.doos, titelEl = opties.titel, tekstEl = opties.tekst, notitieEl = opties.notitie,
        tellerEl = opties.teller, dias = opties.dias;
    var nr = 0, notitieAan = false, start = Date.now();
    var thema = (window.RTGOfficePres.huidige && window.RTGOfficePres.huidige.thema()) || 'nacht';
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    function tijd() {
      var s = Math.floor((Date.now() - start) / 1000);
      return p2(Math.floor(s / 60)) + ':' + p2(s % 60);
    }
    function teller() { tellerEl.textContent = (nr + 1) + ' van ' + dias.length + ' · ' + tijd(); }
    function toon() {
      var d = dias[nr] || { titel: '', tekst: '', indeling: 'punten', notitie: '' };
      doos.className = 'aan i-' + (d.indeling || 'punten') + ' t-' + thema;
      titelEl.textContent = d.titel || '(zonder titel)';
      tekstEl.textContent = d.tekst || '';
      notitieEl.textContent = notitieAan ? (d.notitie || 'Geen notitie bij deze dia.') : '';
      teller();
    }
    // De klok stopt zichzelf zodra het scherm dicht is; zo kan hij nooit
    // blijven tikken in een gesloten presentatie.
    var klok = setInterval(function () {
      if (!doos.classList.contains('aan')) return clearInterval(klok);
      teller();
    }, 1000);
    toon();
    return {
      stap: function (n) { nr = Math.min(dias.length - 1, Math.max(0, nr + n)); toon(); },
      notitie: function () { notitieAan = !notitieAan; toon(); }
    };
  }

  window.RTGOfficePres.presenteer = presenteer;
})();
