/* ============================================================================
   IDEM-SLEUTELS -- DE KALE RONDE VAN 30 AUGUSTUS 2026.

   Deel van ./idemsleutels.js; zie de kop daar voor de vorm, de regels en waarom
   een verklaring op de NAAM van een route een gok is met een net gezicht.

   WAT DEZE ROUTES GEMEEN HEBBEN. De idemproef stuurt naast zijn gewone ronde een
   KALE ronde: twee woordelijk gelijke oproepen, geen idem-veld, geen header --
   de echte dubbeltik van een ongeduldige gebruiker. Honderdzestien routes deden
   daar het werk gewoon opnieuw. Van de routes hieronder is de handler nagelezen,
   en bij elk ervan staat er een veld in de body dat bepaalt WAT er ontstaat.
   Twee identieke verzoeken binnen het dubbeltikvenster zijn dan een dubbeltik.

   Het veld staat er per regel bij, en dat is geen versiering: het is waar een
   volgende lezer op moet controleren als de handler verandert.
   ========================================================================== */
'use strict';

const SLEUTELS = {
  /* ---- gelezen op 30 augustus 2026, uit de kale ronde van de idemproef ----

     Deze routes deden bij een woordelijk gelijke herhaling ZONDER sleutel het
     werk gewoon opnieuw. Van elk is de handler nagelezen -- niet de naam, want
     dat is precies de fout waar de kop van dit bestand voor waarschuwt en waar
     /api/muziek/maak hierboven het litteken van draagt.

     Bij deze staat er wel degelijk een veld in de body dat bepaalt WAT er
     ontstaat, en een tweede identiek verzoek binnen het dubbeltikvenster is dus
     een dubbeltik en geen tweede bedoeling. Het veld staat er per regel bij. */
  'POST /api/bedrijf/lid/aanmeld': { zelfdeVerzoek: true },            // naam + functie + afdeling
  'POST /api/bedrijf/project/maak': { zelfdeVerzoek: true },           // naam + werkvorm
  'POST /api/bedrijf/taak/maak': { zelfdeVerzoek: true },              // titel + projectId
  'POST /api/bedrijf/werkruimte/maak': { zelfdeVerzoek: true },        // naam + moeder
  'POST /api/festival/nieuw': { zelfdeVerzoek: true },                 // de naam van het festival
  'POST /api/foundation/gezin/agenda': { zelfdeVerzoek: true },        // titel + datum + tijd
  'POST /api/foundation/gezin/droom/maak': { zelfdeVerzoek: true },    // de tekst van de droom
  'POST /api/foundation/gezin/gezondheid/medicijn': { zelfdeVerzoek: true },  // naam van het medicijn
  'POST /api/foundation/gezin/klus': { zelfdeVerzoek: true },          // titel + sterren + voor wie
  'POST /api/foundation/les/maak': { zelfdeVerzoek: true },            // vak + docentnaam
  'POST /api/foundation/school/bezoeker/aanmeld': { zelfdeVerzoek: true },    // naam + organisatie
  'POST /api/foundation/school/leerling/aanmeld': { zelfdeVerzoek: true },    // naam + opleiding
  'POST /api/foundation/school/subsidie/zet': { zelfdeVerzoek: true },        // naam + verstrekker
  'POST /api/bank/pas/uitgeven': { zelfdeVerzoek: true },              // iban + soort + naam

  /* TWEE MET EEN ADDERTJE, en dat hoort erbij te staan. `klant/zet` en
     `repo/zet` heten `zet` maar doen `const id = req.body.klantId || rid(5)`:
     MET een id werken ze bij, ZONDER id maken ze er elke keer een nieuwe. De
     verklaring geldt dus vooral die tweede vorm -- en dat is precies de vorm
     waarin een dubbeltik een dubbele klant oplevert. */
  'POST /api/bedrijf/klant/zet': { zelfdeVerzoek: true },              // klantId of, zonder id, de naam
  'POST /api/bedrijf/repo/zet': { zelfdeVerzoek: true },               // repoId of, zonder id, de naam
};

module.exports = { SLEUTELS };
