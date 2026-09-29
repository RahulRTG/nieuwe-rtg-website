/* Mobility OS (deelmodule): DE BESTUURDER VAN EEN VOERTUIG ALS TEAMLID.

   `bestuurder` was een vrije naam, en daar kan het verzuimregister niets mee.
   Een vervoerder kan het voertuig nu aan een teamlid van zijn EIGEN zaak hangen
   (`bestuurderStaffId`); de naam komt dan uit het team en niet uit het veld.
   Een vrije naam blijft kunnen -- een invalkracht van buiten -- en wordt dan op
   geen enkel teamlid gelegd.

   Staat dat teamlid vandaag als afwezig gemeld (kern/payroll/inplanbaar.js),
   dan slaat de MATCHER het voertuig over (./matching.js), met de reden erbij.
   Dat is met opzet geen reden in assetInzetbaar: het voertuig is in orde, en
   een mens die toch toewijst -- de centrale, of de chauffeur die zelf een rit
   aanneemt -- mag dat, met een waarschuwing (./dispatch-acties.js). Wat er
   gezegd wordt is DAT de bestuurder afwezig is, nooit waarom (PLANNING.md
   par. 6). */
'use strict';
const { maakInplanbaar } = require('../payroll/inplanbaar');

module.exports = (ctx) => {
  const { nu } = ctx;
  const inplanbaar = maakInplanbaar(ctx.afwezigOp);

  const bestuurderAfwezig = a => !!a && a.bestuurderStaffId != null &&
    !inplanbaar(a.vervoerder, a.bestuurderStaffId, nu().slice(0, 10)).plan;

  /* Leest `bestuurderStaffId` uit een verzoek. Geeft {} als het veld er niet
     in staat, { lid: null } om de koppeling weg te halen, { lid } voor een
     teamlid van deze vervoerder, en een weigering voor iemand die dat niet is
     -- ook niet als hij bij een ANDERE zaak wel bestaat. */
  function bestuurderKies(vervoerder, body) {
    const v = body.bestuurderStaffId;
    if (v === undefined) return {};
    if (v === null || v === '') return { lid: null };
    const lid = ((ctx.accounts && ctx.accounts.listStaff(vervoerder)) || []).find(m => m.id === Number(v));
    return lid ? { lid } : { status: 404, error: 'Dit teamlid bestaat niet bij uw zaak.' };
  }

  /* Zet wat het verzoek zegt: een vrije naam haalt de koppeling weg, een
     gekozen teamlid zet naam en koppeling samen. */
  function bestuurderZet(a, body, kies) {
    if (body.bestuurder != null) { a.bestuurder = ctx.schoon(body.bestuurder, 40) || null; a.bestuurderStaffId = null; }
    if ('lid' in kies) { a.bestuurderStaffId = kies.lid ? kies.lid.id : null; a.bestuurder = kies.lid ? kies.lid.name : null; }
  }

  const bestuurderBeeld = a => ({ bestuurder: a.bestuurder || null,
    bestuurderStaffId: a.bestuurderStaffId != null ? a.bestuurderStaffId : null,
    ...(bestuurderAfwezig(a) ? { bestuurderAfwezig: true } : {}) });

  return { afwezig: bestuurderAfwezig, kies: bestuurderKies, zet: bestuurderZet, beeld: bestuurderBeeld };
};
