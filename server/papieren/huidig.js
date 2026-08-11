/* WAT HET SYSTEEM VANDAAG DOET, bij de vragen die daarover gaan.

   Geen antwoord: invullen doet de mens (zie de kop van ./vragen.js). Wel het
   feit dat je nodig hebt om te kunnen antwoorden, op het moment dat de vraag
   valt -- een eigenaar die moet beslissen hoe lang een paspoortscan blijft
   staan, hoort te weten wat er nu gebeurt.

   AFGELEID EN NIET OVERGESCHREVEN. De getallen komen uit de bewaarveger zelf.
   Een zin die "zeven dagen" zegt terwijl de veger op drie staat, is precies de
   soort onwaarheid die in een verwerkingsregister het duurst is, en niemand
   ziet hem gebeuren (LAT-regel 4 en 6). Staat hier een tak bij, dan hoort hij
   op dezelfde manier te worden afgeleid. */
'use strict';

const { STANDAARD } = require('../bewaarveger');

const dagenTekst = (d) => d >= 365 ? Math.round(d / 365) + ' jaar' : d + ' dagen';

const nuTermijn = (wat) => wat === 'id'
  ? 'het document gaat ' + dagenTekst(STANDAARD.idDagen) + ' na de geslaagde verificatie de kluis uit; alleen de uitkomst blijft (server/bewaarveger.js). Wijkt uw antwoord daarvan af, dan hoort de veger mee te veranderen.'
  : 'een live-positie die ' + dagenTekst(STANDAARD.locatieDagen) + ' niet is bijgewerkt wordt gewist (server/bewaarveger.js). Wijkt uw antwoord daarvan af, dan hoort de veger mee te veranderen.';

module.exports = { nuTermijn, dagenTekst };
