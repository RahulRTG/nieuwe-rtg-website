/* RTG Horeca (scherm): ONTVANGEN EN DE OPEN TAFELS op de PDA.

   WAAROM DIT EEN EIGEN BESTAND IS. ./pda.js liep over de 10 kB-grens van
   keuringsregel 13 toen de host-modus erbij kwam. De snede ligt op een naad:
   pda.js gaat over de WERKLIJST (wat moet ik nu doen), dit over de twee
   ingangen die daar NAAST staan -- een tafel openen, en bij een tafel komen die
   geen taak is.

   Dat onderscheid is niet cosmetisch. Niet alles wat openstaat is een taak: een
   tafel die net eten kreeg wacht nergens op en hoort dus niet op de werklijst.
   Maar je moet er wel bij kunnen, en dat is precies wat deze twee knoppen
   doen. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  var esc = K.esc, api = K.api, meld = K.meld;

  function $(id) { return document.getElementById(id); }

  /* De aanroeper geeft mee hoe een tafel geopend wordt: dat is het gedrag van
     het scherm en woont in pda.js. */
  var OPEN = function () {};

  /* ONTVANGEN. Een tafel openen is de eerste handeling van de avond en stond
     alleen op het zaalscherm -- dus liep de bediening met een telefoon in de
     hand naar binnen om een tafel te openen. */
  $('pNieuw').addEventListener('click', function () {
    var tafel = $('pNieuwTafel').value.trim();
    if (!tafel) return meld('Welke tafel of plek?');
    var gasten = parseInt($('pNieuwGasten').value, 10);
    api('/rekening/open', { kanaal: 'tafel', tafel: tafel, gasten: gasten > 0 ? gasten : 1 })
      .then(function (r) {
        if (r.body.error) return meld(r.body.error);
        $('pNieuwTafel').value = '';
        OPEN(r.body.rekening.id);
      });
  });

  /* De open tafels: niet alles wat open staat is een TAAK (een tafel die net
     eten kreeg wacht nergens op), maar je moet er wel bij kunnen. */
  $('pTafels').addEventListener('click', function () {
    api('/rekeningen', { status: 'open' }).then(function (r) {
      var lijst = r.body.rekeningen || [];
      if (!lijst.length) return meld('Er staat geen enkele rekening open.');
      $('pNu').innerHTML = '<p class="pda-som">Open tafels</p>' + lijst.map(function (x) {
        return '<article class="pda-taak"><div class="pda-kop">' +
          '<span class="pda-tafel">' + esc(x.tafel || x.kanaal) + '</span>' +
          '<span class="pda-min">' + K.euro(x.totalen.netto) + '</span></div>' +
          '<div class="pda-acties">' + K.knop('Open', { tafel: x.id }, true) + '</div></article>';
      }).join('');
      $('pOpen').innerHTML = '';
      K.bind($('pNu'), 'tafel', function (b) { OPEN(b.dataset.tafel); });
    });
  });

  window.RTGPdaOntvangst = { bind: function (open) { OPEN = open; } };
})();
