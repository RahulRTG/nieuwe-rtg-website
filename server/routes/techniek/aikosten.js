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

module.exports = (ctx) => {
  const { app, techAuth, eigenaarAlleen } = ctx;

  app.get('/api/techniek/ai/kosten', techAuth, eigenaarAlleen, (req, res) => {
    const stand = meter.stand();
    res.json({
      ...stand,
      /* De rem staat los van het dagplafond: de een begrenst een aanroeper, de
         ander de dag. Allebei tonen, anders lijkt "geen plafond" op "geen
         bescherming". */
      beurtenPerMinuut: meter.beurtGrens() || null
    });
  });
};
