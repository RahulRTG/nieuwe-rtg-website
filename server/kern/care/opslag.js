/* DE COLLECTIES VAN RTG CARE, met hun vorm, op een plek (kern/eigencollectie.js).

   ../care.js bouwt deze deur een keer en geeft hem via ctx.opslag aan de
   deelbestanden (leden, zaak, wachtlijst, vastleggen); die raken db.data niet
   meer aan. Een deelbestand dat LOS wordt gebouwd -- zoals
   test/leeszonderscheppen.test.js met ./zaak.js doet -- bouwt hem hier zelf,
   zodat er nooit een tweede declaratie van dezelfde collecties ontstaat
   (keuringsregel 63 zakt op twee eigenaren).

   Niemand buiten RTG Care schrijft in deze zeven collecties. */
'use strict';

module.exports = ({ db }) => require('../eigencollectie')({ db, domein: 'kern/care', bezit: {
  careBoekingen: 'lijst',       // geboekte behandelingen
  careIntake: 'lijst',          // toestemmingen: dossier delen met een aanbieder
  careAanbieders: 'lijst',      // aanbieders met behandelaars en behandelingen
  careWachtlijst: 'lijst',      // wachtenden op een vrijgekomen slot (./wachtlijst.js)
  careVastlegging: 'lijst',     // vastlegging door een behandelaar (./vastleggen.js)
  carePakketten: 'lijst',       // herstel- en verblijfpakketten (./zaak.js)
  carePakketBoekingen: 'lijst'  // geboekte pakketten (./zaak.js)
} });
