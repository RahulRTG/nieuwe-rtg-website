/* De enige runtime-ingang voor extern geld: plannen, aanbieden, bevestigen,
   afstemmen en herstellen. Een railmelding wijzigt nooit zelf claims of ledger;
   zij wordt hier eerst als gecontroleerd feit verwerkt. */
'use strict';

const { CLAIM_STATUS, SETTLEMENT_STATUS, fout, ref } = require('./regels');

module.exports = function settlementEngine(opslag, intentEngine) {
  const { tijd, sha, id, kopie, fact, ledger, bewijs, pak, zet } = opslag;

  function zoek(settlementId) {
    const s = pak('settlements', String(settlementId || ''));
    return s || fout('SETTLEMENT_NOT_FOUND', 'Settlement bestaat niet.', 404);
  }

  function plan({ intentId, claimId, destinationRef, rail = 'SEPA', idempotencyKey, recoveryCaseId }) {
    const intent = pak('intents', intentId);
    const claim = pak('claims', claimId);
    if (!intent || !claim || claim.intentId !== intentId)
      return fout('CLAIM_NOT_FOUND', 'Claim hoort niet bij deze economic intent.', 404);
    if (claim.mode !== 'EXTERNAL') return fout('NOT_EXTERNALLY_SETTLEABLE', 'Een interne claim gaat niet naar een betaalrail.', 409);
    const dFout = ref(destinationRef, 'destinationRef'); if (dFout) return dFout;
    if (!/^[A-Za-z0-9:_-]{8,180}$/.test(String(idempotencyKey || '')))
      return fout('INVALID_IDEMPOTENCY_KEY', 'Settlement heeft een duurzame idempotency key nodig.');
    if (claim.status === CLAIM_STATUS.SETTLED || claim.status === CLAIM_STATUS.SATISFIED)
      return fout('CLAIM_ALREADY_SETTLED', 'Deze claim is al voldaan.', 409);
    const recoveryCase = recoveryCaseId ? pak('cases', recoveryCaseId) : null;
    if (recoveryCaseId && (!recoveryCase || recoveryCase.intentId !== intentId))
      return fout('RECOVERY_CASE_NOT_FOUND', 'Recovery case hoort niet bij deze intent.', 404);
    const settlementId = id('ES', intentId + ':' + idempotencyKey);
    const fingerprint = sha({ intentId, claimId, destinationRef, rail, amountMinor: claim.amountMinor, currency: claim.currency });
    const bestaand = pak('settlements', settlementId);
    if (bestaand) return bestaand.fingerprint === fingerprint
      ? { ok: true, replay: true, settlement: kopie(bestaand) }
      : fout('IDEMPOTENCY_CONFLICT', 'Settlement-key is al voor andere parameters gebruikt.', 409,
        { settlementId: bestaand.id });
    const now = tijd();
    const s = {
      id: settlementId, intentId, claimId, amountMinor: claim.amountMinor, currency: claim.currency,
      destinationRef, rail: String(rail), status: SETTLEMENT_STATUS.READY,
      fingerprint, attempt: claim.settlementIds.length + 1, operationId: null, providerRef: null,
      evidenceIds: [], ledgerTransactionId: null, recoveryCaseId: recoveryCaseId || null,
      createdAt: now, submittedAt: null, settledAt: null, reconciledAt: null, failedAt: null,
      lastError: null
    };
    zet('settlements', settlementId, s);
    claim.destinationRef = destinationRef;
    claim.status = CLAIM_STATUS.SETTLEMENT_PENDING;
    claim.settlementIds.push(settlementId);
    zet('claims', claim.id, claim);
    intent.settlementIds.push(settlementId);
    fact(intentId, 'SettlementPlanned', { settlementId, claimId, destinationRef, rail: s.rail,
      amountMinor: s.amountMinor, currency: s.currency, attempt: s.attempt }, 'settlement-planned:' + settlementId);
    if (recoveryCaseId) {
      const c = recoveryCase;
      c.status = 'IN_PROGRESS'; c.recoverySettlementId = settlementId; c.updatedAt = now; zet('cases', c.id, c);
      intent.state.recovery = 'IN_PROGRESS';
      fact(intentId, 'RecoveryStarted', { caseId: c.id, settlementId }, 'recovery-started:' + settlementId);
    }
    intentEngine.herbereken(intentId); zet('intents', intentId, intent);
    return { ok: true, replay: false, settlement: kopie(s) };
  }

  function ingediend({ settlementId, operationId, providerRef }) {
    const s = zoek(settlementId); if (s.error) return s;
    if (s.status === SETTLEMENT_STATUS.RECONCILED || s.status === SETTLEMENT_STATUS.SETTLED)
      return { ok: true, replay: true, settlement: kopie(s) };
    if (s.status === SETTLEMENT_STATUS.FAILED || s.status === SETTLEMENT_STATUS.EXCEPTION)
      return fout('INVALID_SETTLEMENT_TRANSITION', 'Een mislukte settlement moet via recovery opnieuw worden gepland.', 409);
    if (operationId) s.operationId = String(operationId);
    if (providerRef) s.providerRef = String(providerRef);
    if (s.status !== SETTLEMENT_STATUS.IN_PROGRESS) {
      s.status = SETTLEMENT_STATUS.IN_PROGRESS; s.submittedAt = tijd();
      fact(s.intentId, 'SettlementSubmitted', { settlementId: s.id, operationId: s.operationId,
        providerRef: s.providerRef }, 'settlement-submitted:' + s.id);
    }
    zet('settlements', s.id, s); intentEngine.herbereken(s.intentId);
    return { ok: true, settlement: kopie(s) };
  }

  function bevestigd({ settlementId, operationId, providerRef, sourceRef = 'provider:payout', occurredAt }) {
    const s = zoek(settlementId); if (s.error) return s;
    if (s.status === SETTLEMENT_STATUS.RECONCILED || s.status === SETTLEMENT_STATUS.SETTLED)
      return { ok: true, replay: true, settlement: kopie(s) };
    if (s.status === SETTLEMENT_STATUS.FAILED || s.status === SETTLEMENT_STATUS.EXCEPTION)
      return fout('INVALID_SETTLEMENT_TRANSITION', 'Mislukte settlement kan niet alsnog stil bevestigd worden.', 409);
    if (operationId) s.operationId = String(operationId);
    if (providerRef) s.providerRef = String(providerRef);
    if (!s.providerRef) return fout('MISSING_PROVIDER_REFERENCE', 'Externe bevestiging zonder providerreferentie is geen bewijs.', 409);
    const claim = pak('claims', s.claimId);
    const tx = ledger(s.intentId, 'EXTERNAL_SETTLEMENT', s.id, [
      { account: 'liability:claim:' + claim.id, amountMinor: s.amountMinor, currency: s.currency },
      { account: 'asset:provider-clearing', amountMinor: -s.amountMinor, currency: s.currency }
    ], { claimId: claim.id, settlementId: s.id, providerRef: s.providerRef },
    { occurredAt, observedAt: occurredAt, settledAt: occurredAt || tijd() });
    if (tx.error) return tx;
    const ev = bewijs(s.intentId, 'SETTLEMENT_CONFIRMATION', s.providerRef, {
      sourceRef, externalRef: s.providerRef, authenticity: 'PROVIDER_ASSERTED',
      payload: { settlementId: s.id, amountMinor: s.amountMinor, currency: s.currency }
    }, { occurredAt, observedAt: occurredAt, settledAt: occurredAt || tijd() });
    s.status = SETTLEMENT_STATUS.SETTLED; s.settledAt = occurredAt || tijd();
    s.ledgerTransactionId = tx.id; s.evidenceIds.push(ev.id); s.lastError = null;
    claim.status = CLAIM_STATUS.SETTLED; claim.settledAt = s.settledAt;
    zet('claims', claim.id, claim); zet('settlements', s.id, s);
    const intent = pak('intents', s.intentId);
    if (!intent.ledgerTransactionIds.includes(tx.id)) intent.ledgerTransactionIds.push(tx.id);
    if (!intent.evidenceIds.includes(ev.id)) intent.evidenceIds.push(ev.id);
    fact(s.intentId, 'SettlementConfirmed', { settlementId: s.id, claimId: claim.id,
      providerRef: s.providerRef, ledgerTransactionId: tx.id, evidenceId: ev.id }, 'settlement-confirmed:' + s.id);
    intentEngine.herbereken(s.intentId); zet('intents', intent.id, intent);
    return { ok: true, settlement: kopie(s) };
  }

  function settlementMislukt({ settlementId, reason, operationId, retryable = true }) {
    const s = zoek(settlementId); if (s.error) return s;
    if (s.status === SETTLEMENT_STATUS.RECONCILED) return fout('SETTLEMENT_ALREADY_RECONCILED', 'Een gereconcilieerde settlement kan niet mislukken.', 409);
    if (s.status === SETTLEMENT_STATUS.FAILED)
      return { ok: true, replay: true, settlement: kopie(s), case: kopie(pak('cases', s.recoveryCaseId)) };
    s.status = SETTLEMENT_STATUS.FAILED; s.failedAt = tijd(); s.lastError = String(reason || 'rail failure').slice(0, 300);
    if (operationId) s.operationId = String(operationId);
    const claim = pak('claims', s.claimId); claim.status = retryable ? CLAIM_STATUS.PAYABLE : CLAIM_STATUS.HELD;
    const caseId = id('CA', s.intentId + ':settlement-failed:' + s.id);
    const c = { id: caseId, intentId: s.intentId, kind: 'SETTLEMENT_FAILURE', status: 'OPEN',
      settlementId: s.id, claimId: s.claimId, reason: s.lastError, retryable: !!retryable,
      createdAt: tijd(), updatedAt: tijd(), recoverySettlementId: null, resolvedAt: null };
    s.recoveryCaseId = caseId;
    zet('claims', claim.id, claim); zet('settlements', s.id, s); zet('cases', caseId, c);
    const intent = pak('intents', s.intentId); intent.state.recovery = 'REQUIRED';
    if (!intent.caseIds.includes(caseId)) intent.caseIds.push(caseId);
    fact(s.intentId, 'SettlementFailed', { settlementId: s.id, claimId: claim.id,
      caseId, retryable: !!retryable, reason: s.lastError }, 'settlement-failed:' + s.id);
    intentEngine.herbereken(s.intentId); zet('intents', intent.id, intent);
    return { ok: true, settlement: kopie(s), case: kopie(c) };
  }

  return { plan, ingediend, bevestigd, mislukt: settlementMislukt, zoek };
};
