/* Reconciliation vergelijkt verwachte settlement met een geauthenticeerde
   externe bron. Een mismatch wordt een Economic Case; nooit een afronding of
   stil gecorrigeerd bedrag. */
'use strict';

const { SETTLEMENT_STATUS, fout, ref } = require('./regels');

module.exports = function reconciliatieEngine(opslag, intentEngine, settlements) {
  const { tijd, sha, id, kopie, fact, bewijs, pak, zet, waarden } = opslag;

  function reconcile({ settlementId, externalEntryRef, amountMinor, currency, sourceRef,
    authenticity, relatedSettlementRef, runtimeSettlementId, observedAt, payloadHash }) {
    const s = settlements.zoek(settlementId); if (s.error) return s;
    if (s.status === SETTLEMENT_STATUS.RECONCILED)
      return { ok: true, replay: true, matched: true, settlement: kopie(s) };
    if (s.status !== SETTLEMENT_STATUS.SETTLED)
      return fout('SETTLEMENT_NOT_CONFIRMED', 'Alleen extern bevestigde settlements kunnen worden gereconcilieerd.', 409);
    if (!['DIRECT_API', 'CRYPTOGRAPHIC'].includes(authenticity))
      return fout('UNTRUSTED_EVIDENCE', 'Reconciliation vereist bewijs uit een geauthenticeerde directe bron.', 403);
    const bronFout = ref(sourceRef, 'sourceRef'); if (bronFout) return bronFout;
    if (!String(externalEntryRef || '').trim())
      return fout('MISSING_EXTERNAL_ENTRY', 'Bank- of PSP-regelreferentie ontbreekt.');
    const bedragKlopt = Number.isSafeInteger(Number(amountMinor)) && Number(amountMinor) === s.amountMinor;
    const valutaKlopt = String(currency || '').toUpperCase() === s.currency;
    const refKlopt = (s.providerRef && relatedSettlementRef === s.providerRef) || runtimeSettlementId === s.id;
    const matched = bedragKlopt && valutaKlopt && refKlopt;
    const ev = bewijs(s.intentId, 'BANK_STATEMENT', String(externalEntryRef), {
      sourceRef, externalRef: String(externalEntryRef), authenticity,
      payloadHash: payloadHash || sha({ externalEntryRef, amountMinor, currency, relatedSettlementRef, runtimeSettlementId })
    }, { occurredAt: observedAt, observedAt, reconciledAt: tijd() });
    if (matched) return legMatchVast(s, ev, externalEntryRef);
    return legAfwijkingVast(s, ev, { externalEntryRef, amountMinor, currency, relatedSettlementRef });
  }

  function legMatchVast(s, ev, externalEntryRef) {
    s.status = SETTLEMENT_STATUS.RECONCILED; s.reconciledAt = tijd(); s.evidenceIds.push(ev.id);
    const intent = pak('intents', s.intentId);
    if (!intent.evidenceIds.includes(ev.id)) intent.evidenceIds.push(ev.id);
    if (s.recoveryCaseId) {
      const c = pak('cases', s.recoveryCaseId);
      if (c) { c.status = 'RESOLVED'; c.resolvedAt = tijd(); c.updatedAt = tijd(); zet('cases', c.id, c); }
    }
    const open = intent.caseIds.map(x => pak('cases', x)).filter(c => c && c.status !== 'RESOLVED');
    if (!open.length && intent.caseIds.length) intent.state.recovery = 'COMPLETE';
    fact(s.intentId, 'ReconciliationMatched', { settlementId: s.id, evidenceId: ev.id,
      externalEntryRef }, 'reconciliation:' + s.id + ':' + externalEntryRef);
    zet('settlements', s.id, s); intentEngine.herbereken(s.intentId); zet('intents', intent.id, intent);
    return { ok: true, matched: true, settlement: kopie(s), evidence: kopie(ev) };
  }

  function legAfwijkingVast(s, ev, gezien) {
    s.status = SETTLEMENT_STATUS.EXCEPTION; s.evidenceIds.push(ev.id);
    const caseId = id('CA', s.intentId + ':reconciliation:' + gezien.externalEntryRef);
    const c = { id: caseId, intentId: s.intentId, kind: 'RECONCILIATION_MISMATCH', status: 'OPEN',
      settlementId: s.id, claimId: s.claimId,
      expected: { amountMinor: s.amountMinor, currency: s.currency, providerRef: s.providerRef },
      observed: { amountMinor: Number(gezien.amountMinor), currency: String(gezien.currency || '').toUpperCase(),
        relatedSettlementRef: gezien.relatedSettlementRef },
      createdAt: tijd(), updatedAt: tijd(), resolvedAt: null };
    zet('settlements', s.id, s); zet('cases', caseId, c);
    const intent = pak('intents', s.intentId); intent.state.recovery = 'REQUIRED';
    if (!intent.caseIds.includes(caseId)) intent.caseIds.push(caseId);
    if (!intent.evidenceIds.includes(ev.id)) intent.evidenceIds.push(ev.id);
    fact(s.intentId, 'ReconciliationMismatchDetected', { settlementId: s.id, caseId,
      evidenceId: ev.id, expected: c.expected, observed: c.observed }, 'reconciliation-mismatch:' + gezien.externalEntryRef);
    intentEngine.herbereken(s.intentId); zet('intents', intent.id, intent);
    return { ok: true, matched: false, exception: kopie(c), settlement: kopie(s) };
  }

  function openCases(intentId) {
    return waarden('cases').filter(c => (!intentId || c.intentId === intentId) && c.status !== 'RESOLVED').map(kopie);
  }

  return { reconcile, openCases };
};
