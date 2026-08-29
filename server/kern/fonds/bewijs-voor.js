/* Persoonlijke read projection over Economic Proof. De runtime blijft eigenaar;
   dit venster filtert eerst op de opaque principalRef en geeft daarna alleen
   uitlegbare status, componenten en integriteitsmetadata terug. */
'use strict';

module.exports = function maakBewijsVoor({ db, runtime, actorRef }) {
  function verzamel(principal, limiet) {
    if (!/^[A-Za-z][A-Za-z0-9:_-]{1,119}$/.test(String(principal || '')))
      return { ok: false, proofs: [], error: 'Ongeldige economic principal reference.' };
    const intents = Object.values((db.data.economischeRuntime || {}).intents || {})
      .filter(i => i.principalRef === principal)
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .slice(0, Math.min(25, Math.max(1, Number(limiet) || 6)));
    const proofs = intents.map(intent => {
      const p = runtime.proof(intent.id);
      if (!p || p.error) return null;
      return {
        intentId: intent.id, purpose: intent.purpose, status: p.status,
        requestedValue: intent.requestedValue,
        lifecycle: intent.state.lifecycle, settlement: intent.state.settlement,
        reconciliation: intent.state.reconciliation, evidence: intent.state.evidence,
        components: p.claims.map(c => ({ component: c.component, amountMinor: c.amountMinor,
          currency: c.currency, status: c.status, mode: c.mode })),
        proof: { integrity: p.integrity.ok, facts: p.integrity.checked.facts,
          ledgerTransactions: p.integrity.checked.ledgerTransactions,
          evidenceItems: p.integrity.checked.evidence, lastFactHash: intent.lastFactHash || null },
        createdAt: intent.createdAt, updatedAt: intent.updatedAt
      };
    }).filter(Boolean);
    return { ok: true, principalRef: principal, proofs };
  }
  return {
    bewijzenVoor: (wie, limiet) => verzamel(actorRef(wie), limiet),
    bewijzenVoorRef: (principalRef, limiet) => verzamel(String(principalRef || ''), limiet)
  };
};
