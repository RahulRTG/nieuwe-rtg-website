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

   DUURZAAM VASTLEGGEN hoort bij de ROUTE die het antwoord geeft en niet bij de
   motor; zie `vastleggen` hieronder.

   HET ROOSTER EN DE STROOK. De `rooster`-adapter van de motor is de brug naar
   het verzuimregister (./verzuimbrug.js): een toegekende hele vrije dag komt
   daar te staan, en dat register lezen de loonrun en de planning al. Een deel
   van een dag komt er niet in, met de reden erbij. */
'use strict';
const { maakVrijheid } = require('./index');
const { rtgBeleid, STAND } = require('./rtgbeleid');
const { maakBeleid } = require('./beleid');

module.exports = ({ db, save, bijeen, inBundel, kern }) => {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/vrijheid',
    bezit: { vrijheid: 'kaart', vrijheidInstellingen: 'kaart' } });
  const instellingen = require('./instellingen')({ eigen, save });
  /* Het register komt LAAT uit de kern: payrollOS hangt er al, maar een toets
     met een kale kern heeft hem niet, en dan gooit de brug -- ONBEKEND, nooit
     stil "gelukt". */
  const rooster = require('./verzuimbrug')({ verzuim: () => (kern().payrollOS || {}).verzuim });
  const motor = maakVrijheid({ opslag: { bak: (naam) => eigen.bak(naam), kijk: (naam) => eigen.kijk(naam) }, save, rooster });
  const rtghuis = require('./rtghuis')({ db, save, kern });
  /* stap twee: een zetel in de RTG-zaak is de kantoorsleutel (./rtgzetel.js) */
  const rtgZetel = require('./rtgzetel')({ accounts: kern().accounts, rtghuis });
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

  return Object.freeze({ motor, instellingen, teambeeld, beleidVoor, vastleggen, rtghuis, rtgZetel, rtgStand: STAND });
};
