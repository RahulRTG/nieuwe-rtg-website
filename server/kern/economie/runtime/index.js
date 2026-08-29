/* RTG Economic Runtime -- de enige eigenaar van de golden-path economische
   waarheid. Verticale domeinen leveren intenties en bevestigde feiten; deze
   runtime maakt commitments, claims, boekingen, settlements en bewijs. */
'use strict';

const regels = require('./regels');
const { maakOpslag } = require('./opslag');

function maakEconomicRuntime({ db, save, bijeen, inBundel, crypto, nu }) {
  if (!db || !db.data) throw new Error('economic runtime: db.data ontbreekt');
  if (typeof save !== 'function') throw new Error('economic runtime: save ontbreekt');
  if (!crypto || typeof crypto.createHash !== 'function') throw new Error('economic runtime: crypto ontbreekt');
  const opslag = maakOpslag({ db, save, crypto, nu });
  const intents = require('./intent')(opslag);
  const settlements = require('./settlement')(opslag, intents);
  const reconciliatie = require('./reconciliatie')(opslag, intents, settlements);
  const bewijs = require('./bewijs')(opslag, intents);

  const commit = async fn => {
    if (typeof inBundel === 'function' && inBundel()) return fn();
    if (typeof bijeen === 'function') return bijeen(async () => fn(), { duurzaam: true });
    return fn();
  };
  const schrijf = fn => async args => commit(() => fn(args || {}));

  function claimVoor(intentId, component) {
    return opslag.waarden('claims').find(c => c.intentId === intentId && c.component === component) || null;
  }
  function intent(intentId) {
    const i = intents.herbereken(String(intentId || ''));
    return i ? intents.publiek(i) : null;
  }

  return {
    registreerVerdeling: schrijf(intents.registreerVerdeling),
    planSettlement: schrijf(settlements.plan),
    markSettlementSubmitted: schrijf(settlements.ingediend),
    markSettlementConfirmed: schrijf(settlements.bevestigd),
    markSettlementFailed: schrijf(settlements.mislukt),
    reconcileSettlement: schrijf(reconciliatie.reconcile),
    intent, claimVoor, settlement: id => opslag.kopie(opslag.pak('settlements', id)),
    proof: bewijs.proof, integriteit: bewijs.integriteit, overzicht: bewijs.overzicht,
    openCases: reconciliatie.openCases,
    STATE: regels.STATE, CLAIM_STATUS: regels.CLAIM_STATUS,
    SETTLEMENT_STATUS: regels.SETTLEMENT_STATUS, SCHEMA_VERSIE: regels.SCHEMA_VERSIE
  };
}

module.exports = { maakEconomicRuntime };
