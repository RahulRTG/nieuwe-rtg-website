/* DE STAND VAN DE MODELKRAAN, ZICHTBAAR VOOR WIE ERVOOR BETAALT.

   ../../ai-meter.js telt sinds kort wat er aan externe modellen omgaat, en
   draagt twee kranen. Maar een meter die niemand kan aflezen is geen meter: dan
   is de factuur nog steeds het eerste moment waarop je iets merkt, en dan is
   het tellen voor niets geweest.

   Alleen de eigenaar. Niet omdat het gevoelig is -- er staan geen leden in,
   alleen tokens en bedragen -- maar omdat het een bedrijfscijfer is, en de
   techniekpagina is de plek waar die horen. Zelfde bewaking als de
   betaalregie hiernaast.

   WAT HET ANTWOORD EERLIJK MOET ZEGGEN, en waarom dat in het veld `let` staat:
   dit is een SCHATTING op een lokale prijstabel met een peildatum, en de stand
   begint bij nul na een herstart. Het bewaakt een orde van grootte en het
   dichtdraaien van een kraan; het is geen boekhouding, en het scherm dat dit
   toont hoort dat niet te suggereren.

   Gemount vanuit routes/techniek.js. */
'use strict';

const meter = require('../../ai-meter');
const budgetLaag = require('../../ai-budget');
const budgetBeleid = require('../../ai-budget-beleid');

/* Wat het budget per persoon doet, zonder te vertellen WIE eraan zit. Het
   aantal zegt genoeg om te merken dat een grens te krap staat; een lijst met
   sleutels zou van een kostenoverzicht een gedragsrapport maken. */
function budgetOverzicht() {
  let tellingen = {};
  try { tellingen = budgetLaag.alleTellingen() || {}; } catch (e) { return null; }
  const budgetten = budgetBeleid.budgetten();
  let opGrens = 0, mensen = 0, vrijEuro = 0;
  for (const rij of Object.values(tellingen)) {
    if (!rij) continue;
    mensen += 1;
    vrijEuro += (Number(rij.vrijCent) || 0) / 100;
    const b = budgetten[rij.pas || 'gratis'];
    if (b && b.cent && (Number(rij.cent) || 0) >= b.cent) opGrens += 1;
  }
  return {
    perPas: Object.fromEntries(Object.entries(budgetten).map(([pas, b]) =>
      [pas, { venster: b.venster, euro: b.cent / 100 }])),
    mensenMetVerbruik: mensen,
    mensenOpDeGrens: opGrens,
    /* Wat de Foundation kostte. Die telt wel mee maar sluit nooit; zonder dit
       getal is dat een belofte zonder rekening erbij. */
    vrijgesteldEuro: Math.round(vrijEuro * 100) / 100,
    koers: budgetBeleid.koers(),
    koersPeildatum: budgetBeleid.KOERS_PEILDATUM
  };
}

module.exports = (ctx) => {
  const { app, techAuth, eigenaarAlleen, anthropic } = ctx;

  app.get('/api/techniek/ai/kosten', techAuth, eigenaarAlleen, (req, res) => {
    const stand = meter.stand();
    res.json({
      ...stand,
      /* De rem staat los van het dagplafond: de een begrenst een aanroeper, de
         ander de dag. Allebei tonen, anders lijkt "geen plafond" op "geen
         bescherming". */
      beurtenPerMinuut: require('../../ai-rem').beurtGrens() || null,
      /* En de eigen modelserver zelf. Het aandeel extern zegt DAT hij afhaakt;
         dit zegt waarom -- bezet, of overgeslagen na storingen. */
      lokaleServer: anthropic && typeof anthropic.lokaleStaat === 'function' ? anthropic.lokaleStaat() : null,
      /* Het budget per persoon: de bedragen zoals ze gelden, en HOEVEEL mensen
         er vandaag tegenaan lopen. Bewust een AANTAL en geen lijst -- wie er
         aan zijn grens zit is een gegeven over een lid, en dat hoort niet in
         een kostenoverzicht te staan omdat het toevallig te tellen is. */
      budget: budgetOverzicht()
    });
  });
};
