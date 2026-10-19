/* ============================================================================
   HET OPSLAGCONTRACT VAN DE BEVEILIGING -- de enige deur van dit domein naar
   db.data.

   ../beveiliging.js droeg vier accessors (diensten, aanvragen, incidenten,
   rondes) die elk dezelfde vormregel herhaalden, en vier deelbestanden
   (pda/index, pda/patrouille, rooster/aanvragen, rooster/planning) VERVINGEN
   die lijsten daarna rechtstreeks voor de kap -- zonder vormcontrole en buiten
   de accessor om. Vijf bestanden die in db.data schreven, voor vier lijsten.

   Een handgeschreven contract en geen kern/eigencollectie: kern/initdata zet
   deze vier lijsten bij de start ook neer, en een eigencollectie-declaratie
   zou dat in keuringsregel 63 als indringer laten zakken.

   - `bak(naam)` (en de vier namen erboven) MAAKT de lijst aan, zoals de
     accessors altijd deden.
   - `zet(naam, lijst)` vervangt hem, met vormcontrole: alleen een lijst.

   WAT DIT BESTAND NIET DOET: geen rooster- of rustregels (./rooster), geen
   functies of posten per zaak (die staan op de zaak zelf, defaults() in
   ../beveiliging.js), geen bewaartermijn -- de kap is een grens.
   ========================================================================== */
'use strict';

const REGISTER = {
  bevDiensten:   { soort: 'lijst', wat: 'geplande en gelopen diensten, gekapt op 100000' },
  bevAanvragen:  { soort: 'lijst', wat: 'aanvragen van opdrachtgevers, gekapt op 20000' },
  bevIncidenten: { soort: 'lijst', wat: 'incidenten van de PDA, gekapt op 50000' },
  bevRondes:     { soort: 'lijst', wat: 'patrouillerondes, gekapt op 50000' }
};

module.exports = function maakBeveiligingOpslag({ db }) {
  if (!db) throw new Error('kern/beveiliging/opslag: zonder db is er niets om te bewaren');

  function eis(naam) {
    if (!REGISTER[naam]) throw new Error('kern/beveiliging/opslag: onbekende collectie "' + naam + '" -- zet hem eerst in het REGISTER');
  }
  function bak(naam) {
    eis(naam);
    if (!Array.isArray(db.data[naam])) db.data[naam] = [];
    return db.data[naam];
  }
  function zet(naam, lijst) {
    eis(naam);
    if (!Array.isArray(lijst)) throw new Error('kern/beveiliging/opslag: "' + naam + '" hoort een lijst te zijn');
    db.data[naam] = lijst;
    return lijst;
  }

  return {
    bak, zet, REGISTER,
    diensten: () => bak('bevDiensten'),
    aanvragen: () => bak('bevAanvragen'),
    incidenten: () => bak('bevIncidenten'),
    rondes: () => bak('bevRondes')
  };
};

module.exports.REGISTER = REGISTER;
