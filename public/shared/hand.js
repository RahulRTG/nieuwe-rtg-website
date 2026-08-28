/* LINKS- OF RECHTSHANDIG: de enige plek in dit huis die dat weet.

   WAAROM DIT ER MOET ZIJN. De duimboog van een rechtshandige loopt vanaf
   rechtsonder; die van een linkshandige spiegelbeeldig vanaf linksonder. Alles
   wat "onderaan binnen duimbereik" heet (GRAMMATICA.md) klopt dus maar voor een
   van de twee, en tot vandaag wist geen enkele regel in dit huis van het
   verschil. Een linkshandige had de bank onder zijn duim en Rahul buiten bereik,
   en in elk dialoogvenster lag ANNULEREN het dichtstbij en BEVESTIGEN het verst
   weg -- precies verkeerd om.

   DE REGEL DIE HIERMEE VERSCHUIFT staat in ADAPTIEF.md. Daar stond: "links is
   altijd de bank, rechts is altijd Rahul, nooit de plekken". Die belofte is
   VOORSPELBAARHEID, en die blijft heel: de bank staat aan de ANKERZIJDE, Rahul
   aan de DUIMZIJDE. Een mens zet zijn hand een keer en daarna verschuift er
   nooit meer iets. Voorspelbaarheid is dan per mens in plaats van per pixel.

   EEN SCHRIJVER, MEERDERE LEZERS. `zet()` is het enige wat de waarde verandert,
   en hij schrijft naar twee plekken tegelijk:

     localStorage  de waarheid, want die overleeft een uitgelogde sessie
     cookie        alleen zodat de SERVER hem kan lezen (voordeur.js) en
                   data-hand al in de HTML kan zetten. Zonder dat klapt het
                   scherm van een linkshandige bij elke start zichtbaar om.

   Lopen die twee uiteen -- een blad uit de servicewerker-cache draagt een oud
   attribuut -- dan wint localStorage en wordt de cookie meteen bijgetrokken.
   Dat is geen tweede waarheid maar een afgesproken uitkomst.

   Deze module staat bewust NIET op uitgesteld: hij hoort te draaien voordat er
   iets getekend wordt. server/middleware/voordeur.js hangt hem vooraan in de
   <head> van elk scherm, zodat er geen 257 losse scripttags voor nodig zijn. */
(function (w, d) {
  'use strict';
  var SLEUTEL = 'rtg_hand', GOED = { links: 1, rechts: 1 }, STANDAARD = 'rechts';

  function uitOpslag() {
    try { var v = localStorage.getItem(SLEUTEL); if (GOED[v]) return v; } catch (e) {}
    return null;
  }
  function uitKoek() {
    var m = /(?:^|;\s*)rtg_hand=(links|rechts)/.exec(d.cookie || '');
    return m ? m[1] : null;
  }
  /* De volgorde IS de regel: opslag boven cookie boven standaard. */
  function lees() { return uitOpslag() || uitKoek() || STANDAARD; }

  function pas(h) { d.documentElement.setAttribute('data-hand', h); }

  function bewaar(h) {
    try { localStorage.setItem(SLEUTEL, h); } catch (e) {}
    /* Een jaar, want dit is een lichaamskenmerk en geen sessiegegeven. Geen
       Secure-vlag: dan werkt hij niet op http tijdens ontwikkelen, en er staat
       niets gevoeligs in -- alleen welke hand iemand gebruikt. */
    try { d.cookie = SLEUTEL + '=' + h + ';path=/;max-age=31536000;samesite=Lax'; } catch (e) {}
  }

  function zet(h) {
    if (!GOED[h]) return lees();
    bewaar(h); pas(h);
    /* Wie meebeweegt hoeft niet te weten WIE het veranderde. De schilbalk
       herbouwt zich hierop, want die spiegelt in DOM-volgorde en niet met
       `order` -- een schermlezer hoort de dingen te lezen waar ze staan. */
    try { w.dispatchEvent(new CustomEvent('rtg-hand', { detail: { hand: h } })); } catch (e) {}
    return h;
  }

  /* Bij het laden meteen gelijktrekken: het attribuut dat de server erin zette
     kan uit een oude cookie komen, of uit een blad dat de servicewerker
     bewaarde. */
  var nu = lees();
  pas(nu);
  if (uitKoek() !== nu) bewaar(nu);

  w.RTGHand = {
    is: lees,
    zet: zet,
    links: function () { return lees() === 'links'; },
    /* De twee zijden bij naam, zodat een scherm niet zelf hoeft te rekenen. */
    duimzijde: function () { return lees() === 'links' ? 'left' : 'right'; },
    ankerzijde: function () { return lees() === 'links' ? 'right' : 'left'; }
  };
})(window, document);
