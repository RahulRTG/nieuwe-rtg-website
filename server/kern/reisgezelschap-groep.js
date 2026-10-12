/* DE GROEPSLAAG VAN EEN REISGEZELSCHAP, aan elkaar geknoopt.

   Drie modules, een volgorde: wat ieder opgeeft (./reisgezelschap-opgave.js),
   wat daaruit voor de groep volgt (./reisgezelschap-opties.js, met de
   projectie per lezer in ./reisgezelschap-werkruimte.js), en waar ieder apart
   mee instemt (./reisgezelschap-instemming.js). Dit bestand knoopt ze aan
   elkaar en doet verder niets; het staat los omdat ./reisgezelschap.js en de
   opgavemodule allebei tegen de grens van keuringsregel 13 aan zitten.

   DE SMALLE WEG. Alleen de berekening en de instemming krijgen
   `voorDeBerekening` (de opgaven van iedereen); die weg komt zo nergens op de
   kern te liggen en geen route roept hem aan. */
'use strict';

module.exports.maakGezelschapGroep = ({ db, save, klok, crypto, leden, reisVan }) => {
  const opgave = require('./reisgezelschap-opgave').maakGezelschapOpgave({ db, save, klok, leden, reisVan });
  const weg = { VOORKEUREN: opgave.VOORKEUREN, deelnameVan: opgave.deelnameVan, voorDeBerekening: opgave.voorDeBerekening };
  const opties = require('./reisgezelschap-opties').maakGezelschapOpties({
    db, save, klok, crypto, reisVan, opgave: weg, instemming: () => instemming });
  const instemming = require('./reisgezelschap-instemming').maakInstemming({
    db, save, klok, crypto, reisVan, opgave: weg, optieVan: opties.optieVan,
    pastBij: require('./reisgezelschap-opties-reken').pastBij });

  /* Wie uit het gezelschap gaat, neemt zijn opgave en zijn instemming mee. */
  function wisVoorLid(lid, eigenaar, reisId) {
    instemming.wisVoorLid(lid, eigenaar, reisId);
    return opgave.wisVoorLid(lid, eigenaar, reisId);
  }

  return {
    voortgang: opgave.voortgang, wisVoorLid,
    routes: Object.assign({}, opgave.routes, {
      zetOptie: opties.zetOptie, wisOptie: opties.wisOptie, groepsbeeld: opties.groepsbeeld,
      legVoor: instemming.legVoor, trekVoorstelIn: instemming.trekVoorstelIn,
      instem: instemming.antwoord, neemInstemmingTerug: instemming.neemTerug })
  };
};
