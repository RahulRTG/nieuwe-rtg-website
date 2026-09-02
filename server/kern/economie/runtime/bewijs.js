/* Het bewijsvenster van de Economic Runtime. Het produceert geen groen uit een
   interne aanname: PROVEN vereist een intacte fact chain, sluitende ledger,
   externe reconciliation en complete evidence. */
'use strict';

const { postings: toetsPostings } = require('./regels');

module.exports = function bewijsEngine(opslag, intentEngine) {
  const { sha, kopie, factLijst, pak, waarden } = opslag;

  function integriteit(intentId) {
    const intent = pak('intents', intentId);
    if (!intent) return { ok: false, errors: ['economic intent bestaat niet'] };
    const errors = [];
    let vorig = null, laatste = null, verwacht = 1;
    for (const f of factLijst(intentId)) {
      const body = kopie(f); delete body.hash;
      if (f.sequence !== verwacht) errors.push('fact sequence mist bij ' + f.id);
      if (f.previousHash !== vorig) errors.push('fact chain breekt bij ' + f.id);
      if (sha(body) !== f.hash) errors.push('fact hash wijkt af bij ' + f.id);
      verwacht++; vorig = f.hash; laatste = f.hash;
    }
    if ((intent.factCount || 0) !== verwacht - 1) errors.push('fact count wijkt af');
    if ((intent.lastFactHash || null) !== laatste) errors.push('laatste fact hash wijkt af');

    const txs = waarden('ledgerTransactions').filter(t => t.intentId === intentId);
    for (const tx of txs) {
      const body = kopie(tx); delete body.hash;
      const bezwaar = toetsPostings(tx.postings);
      if (bezwaar) errors.push('ledger sluit niet bij ' + tx.id + ': ' + bezwaar.code);
      if (sha(body) !== tx.hash) errors.push('ledger hash wijkt af bij ' + tx.id);
    }
    const evidence = waarden('evidence').filter(e => e.intentId === intentId);
    for (const ev of evidence) {
      const body = kopie(ev); delete body.hash;
      if (sha(body) !== ev.hash) errors.push('evidence hash wijkt af bij ' + ev.id);
    }
    const claims = waarden('claims').filter(c => c.intentId === intentId);
    const som = claims.reduce((n, c) => n + c.amountMinor, 0);
    if (som !== intent.requestedValue.amountMinor) errors.push('claims tellen niet op tot requested value');
    for (const claimId of intent.claimIds) if (!pak('claims', claimId)) errors.push('claim ontbreekt: ' + claimId);
    for (const settlementId of intent.settlementIds) if (!pak('settlements', settlementId)) errors.push('settlement ontbreekt: ' + settlementId);
    return { ok: errors.length === 0, errors, checked: {
      facts: verwacht - 1, ledgerTransactions: txs.length, evidence: evidence.length, claims: claims.length
    } };
  }

  function proof(intentId) {
    const intent = intentEngine.herbereken(intentId);
    if (!intent) return { status: 404, error: 'Economic intent bestaat niet.', code: 'INTENT_NOT_FOUND' };
    const integrity = integriteit(intentId);
    let status = 'PARTIALLY_PROVEN';
    if (!integrity.ok || intent.state.evidence === 'INVALIDATED') status = 'FAILED';
    else if (intent.state.reconciliation === 'EXCEPTION') status = 'DISPUTED';
    else if (intent.state.reconciliation !== 'MATCHED') status = 'NOT_RECONCILED';
    else if (intent.state.lifecycle === 'COMPLETED' && intent.state.evidence === 'COMPLETE') status = 'PROVEN';
    const claims = waarden('claims').filter(c => c.intentId === intentId).map(kopie);
    const settlements = waarden('settlements').filter(s => s.intentId === intentId).map(kopie);
    const evidence = waarden('evidence').filter(e => e.intentId === intentId).map(e => ({
      id: e.id, kind: e.kind, sourceRef: e.sourceRef, externalRef: e.externalRef,
      authenticity: e.authenticity, payloadHash: e.payloadHash, hash: e.hash, clock: kopie(e.clock)
    }));
    return { ok: true, status, intent: intentEngine.publiek(intent), claims, settlements,
      evidence, facts: factLijst(intentId).map(kopie), integrity };
  }

  function overzicht() {
    const intents = waarden('intents');
    const telling = { PROVEN: 0, PARTIALLY_PROVEN: 0, DISPUTED: 0, NOT_RECONCILED: 0, FAILED: 0 };
    let openClaimsMinor = 0, openCases = 0;
    for (const i of intents) { const p = proof(i.id); telling[p.status] = (telling[p.status] || 0) + 1; }
    for (const c of waarden('claims')) if (!['SETTLED', 'SATISFIED', 'CANCELLED'].includes(c.status)) openClaimsMinor += c.amountMinor;
    for (const c of waarden('cases')) if (c.status !== 'RESOLVED') openCases++;
    return { ok: true, intents: intents.length, telling, openClaimsMinor, openCases };
  }

  return { integriteit, proof, overzicht };
};
