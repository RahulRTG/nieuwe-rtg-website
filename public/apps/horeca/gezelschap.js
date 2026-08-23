/* RTG Horeca (scherm): het GEZELSCHAP aan een rekening -- wie zit er, en wat
   staat op wiens naam.

   Waarom dit los van zaal.js staat: dat zijn twee onderwerpen. De rekening gaat
   over regels, gangen en geld; dit gaat over mensen. Ze delen één ding -- de
   keuzelijst "voor wie" -- en die woont hier, want hier staat wie er zit.

   DE STOEL IS NIET NIEUW, DE DEUR WEL. Een rekening kende `deelnemers` en een
   regel kende `gastNr` allang, maar alleen wie de QR scande kon er iets mee.
   Dit scherm praat met kern/horeca/gezelschap.js, dus het is dezelfde stoel die
   de gast op zijn telefoon ziet: schuift er iemand aan met de QR, dan staat hij
   hier -- en wat de bediening op zijn naam zet, ziet hij. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  var stoelen = [];     // het laatst geladen gezelschap, voor de keuzelijsten
  var rekening = null;  // waar dat gezelschap bij hoort

  function $(id) { return document.getElementById(id); }
  var esc = function (t) { return K.esc(t); };
  var euro = function (c) { return K.euro(c); };

  /* De keuzelijst "voor wie". Hij staat op twee plekken (bij het bestellen en
     naast elke regel) en wordt daarom hier één keer gemaakt. */
  function opties(gekozen) {
    return '<option value="">Voor de tafel</option>' + stoelen.map(function (s) {
      return '<option value="' + s.nr + '"' + (String(gekozen) === String(s.nr) ? ' selected' : '') + '>' +
        esc(s.handle) + '</option>';
    }).join('');
  }

  function teken(rekId, g) {
    rekening = rekId;
    stoelen = g.stoelen || [];
    var rijen = stoelen.map(function (s) {
      return '<div class="item"><span><b>' + esc(s.handle) + '</b>' +
        /* Wie van zijn eigen telefoon bestelt, staat er anders bij -- niet als
           versiering maar omdat de bediening hem niet kan wegklikken. */
        (s.eigenSessie ? ' <span class="tag">eigen telefoon</span>' : '') +
        ' <span class="stil">· ' + s.regels + ' regel(s)</span>' +
        (s.allergieen.length ? ' <span class="allergie">' + s.allergieen.map(esc).join(', ') + '</span>' : '') +
        '</span><span class="rij"><span class="stil">' + euro(s.centen) + '</span>' +
        '<button class="knop" data-hernoem="' + s.nr + '">Naam</button>' +
        (s.eigenSessie ? '' : '<button class="knop" data-stoelweg="' + s.nr + '">Weg</button>') +
        '</span></div>';
    }).join('');
    /* De tafel staat er ALTIJD bij, ook als hij leeg is. Wat op niemands naam
       staat is geen restpost maar een echt ding -- de fles wijn hoort van
       iedereen te zijn, en de splitlaag rekent hem ook zo. */
    var tafel = '<div class="item"><span><b>Op de tafel</b>' +
      ' <span class="stil">· ' + g.gedeeld.regels + ' regel(s), van iedereen samen</span>' +
      (g.gedeeld.allergieen.length ? ' <span class="allergie">' + g.gedeeld.allergieen.map(esc).join(', ') + '</span>' : '') +
      '</span><span class="stil">' + euro(g.gedeeld.centen) + '</span></div>';
    $('zGezelschap').innerHTML = (rijen || '') + tafel;

    K.bind($('zGezelschap'), 'hernoem', function (b) {
      var nr = b.getAttribute('data-hernoem');
      var s = stoelen.filter(function (x) { return String(x.nr) === String(nr); })[0];
      var naam = prompt('Hoe heet deze stoel?', s ? s.handle : '');
      if (naam == null) return;
      K.api('/gezelschap/stoel', { rekeningId: rekening, nr: nr, handle: naam.trim() }).then(function (r) {
        if (r.body.error) return K.meld(r.body.error);
        window.RTGHorecaGezelschap.bijWijziging();
      });
    });
    K.bind($('zGezelschap'), 'stoelweg', function (b) {
      K.api('/gezelschap/stoel/weg', { rekeningId: rekening, nr: b.getAttribute('data-stoelweg') }).then(function (r) {
        if (r.body.error) return K.meld(r.body.error);
        // wat er met de regels van die stoel gebeurde, is geen detail
        K.meld(r.body.let || 'Stoel weg.');
        window.RTGHorecaGezelschap.bijWijziging();
      });
    });
    $('zVoor').innerHTML = opties($('zVoor').value);
  }

  function bind() {
    $('zStoelBij').addEventListener('click', function () {
      if (!rekening) return K.meld('Open eerst een rekening.');
      K.api('/gezelschap/stoel', { rekeningId: rekening, handle: $('zStoelNaam').value.trim() }).then(function (r) {
        if (r.body.error) return K.meld(r.body.error);
        $('zStoelNaam').value = '';
        K.meld(r.body.stoel.handle + ' zit aan tafel.');
        window.RTGHorecaGezelschap.bijWijziging();
      });
    });
  }

  window.RTGHorecaGezelschap = {
    teken: teken, opties: opties, bind: bind,
    // zaal.js zet hier zijn eigen hertekening in; standaard doet het niets
    bijWijziging: function () {}
  };
})();
