/* VRIJHEID: DE MONTAGE -- wat de server van deze laag krijgt, onder EEN naam.

   kern.vrijheid bevat de motor (index.js), de instellingen die nergens anders
   wonen (instellingen.js), het teambeeld uit de bestaande bronnen
   (teambeeld.js) en het besloten beleid van RTG zelf (rtgbeleid.js). Onder een
   naam en niet via Object.assign: `vraag`, `plan`, `lees` en `beeld` zijn in
   een zak van negenhonderd namen levensgevaarlijk generiek (zelfde reden als
   kern.festival in opzet/kernlaag5f.js).

   DE OPSLAG is een eigen collectie per domein (kern/eigencollectie.js):
   `vrijheid` voor verzoeken, grootboek en boekingen per organisatie, en
   `vrijheidInstellingen` voor wat de zaak en de mens zelf opgeven.

   WAT HIER NOG NIET GEBEURT, en waarom:
     - duurzaam vastleggen (lib/duurzaam.js). De motor schrijft via save(), en
       dat is write-behind. Een besluit over iemands vrije tijd hoort pas "gelukt"
       te heten als het vaststaat -- maar dat hoort bij de ROUTE die het antwoord
       geeft (VRIJHEID.md par. 7, P0 punt 6), niet bij de motor.
     - het rooster terugschrijven. Er gaat geen `rooster`-adapter mee, dus een
       besluit staat op NIET_AANGESLOTEN in plaats van te doen alsof het rooster
       is bijgewerkt. */
'use strict';
const { maakVrijheid } = require('./index');
const { rtgBeleid, STAND } = require('./rtgbeleid');
const { maakBeleid } = require('./beleid');

module.exports = ({ db, save, bijeen, inBundel, kern }) => {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/vrijheid',
    bezit: { vrijheid: 'kaart', vrijheidInstellingen: 'kaart' } });
  const instellingen = require('./instellingen')({ eigen, save });
  const motor = maakVrijheid({ opslag: { bak: (naam) => eigen.bak(naam), kijk: (naam) => eigen.kijk(naam) }, save });
  const rtghuis = require('./rtghuis')({ db, save, kern });
  const { teambeeld } = require('./teambeeld')({ bronnen: () => ({ ...kern(), rtghuis }), instellingen });

  /* Welk beleid geldt voor welke organisatie. Voor RTG zelf is er een besluit
     (rtgbeleid.js), en RTG zelf is de zaak met genre `rtg` (kern/vrijheid/rtghuis.js);
     een andere zaak heeft nog geen beleid en krijgt dan een LEEG beleid --
     open waarden, nooit het beleid van RTG geleend. `isRtg` mag een toets
     meegeven; de server vraagt het aan rtghuis. */
  function beleidVoor(code, isRtg) {
    const rtg = isRtg !== undefined ? isRtg : rtghuis.isRtgZaak(code);
    return rtg ? rtgBeleid() : maakBeleid({});
  }

  /* DUURZAAM VASTLEGGEN (lib/duurzaam.js). Een besluit over iemands vrije tijd
     heet pas gelukt als de opslag het bevestigt: een goedgekeurde dag die na een
     herstart weg is, is een belofte die niemand heeft gebroken maar die wel
     kapot is. De route wikkelt elke mutatie hierin; lezen gaat er niet door.
     Zonder bijeen (een toets met een kale db) is er niets te bevestigen en
     loopt de mutatie gewoon. */
  const vastleggen = bijeen
    ? require('../../lib/duurzaam')({ bijeen, save, inBundel, bron: 'vrijheid' })
    : async (werk) => { await werk(); return null; };

  return Object.freeze({ motor, instellingen, teambeeld, beleidVoor, vastleggen, rtghuis, rtgStand: STAND });
};
