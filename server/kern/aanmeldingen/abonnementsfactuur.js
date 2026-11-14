/* Eén eigen, canonieke termijnfactuur. Zowel vóór de contractcommit als
   binnen de laatste accountmutatie: een eerdere snapshot overleeft geen await. */
'use strict';
const { factuur } = require('./abonnementstermijn');
const { canon } = require('./abonnementsaanbod-vorm');
module.exports = function eigenTermijnfactuur(md, contract, termijn) {
  const rijen = (Array.isArray(md?.invoices) ? md.invoices : []).filter(i => i?.id === termijn.invoiceId);
  const i = rijen[0], verwacht = factuur(contract, termijn);
  const velden = Object.keys(verwacht.abonnement).filter(k => k !== 'van' && k !== 'tot');
  if (rijen.length !== 1 || !i.abonnement || velden.some(k => i.abonnement[k] !== verwacht.abonnement[k]) ||
      i.bijdrage !== verwacht.bijdrage || i.btwProfiel !== verwacht.btwProfiel ||
      canon(i.btwOpbouw) !== canon(verwacht.btwOpbouw) || !['open', 'paid'].includes(i.status) ||
      i.verrekend && (termijn.brutoCenten !== 0 || i.verrekend.contractId !== contract.id ||
        i.verrekend.creditCenten !== termijn.creditCenten))
    throw Error('De eigen termijnfactuur wijkt af van het getekende contract en de verrekening.');
  return i;
};
module.exports.eisBetaald = function eisBetaald(i, termijn, w) {
  if (!w || w.status !== 'BEVESTIGD' || w.terugbetaaldCenten !== 0 || i.status !== 'paid' ||
      !i.betaalBewijzen?.some(b => b.id === w.id && b.centen === termijn.brutoCenten))
    throw Error('Het actuele factuur- of betaalbewijs is gewijzigd vóór afronden.');
};
