/* RTG Horeca (scherm): INDELEN -- welke tafels horen bij welke wijk.

   WAAROM DIT EEN EIGEN BESTAND IS. Het is een andere handeling van een ander
   mens op een ander moment: verdelen doet de leiding VOOR de dienst, herverdelen
   doet iedereen TIJDENS de dienst. ./vloer.js gaat over het tweede. Ze staan op
   hetzelfde scherm omdat je ze naast elkaar wilt zien, niet omdat het hetzelfde
   is.

   INDELEN IS MANAGER-WERK, EN DAT ZIT OP DE SERVER. /wijk/zet en /wijk/weg staan
   achter managerOnly; het vlaggetje `magIndelen` bepaalt alleen of dit blok
   verschijnt. Een client die dat vlaggetje omzet, krijgt een 403 terug -- de
   knop verschijnt dan wel, maar de wijk verandert niet.

   EEN TAFEL HOORT BIJ HOOGSTENS EEN WIJK. Wie hem hier aanvinkt, haalt hem weg
   bij een andere -- en dat zegt de server terug (`verhuisd`), zodat het niet
   stil gebeurt. Een tafel die stil van wijk wisselt, is een tafel waar twee
   mensen naartoe lopen of geen. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  /* EERST DE POORT, DAN PAS BINDEN -- ook al doet ./vloer.js dat al. Achter een
     deur valt er niets te bedienen: die vervangt #main, dus #vNieuw bestaat dan
     niet meer en de binding onderaan dit bestand valt over null. Dat is geen
     theorie: het gebeurde hier, omdat de deur in een setTimeout(0) staat en de
     browser die taak kan afwerken TUSSEN het laden van twee scripts door.
     Precies dezelfde volgorde-afhankelijkheid die in ./app.js al een keer is
     uitgezocht. poort() zelf opent er geen tweede (hij houdt dat bij). */
  if (!K.poort()) return;
  var esc = K.esc, api = K.api, meld = K.meld;

  function $(id) { return document.getElementById(id); }

  var D = null, na = null;
  var bezig = null;      // { id, naam, tafels } of null als de vorm dicht is
  var getekend = null;   // voor welke bezig de vorm nu op het scherm staat

  /* DE VORM WORDT NIET OPNIEUW GETEKEND ZOLANG HIJ OPEN STAAT VOOR HETZELFDE.
     Dit scherm ververst op elke duw van een collega, en een vorm die daarbij
     opnieuw wordt opgebouwd, gooit een half ingetypte naam en een half gezette
     indeling weg. Dat gebeurt precies op een drukke avond, want dan zijn er
     duwberichten. De prijs is dat de tafelvinkjes even oud kunnen zijn als het
     moment waarop u begon -- en dat is de goedkoopste van de twee. */
  function vorm() {
    var v = $('vVorm');
    if (!bezig) { v.hidden = true; v.innerHTML = ''; getekend = null; return; }
    var sleutel = String(bezig.id || 'nieuw');
    if (getekend === sleutel) return;
    getekend = sleutel;
    v.hidden = false;
    v.innerHTML = '<input type="text" id="vNaam" maxlength="40" value="' + esc(bezig.naam) + '" ' +
      'placeholder="Naam van de wijk" aria-label="Naam van de wijk">' +
      '<div class="v-vakjes">' + ((D.tafels || []).length
        ? (D.tafels || []).map(function (t) {
            return '<label><input type="checkbox" value="' + esc(t) + '"' +
              (bezig.tafels.indexOf(t) >= 0 ? ' checked' : '') + '>' + esc(t) + '</label>';
          }).join('')
        : '<p class="v-voet">Deze zaak heeft nog geen tafels; die staan in de zaakinstellingen.</p>') +
      '</div><div class="v-acties">' +
      K.knop('Bewaren', { bewaar: '1' }, true) + K.knop('Annuleren', { af: '1' }) +
      (bezig.id ? K.knop('Wijk weghalen (tafels blijven)', { weg: bezig.id }) : '') +
      '</div>';

    K.bind(v, 'af', function () { bezig = null; vorm(); });
    K.bind(v, 'bewaar', function () {
      var tafels = Array.prototype.filter.call(v.querySelectorAll('input[type=checkbox]'),
        function (c) { return c.checked; }).map(function (c) { return c.value; });
      api('/wijk/zet', { wijkId: bezig.id || null, naam: $('vNaam').value, tafels: tafels })
        .then(function (r) {
          if (r.body.error) return meld(r.body.error);
          /* Een tafel die van wijk verhuist, gebeurt hier NIET stil. */
          var vh = r.body.verhuisd || [];
          meld(vh.length
            ? vh.length + ' tafel(s) verhuisden mee: ' + vh.map(function (x) { return x.tafel + ' (was ' + x.van + ')'; }).join(', ')
            : 'Wijk bewaard.');
          bezig = null; vorm(); if (na) na();
        }, function (e) { meld(e.message || 'Er ging iets mis.'); });
    });
    K.bind(v, 'weg', function (b) {
      api('/wijk/weg', { wijkId: b.dataset.weg }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        meld(r.body.let || 'Wijk weggehaald; de tafels zijn nu van iedereen.');
        bezig = null; vorm(); if (na) na();
      }, function (e) { meld(e.message || 'Er ging iets mis.'); });
    });
  }

  function teken(d, opnieuw) {
    D = d; na = opnieuw;
    var blok = $('vIndeel');
    if (!blok) return;
    if (!d.magIndelen) { blok.hidden = true; return; }
    blok.hidden = false;

    var lijst = $('vIndeelLijst');
    lijst.innerHTML = (d.wijken || []).map(function (w) {
      return '<div class="item"><span>' + esc(w.naam) + '<span class="stil"> · ' +
        w.tafels.length + ' tafel(s)</span></span><span>' +
        K.knop('Wijzigen', { wijzig: w.id }) + '</span></div>';
    }).join('') || '<p class="v-leeg">Nog geen wijken ingedeeld.</p>';
    K.bind(lijst, 'wijzig', function (b) {
      var w = (D.wijken || []).filter(function (x) { return x.id === b.dataset.wijzig; })[0];
      if (!w) return;
      bezig = { id: w.id, naam: w.naam, tafels: w.tafels.slice() };
      vorm();
    });
    vorm();
  }

  $('vNieuw').addEventListener('click', function () {
    bezig = { id: null, naam: '', tafels: [] };
    vorm();
  });

  window.RTGVloerIndeel = { teken: teken };
})();
