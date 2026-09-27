/* DE THUISKOMST EN DE WEG NAAR GAST bij ./idemsleutels-nooit-routes.js -- vijf
   routes die het ZELF weten (27 september 2026). Een reis die thuis is komt niet
   nog eens thuis (kern/reisbureau-thuis.js), en een pas die gast is wordt niet
   nog eens gast (kern/aanmeldingen/naargast.js): de standcontrole geeft 409 en
   die weigering is het antwoord. Een laag die de tweede oproep opslikt met het
   succes van de eerste, verbergt dat. */
'use strict';

module.exports = {
  'POST /api/reisbureau/thuis': 'een reis die thuis is, komt niet nog eens thuis; de weigering is het antwoord',
  'POST /api/office/reisbureau/thuis': 'zelfde reden als de ledenkant',
  'POST /api/mijn/pas/gast': 'nu laat de sessies vervallen en einde is idempotent op stand; een afgespeeld succes verbergt dat',
  'POST /api/office/pas/gast': 'een tweede keer is al gast (409); die weigering is het antwoord',
  'POST /api/office/pas/gast/ronde': 'een ronde kijkt naar de klok van nu; een opgeslikte tweede laat liggen wat intussen aan de beurt is',
};
