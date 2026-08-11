/* De neutrale caps die de landentabellen delen. Ze staan hier en niet in een
   van de twee tabellen, want allebei gebruiken ze deze woorden -- en een
   begrip dat twee keer wordt opgeschreven, gaat een keer uiteenlopen. */
'use strict';

/* `urencriterium`, `startersaftrek` en `dga-loon` zijn Nederlandse fiscale
   begrippen. Buiten Nederland staat er daarom wat er WAAR is over de winst,
   zonder te doen alsof wij het tarief kennen. Zie kern/onderneming/belasting.js:
   die weigert te rekenen zodra het land niet NL is. */
const PRIVE = 'winst-bij-eigenaar';
const RECHTSPERSOON_WINST = 'winstbelasting-rechtspersoon';

module.exports = { PRIVE, RECHTSPERSOON_WINST };
