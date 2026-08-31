/* De formele grenzen van de RTG Economic Runtime.

   Dit bestand verandert geen toestand. Het bevat uitsluitend de woorden die de
   runtime gebruikt, de controles op geld en de afgeleide levenscyclus. Domeinen
   mogen deze statussen lezen; alleen de runtime mag ze schrijven. */
'use strict';

const SCHEMA_VERSIE = 1;
const GELD_MIN = 1;
const GELD_MAX = 9_000_000_000_000;

const STATE = Object.freeze({
  intent: Object.freeze(['CREATED', 'ACTIVE', 'TERMINATED']),
  authorization: Object.freeze(['REQUESTED', 'AUTHORIZED', 'DECLINED', 'REVOKED']),
  commitment: Object.freeze(['NONE', 'PROPOSED', 'ACCEPTED', 'BREACHED', 'RELEASED']),
  fulfillment: Object.freeze(['NOT_STARTED', 'PARTIAL', 'COMPLETE', 'FAILED']),
  financial: Object.freeze(['NOT_DUE', 'DUE', 'AUTHORIZED', 'CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED']),
  allocation: Object.freeze(['NONE', 'PLANNED', 'LOCKED', 'COMPLETE', 'REVISED']),
  settlement: Object.freeze(['NOT_READY', 'READY', 'IN_PROGRESS', 'PARTIAL', 'SETTLED', 'FAILED']),
  reconciliation: Object.freeze(['UNRECONCILED', 'MATCHED', 'PARTIAL_MATCH', 'EXCEPTION']),
  evidence: Object.freeze(['INCOMPLETE', 'PARTIAL', 'COMPLETE', 'INVALIDATED']),
  recovery: Object.freeze(['NONE', 'REQUIRED', 'IN_PROGRESS', 'COMPLETE', 'FAILED'])
});

const CLAIM_STATUS = Object.freeze({
  HELD: 'HELD', PAYABLE: 'PAYABLE', SETTLEMENT_PENDING: 'SETTLEMENT_PENDING',
  SETTLED: 'SETTLED', SATISFIED: 'SATISFIED', CANCELLED: 'CANCELLED'
});
const SETTLEMENT_STATUS = Object.freeze({
  READY: 'READY', IN_PROGRESS: 'IN_PROGRESS', SETTLED: 'SETTLED',
  RECONCILED: 'RECONCILED', FAILED: 'FAILED', EXCEPTION: 'EXCEPTION'
});

function fout(code, error, status = 400, details) {
  const uit = { status, error, code };
  if (details) uit.details = details;
  return uit;
}

function geld(value, veld = 'value') {
  const amountMinor = Number(value && value.amountMinor);
  const currency = String((value && value.currency) || '').toUpperCase();
  if (!Number.isSafeInteger(amountMinor) || amountMinor < GELD_MIN || amountMinor > GELD_MAX)
    return fout('INVALID_AMOUNT', veld + '.amountMinor moet een positief veilig geheel getal zijn.');
  if (!/^[A-Z]{3}$/.test(currency))
    return fout('INVALID_CURRENCY', veld + '.currency moet een ISO-4217-code zijn.');
  return null;
}

/* Een referentie is bewust geen vrije tekst. Namen, IBANs en adressen horen in
   hun eigen verwijderbare kluis en nooit in de onveranderlijke economische
   feiten. De runtime bewaart alleen opaque identifiers. */
function ref(value, veld, verplicht = true) {
  const s = String(value || '');
  if (!s && !verplicht) return null;
  if (!/^[A-Za-z][A-Za-z0-9:_-]{1,119}$/.test(s))
    return fout('INVALID_REFERENCE', veld + ' moet een opaque referentie zijn; geen naam, IBAN of vrije tekst.');
  return null;
}

function plan(value, allocations) {
  const g = geld(value, 'requestedValue');
  if (g) return g;
  if (!Array.isArray(allocations) || !allocations.length)
    return fout('EMPTY_ALLOCATION', 'Een allocation plan heeft minimaal een component.');
  const ids = new Set();
  let som = 0;
  for (const a of allocations) {
    const idFout = ref(a && a.component, 'allocation.component');
    if (idFout) return idFout;
    const bFout = ref(a && a.beneficiaryRef, 'allocation.beneficiaryRef');
    if (bFout) return bFout;
    if (ids.has(a.component)) return fout('DUPLICATE_COMPONENT', 'Een allocation component komt dubbel voor: ' + a.component);
    ids.add(a.component);
    const c = Number(a.amountMinor);
    if (!Number.isSafeInteger(c) || c <= 0) return fout('INVALID_ALLOCATION_AMOUNT', 'Iedere allocation heeft een positief geheel bedrag.');
    if (String(a.currency || value.currency).toUpperCase() !== String(value.currency).toUpperCase())
      return fout('IMPLICIT_FX', 'Een allocation mag valuta niet impliciet converteren. Gebruik een expliciete conversion.');
    if (a.mode !== 'INTERNAL' && a.mode !== 'EXTERNAL')
      return fout('INVALID_SETTLEMENT_MODE', 'allocation.mode moet INTERNAL of EXTERNAL zijn.');
    if (a.mode === 'INTERNAL' && ref(a.ledgerAccount, 'allocation.ledgerAccount'))
      return ref(a.ledgerAccount, 'allocation.ledgerAccount');
    som += c;
  }
  if (som !== value.amountMinor)
    return fout('UNBALANCED_ALLOCATION', 'Allocation plan en requested value verschillen.', 409,
      { expectedMinor: value.amountMinor, allocatedMinor: som });
  return null;
}

function postings(lijst) {
  if (!Array.isArray(lijst) || lijst.length < 2)
    return fout('INVALID_POSTING_BUNDLE', 'Een ledger transaction heeft minimaal twee postings.');
  const perValuta = new Map();
  for (const p of lijst) {
    const r = ref(p && p.account, 'posting.account');
    if (r) return r;
    const c = Number(p && p.amountMinor);
    const currency = String((p && p.currency) || '').toUpperCase();
    if (!Number.isSafeInteger(c) || c === 0)
      return fout('INVALID_POSTING_AMOUNT', 'Een posting heeft een niet-nul geheel bedrag nodig.');
    if (!/^[A-Z]{3}$/.test(currency)) return fout('INVALID_CURRENCY', 'Een posting heeft een ISO-valuta nodig.');
    perValuta.set(currency, (perValuta.get(currency) || 0) + c);
  }
  for (const [currency, som] of perValuta) {
    if (som !== 0) return fout('UNBALANCED_LEDGER', 'Ledger transaction sluit niet voor ' + currency + '.', 409, { currency, differenceMinor: som });
  }
  return null;
}

function derive({ claims, settlements, heeftCaptureEvidence, recovery }) {
  const extern = claims.filter(c => c.mode === 'EXTERNAL' && c.status !== CLAIM_STATUS.CANCELLED);
  const standen = settlements.map(s => s.status);
  let settlement = 'NOT_READY';
  if (!extern.length || extern.every(c => c.status === CLAIM_STATUS.SETTLED || c.status === CLAIM_STATUS.SATISFIED)) settlement = 'SETTLED';
  else if (standen.includes(SETTLEMENT_STATUS.FAILED)) settlement = 'FAILED';
  else if (standen.includes(SETTLEMENT_STATUS.SETTLED) || standen.includes(SETTLEMENT_STATUS.RECONCILED)) settlement = 'PARTIAL';
  else if (standen.includes(SETTLEMENT_STATUS.IN_PROGRESS)) settlement = 'IN_PROGRESS';
  else if (standen.includes(SETTLEMENT_STATUS.READY)) settlement = 'READY';

  let reconciliation = extern.length ? 'UNRECONCILED' : 'MATCHED';
  if (standen.includes(SETTLEMENT_STATUS.EXCEPTION)) reconciliation = 'EXCEPTION';
  else if (extern.length && extern.every(c => settlements.some(s => s.claimId === c.id && s.status === SETTLEMENT_STATUS.RECONCILED))) reconciliation = 'MATCHED';
  else if (standen.includes(SETTLEMENT_STATUS.RECONCILED)) reconciliation = 'PARTIAL_MATCH';

  const bewijsVolledig = !!heeftCaptureEvidence && reconciliation === 'MATCHED';
  const evidence = bewijsVolledig ? 'COMPLETE' : (heeftCaptureEvidence ? 'PARTIAL' : 'INCOMPLETE');
  const recoveryState = recovery || 'NONE';
  let lifecycle = 'OPEN';
  if (recoveryState === 'REQUIRED' || recoveryState === 'FAILED') lifecycle = 'ATTENTION_REQUIRED';
  else if (reconciliation === 'EXCEPTION') lifecycle = 'EXCEPTION';
  else if (settlement === 'SETTLED' && evidence === 'COMPLETE') lifecycle = 'COMPLETED';
  return { settlement, reconciliation, evidence, recovery: recoveryState, lifecycle };
}

module.exports = { SCHEMA_VERSIE, STATE, CLAIM_STATUS, SETTLEMENT_STATUS, fout, geld, ref, plan, postings, derive };
