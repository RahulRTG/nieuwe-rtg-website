/* HET VAKSCHEMA bij ./idemsleutels-nooit-routes.js -- drie routes die het ZELF
   al weten (kern/vakschema.js, RUGDEKKING.md par. 4.4).

   Bij `aanvaard` en `weiger` is de reden dezelfde als overal: een afgespeeld
   antwoord verbergt dat het al gebeurd was, en het lid leest dan de reden en het
   tijdstip van de EERSTE beslissing als die van de tweede.

   BIJ `voorstel` IS DE REDEN EEN ANDERE, en die hoort hier te staan omdat hij
   makkelijk voor overbodig wordt aangezien. De kern onderdrukt daar zelf een
   identieke tweede kaart en geeft een byte-voor-byte gelijk antwoord -- een
   duplicaatlaag eroverheen zou hetzelfde doen en dus "niets kapotmaken". Toch
   niet: die laag herkent een herhaling aan de idempotentiesleutel, en de kern
   aan de INHOUD. Dat verschil is precies wat hier telt, want dezelfde tekst na
   een half jaar opnieuw sturen HOORT te werken (een herhaling is geen
   dubbelklik), en dezelfde sleutel twee keer gebruiken mag nooit iets nieuws
   opleveren. Twee laagjes met twee definities van "hetzelfde" geven binnen een
   maand twee antwoorden op dezelfde vraag. */
'use strict';

module.exports = Object.freeze({
  'POST /api/supplier/vakschema/voorstel':
    'onderdrukt zelf een identieke openstaande kaart op de INHOUD en geeft dan hetzelfde antwoord; een ' +
    'duplicaatlaag herkent een herhaling op de SLEUTEL, en die twee definities van "hetzelfde" horen ' +
    'niet naast elkaar te staan',
  'POST /api/training/voorstel/aanvaard':
    'geeft 404 zodra het voorstel niet meer openstaat; een afgespeeld succes zou het lid laten denken ' +
    'dat er een tweede schema is bijgekomen',
  'POST /api/training/voorstel/weiger':
    'geeft 404 zodra het voorstel niet meer openstaat; een afgespeeld antwoord leest de reden van de ' +
    'eerste weigering als die van de tweede'
});
