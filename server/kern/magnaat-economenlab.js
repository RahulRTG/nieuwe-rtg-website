/* Magnaat Economenlab.

   Deze laag leest het bestaande dubbel geboekte grootboek en koppelt
   economische analyse aan de echte simulatie-uitkomst. Rapportage en
   training zijn gescheiden gehouden zodat iedere regel controleerbaar blijft. */
'use strict';

const basis = require('./magnaat-economenlab-basis');
const rapport = require('./magnaat-economenlab-rapport');
const training = require('./magnaat-economenlab-training');

module.exports = {
  rapport: rapport.rapport,
  dienAnalyse: training.dienAnalyse,
  verwerkDag: training.verwerkDag,
  resultatenrekening: rapport.resultatenrekening,
  balans: rapport.balans,
  kasstroom: rapport.kasstroom,
  kengetallen: rapport.kengetallen,
  diagnose: rapport.diagnose,
  _zorgStaat: basis.zorgStaat
};
