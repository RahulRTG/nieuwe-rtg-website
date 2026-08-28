/* Historisch pad. De interactieve geldlaag woont in /apps/geld.html en gebruikt
   uitsluitend de geldgraaf, Pay, beleid en hun bestaande serverroutes. */
(function () { 'use strict'; location.replace('/apps/geld.html' + location.hash); })();
