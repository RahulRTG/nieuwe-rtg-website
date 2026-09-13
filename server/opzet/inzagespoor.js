/* ============================================================================
   HET INZAGEJOURNAAL DUURZAAM AANSLUITEN -- een bestand, een besluit.

   WAAROM DIT EEN EIGEN MODULE IS EN GEEN REGEL IN server.js. `npm run check`
   regel 47 bewaakt WIE besluit dat er duurzaam wordt geschreven, en doet dat op
   bestandsnaam. Zou deze bedrading in server.js staan, dan kwam het grootste
   bestand van dit huis op die lijst te staan met een reden die maar over drie
   regels gaat -- en een lijst waarvan de regels niet meer op hun bestand
   passen, leest als dekking die er niet is. Dit is dezelfde vorm als
   kern/command/lagen.js: bedraadt de helper, kiest zelf niets.

   WAT HIER WORDT BESLOTEN. Dat het inzagejournaal aan de duurzame vastlegger
   hangt in plaats van aan de gewone write-behind save(). De grond staat in
   server/inzagelog.js bij noteerVast(): zonder aantoonbaar spoor geen inzage,
   en "geen uitzondering" is geen bewijs dat er iets STAAT -- save() zet binnen
   een bundel alleen een vlag, en in PostgreSQL-modus markeert hij dat de
   responsepoort later moet committen.

   WAAROM HET AUDITSPOOR HIER AL EEN PRECEDENT IS. check.js regel 47 draagt
   server/kern/afdelingen/bewaking/index.js met de reden "het auditspoor: een
   handeling die is bevestigd, moet achteraf te herleiden zijn -- ook na een
   opslagstoring". Het inzagejournaal is diezelfde klasse en stond er niet op.
   Het verschil is zelfs scherper: bij de bewaking gaat het om wie een knop
   omzette, hier om wie de identiteitskluis van een mens heeft geopend.

   WAT HIER NIET GEBEURT. noteer() blijft write-behind, en dat is met opzet. De
   42 aanroepers van dat spoor gaan per plek om, met een reden erbij -- niet in
   een ronde, want bij een lijstscherm dat een naam toont is weigeren iets
   anders dan bij het openen van een kluis. Deze module maakt dat MOGELIJK; wie
   weigert, staat bij de aanroeper.
   ========================================================================== */
'use strict';

const maakVastleggen = require('../lib/duurzaam');

module.exports = function sluitInzagespoorAan({ db, save, bijeen, inBundel }) {
  const vastleggen = maakVastleggen({ bijeen, save, inBundel, bron: 'inzagelog' });
  require('../inzagelog').zet(db, save, vastleggen);
  return vastleggen;
};
