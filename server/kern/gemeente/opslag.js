/* ============================================================================
   HET OPSLAGCONTRACT VAN DE GEMEENTE -- de enige deur van dit domein naar db.data.

   Vijf bestanden (index, meldingen, burgerzaken, vergunningen, info) schreven
   elk rechtstreeks in vijf collecties, en de vorm stond op twee manieren:
   seed() in ./index.js zette ze bij de eerste aanroep als lijst neer, en de
   rest ging er daarna van uit dat dat gebeurd was (`db.data.x.unshift`) of
   viel terug op `|| []`. Wie een zesde schreef, raadde welke van de twee.

   Dezelfde vorm als kern/mobiliteit/opslag.js (losse collecties op het hoogste
   niveau, alle met hetzelfde voorvoegsel) en met opzet geen gedeelde klasse:
   wat gedeeld wordt is de discipline, niet de code.

   DRIE TOEGANGEN, EN ZE ZIJN NIET HETZELFDE.
   - `lijst(naam)` LEEST en maakt niets aan; een ontbrekende lijst is leeg.
   - `pak(naam)` MAAKT de lijst aan omdat er zo meteen in geschreven wordt.
   - `zet(naam, lijst)` vervangt hem, voor de kap op een maximum.

   EEN VREEMDE SCHRIJVER, EN HIJ STAAT HIER MET NAAM. In demostand zet seed()
   een verzonnen gemeente in db.data.suppliers, de collectie van de zaken. Dat
   is de enige plek waar dit domein in andermans collectie schrijft; hij staat
   in `vreemd` zodat wie de gemeente ooit los wil trekken ziet wat dat kost.

   WAT DIT BESTAND MET OPZET NIET DOET: geen schema's, geen bevoegdheid (dat is
   magBehandelen in ./index.js), geen bewaartermijn -- de kap op 20000 is een
   grens en geen bewaarbeleid, en blijft bij de schrijver die hem kent.
   ========================================================================== */
'use strict';

const REGISTER = {
  gemeenteMeldingen:    { soort: 'lijst', wat: 'meldingen openbare ruimte (./meldingen.js), nieuwste eerst' },
  gemeenteAfspraken:    { soort: 'lijst', wat: 'balie-afspraken burgerzaken (./burgerzaken.js)' },
  gemeenteVergunningen: { soort: 'lijst', wat: 'vergunningsaanvragen (./vergunningen.js)' },
  gemeenteAanslagen:    { soort: 'lijst', wat: 'gemeentelijke aanslagen per lid (./info.js)' },
  gemeenteBekend:       { soort: 'lijst', wat: 'bekendmakingen (./info.js, ./vergunningen.js)' }
};

module.exports = function maakGemeenteOpslag({ db }) {
  if (!db) throw new Error('kern/gemeente/opslag: zonder db is er niets om te bewaren');

  function eis(naam) {
    if (!REGISTER[naam]) throw new Error('kern/gemeente/opslag: onbekende collectie "' + naam + '" -- zet hem eerst in het REGISTER');
  }
  const lijst = (naam) => { eis(naam); return Array.isArray(db.data[naam]) ? db.data[naam] : []; };
  const pak = (naam) => { eis(naam); if (!Array.isArray(db.data[naam])) db.data[naam] = []; return db.data[naam]; };
  const zet = (naam, waarde) => {
    eis(naam);
    if (!Array.isArray(waarde)) throw new Error('kern/gemeente/opslag: "' + naam + '" hoort een lijst te zijn');
    db.data[naam] = waarde;
    return waarde;
  };

  /* Of de eenmalige zaaironde al gedraaid heeft. Een vlag en geen collectie. */
  const gezaaid = () => !!db.data._gemeenteSeed;
  const markeerGezaaid = () => { db.data._gemeenteSeed = true; };

  const vreemd = {
    /* lezen: de zaken, om de gemeente te vinden */
    zaken: () => (Array.isArray(db.data.suppliers) ? db.data.suppliers : null),
    /* schrijven, alleen in demostand: de verzonnen gemeente neerzetten */
    voegZaakToe: (zaak) => { db.data.suppliers.push(zaak); }
  };

  return { lijst, pak, zet, gezaaid, markeerGezaaid, vreemd, REGISTER };
};

module.exports.REGISTER = REGISTER;
