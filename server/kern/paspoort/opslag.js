/* ============================================================================
   HET OPSLAGCONTRACT VAN HET RTG-PASPOORT -- de enige deur van dit domein naar
   db.data.

   Drie lijsten: de identiteitsverzoeken van partners, de incidenten waarbij
   inzage werd opgeeist, en het volledige inzagelog. Drie bestanden schreven er
   rechtstreeks in (../paspoort.js het log, ./verzoeken.js de verzoeken,
   ./toezicht.js de incidenten EN een verzoek bij een incident), met de vorm in
   een functie lijsten() die iedereen eerst hoorde aan te roepen.

   WAT HIER STAAT IS GEEN IDENTITEIT. De lijsten dragen sleutels, codenamen en
   zaakcodes; de echte naam, het document en de foto staan in de kluis
   (server/accounts.js, member_state) en komen hier niet langs. Deze deur
   verandert daar niets aan -- hij maakt alleen zichtbaar dat er voor deze drie
   lijsten een plek is en niet drie.

   Een handgeschreven contract en geen kern/eigencollectie: kern/initdata zet
   deze lijsten bij de start ook neer, en een eigencollectie-declaratie zou
   dat in keuringsregel 63 als indringer laten zakken.

   - `bak(naam)` MAAKT de lijst aan, zoals lijsten() deed.
   - `zet(naam, lijst)` vervangt hem voor de kap, alleen met een lijst.
   - `alle()` is de oude lijsten().
   ========================================================================== */
'use strict';

const REGISTER = {
  paspoortVerzoeken:  { soort: 'lijst', wat: 'identiteitsverzoeken van partners (op sleutel en zaakcode), gekapt op 50000' },
  paspoortIncidenten: { soort: 'lijst', wat: 'opgeeiste inzage bij incidenten; RTG beoordeelt, gekapt op 50000' },
  paspoortLog:        { soort: 'lijst', wat: 'het volledige inzagelog, gekapt op 50000' }
};

module.exports = function maakPaspoortOpslag({ db }) {
  if (!db) throw new Error('kern/paspoort/opslag: zonder db is er niets om te bewaren');

  function eis(naam) {
    if (!REGISTER[naam]) throw new Error('kern/paspoort/opslag: onbekende collectie "' + naam + '" -- zet hem eerst in het REGISTER');
  }
  function bak(naam) {
    eis(naam);
    if (!Array.isArray(db.data[naam])) db.data[naam] = [];
    return db.data[naam];
  }
  function zet(naam, lijst) {
    eis(naam);
    if (!Array.isArray(lijst)) throw new Error('kern/paspoort/opslag: "' + naam + '" hoort een lijst te zijn');
    db.data[naam] = lijst;
    return lijst;
  }
  const alle = () => { for (const naam of Object.keys(REGISTER)) bak(naam); };

  return { bak, zet, alle, REGISTER };
};

module.exports.REGISTER = REGISTER;
