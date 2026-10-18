/* ============================================================================
   HET OPSLAGCONTRACT VAN RTG THEATER -- de enige deur van dit domein naar db.data.

   Vijf bestanden van kern/theater (index, zaak, video, zaal, kantoor) grepen
   rechtstreeks in vier collecties, en de vorm stond in een functie lijsten()
   in ./index.js die iedereen eerst hoorde aan te roepen. Wie dat vergat -- of
   een lijst VERVING (video.js bij verwijderen, zaal.js bij de kap op de
   meldingen) -- zette een vorm neer die nergens gecontroleerd werd.

   Dezelfde discipline als kern/mobiliteit/opslag.js: een register, en bak()
   als de enige plek waar een collectie ontstaat. Geen gedeelde klasse.

   DRIE TOEGANGEN.
   - `bak(naam)` maakt de collectie aan als hij er niet is en geeft hem terug:
     dat is wat lijsten() gevolgd door db.data.x altijd deed.
   - `kijk(naam)` maakt niets aan; een ontbrekende collectie is leeg. Voor een
     leesroute die anders een lege bak zou achterlaten (de reacties bij een
     video die niemand heeft).
   - `zet(naam, waarde)` vervangt hem, met dezelfde vormcontrole als bak().
   `alle()` zet de vier tegelijk neer -- de oude lijsten(), die de deelbestanden
   blijven aanroepen.

   WAT DIT BESTAND MET OPZET NIET DOET: geen bytes en geen quota (./index.js
   rekent kanaalBytes), geen goedkeuring (./kantoor.js, een mens van RTG), en
   geen media op schijf -- die staan in mediaDir en niet in db.data.
   ========================================================================== */
'use strict';

const REGISTER = {
  theaterKanalen:   { soort: 'lijst', wat: 'kanalen van leden en (intern) van zaken' },
  theaterVideos:    { soort: 'lijst', wat: 'videos met titel, affiche en bytes; het bestand staat in mediaDir' },
  theaterReacties:  { soort: 'kaart', wat: 'per video-id: de reacties, gekapt op REACTIES_MAX' },
  theaterMeldingen: { soort: 'lijst', wat: 'meldingen van kijkers voor RTG-kantoor, gekapt op 200' }
};

const LEEG = { lijst: () => [], kaart: () => ({}) };
const klopt = (soort, w) => soort === 'lijst' ? Array.isArray(w) : (!!w && typeof w === 'object' && !Array.isArray(w));

module.exports = function maakTheaterOpslag({ db }) {
  if (!db) throw new Error('kern/theater/opslag: zonder db is er niets om te bewaren');

  function eis(naam) {
    const def = REGISTER[naam];
    if (!def) throw new Error('kern/theater/opslag: onbekende collectie "' + naam + '" -- zet hem eerst in het REGISTER');
    return def.soort;
  }
  function bak(naam) {
    const soort = eis(naam);
    if (!klopt(soort, db.data[naam])) db.data[naam] = LEEG[soort]();
    return db.data[naam];
  }
  function kijk(naam) {
    const soort = eis(naam);
    return klopt(soort, db.data && db.data[naam]) ? db.data[naam] : LEEG[soort]();
  }
  function zet(naam, waarde) {
    const soort = eis(naam);
    if (!klopt(soort, waarde)) throw new Error('kern/theater/opslag: "' + naam + '" hoort een ' + soort + ' te zijn');
    db.data[naam] = waarde;
    return waarde;
  }
  const alle = () => { for (const naam of Object.keys(REGISTER)) bak(naam); };

  return { bak, kijk, zet, alle, REGISTER };
};

module.exports.REGISTER = REGISTER;
