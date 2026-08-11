/* THE COMMAND CANVAS -- de TAAL: welke zin er bij een stand hoort.

   WAAROM DIT EEN EIGEN BESTAND IS. canvas.js liep tegen de 10 KB-regel aan
   (scripts/check.js regel 13), en die regel zegt er iets bij dat hier klopte:
   een bestand dat er net boven komt, heeft een tweede onderwerp in zich. Dat
   tweede onderwerp is dit. TEKENEN en FORMULEREN zijn niet hetzelfde werk:
   het eerste is voor alle acht werelden identiek en verandert nooit, het
   tweede is precies wat per taal en per pas verschilt (CLAUDE.md: RTG Pass
   spreekt je aan met 'je', Lifestyle en Business met 'u').

   Twee van deze zinnen staan letterlijk in CANVAS.md, en dat is geen toeval:
   dit is de toon die het document beschrijft.

   Dit blad HANGT AAN canvas.js en vervangt hem niet: het vult RTGCanvas aan.
   Ontbreekt het, dan gooit RTGCanvas.zin een TypeError -- luid, en niet een
   scherm dat stil zonder zin blijft staan (LAT.md regel 5). */
(function (w) {
  'use strict';
  if (!w.RTGCanvas || w.RTGCanvas.zin) return;

  var T = function (k, nl) { return (w.RTGi18n && w.RTGi18n.t) ? w.RTGi18n.t(k, nl) : nl; };
  var NIVEAUS = { verstoord: 1, aandacht: 1, gezond: 1, onbekend: 1 };

  /* Bij 'onbekend' noemt de zin de bron BIJ NAAM als het scherm hem meegaf.
     "Er ging iets mis" laat iemand zoeken; "de agenda is niet opgehaald" laat
     iemand kijken. */
  function zin(s, o) {
    o = o || {};
    if (!s || !NIVEAUS[s.niveau] || s.niveau === 'onbekend') {
      var stil = (o.stil || []).filter(Boolean);
      // 'een bron' als de namen niet zijn meegegeven: nog steeds onvolledig, en
      // dat is belangrijker om te zeggen dan welke bron het precies was
      if (stil.length || (s && s.reden === 'bron')) {
        return T('canvas.zin.bron', 'Dit beeld is niet compleet: ') +
          (stil.length ? stil.join(', ') : T('canvas.zin.eenbron', 'een bron')) +
          T('canvas.zin.bron2', ' is niet opgehaald.');
      }
      if (s && s.ongemeten) {
        return s.ongemeten + T('canvas.zin.status', ' regels hebben een toestand die hier niet bekend is.');
      }
      return T('canvas.zin.geen', 'De stand is niet opgehaald; dit beeld zegt dus niets over vandaag.');
    }
    if (s.niveau === 'verstoord') {
      return s.incident + (s.incident === 1
        ? T('canvas.zin.stuk1', ' zaak is verlopen of stuk en vraagt vandaag actie.')
        : T('canvas.zin.stuk', ' zaken zijn verlopen of stuk en vragen vandaag actie.'));
    }
    if (s.niveau === 'aandacht') {
      return T('canvas.zin.aandacht', 'Vandaag ') + s.aandacht + (s.aandacht === 1
        ? T('canvas.zin.aandacht1', ' zaak die uw aandacht vraagt.')
        : T('canvas.zin.aandachtn', ' zaken die uw aandacht vragen.'));
    }
    return T('canvas.zin.rustig', 'Uw dag verloopt rustig. Geen kritieke aandachtspunten.');
  }

  // Goedemorgen/-middag/-avond. Een dagdeel is geen smaak maar een klok, en die
  // staat op een plek zodat acht schermen niet drie verschillende grenzen kiezen.
  function groet(naam) {
    var u = new Date().getHours();
    var g = u < 6 ? T('canvas.nacht', 'Goedenacht')
      : u < 12 ? T('canvas.ochtend', 'Goedemorgen')
        : u < 18 ? T('canvas.middag', 'Goedemiddag') : T('canvas.avond', 'Goedenavond');
    return naam ? g + ' ' + naam : g;
  }

  w.RTGCanvas.zin = zin;
  w.RTGCanvas.groet = groet;
})(window);
