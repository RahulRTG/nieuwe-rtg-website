/* Opslagprimitives voor de Economic Runtime.

   De runtime bezit één wortelcollectie. Daarbinnen zijn facts, ledger
   transactions en evidence append-only kaarten met deterministische sleutels.
   Deterministische ids maken een retry en twee processen die dezelfde
   economische handeling zien convergent: ze maken niet twee objecten. */
'use strict';
/* `rtgKlok` en niet `klok`: dit bestand gebruikt de naam `klok` al voor iets
   anders, en een import die daardoor wordt overschaduwd geeft geen foutmelding
   bij het laden maar pas als de regel wordt uitgevoerd -- hier was dat
   `klok.nu is not a function`, midden in de economische runtime. */
const rtgKlok = require('../../../lib/klok');

const { SCHEMA_VERSIE, postings: toetsPostings } = require('./regels');
const { veiligGelijk } = require('../../util');

const VAKKEN = ['intents', 'commitments', 'obligations', 'claims', 'facts',
  'ledgerTransactions', 'settlements', 'evidence', 'cases', 'idempotency'];

function canon(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canon).join(',') + ']';
  return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined)
    .map(k => JSON.stringify(k) + ':' + canon(value[k])).join(',') + '}';
}

function kopie(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

function hashInvoer(value) {
  switch (typeof value) {
    case 'string': return value;
    default: return canon(value);
  }
}

function maakOpslag({ db, save, crypto, nu }) {
  const eigen = require('../../eigencollectie')({ db, domein: 'kern/economie/runtime',
    bezit: { economischeRuntime: 'kaart' } });
  const tijd = typeof nu === 'function' ? nu : () => rtgKlok.nu();
  const sha = value => crypto.createHash('sha256').update(hashInvoer(value)).digest('hex');
  const id = (prefix, sleutel) => prefix + sha(String(sleutel)).slice(0, 24).toUpperCase();

  function economischeWortel() {
    const r = eigen.bak('economischeRuntime');
    if (!r.schemaVersion) r.schemaVersion = SCHEMA_VERSIE;
    if (r.schemaVersion !== SCHEMA_VERSIE)
      throw new Error('economic runtime: onbekende opslagversie ' + r.schemaVersion);
    for (const vak of VAKKEN) if (!r[vak] || typeof r[vak] !== 'object' || Array.isArray(r[vak])) r[vak] = {};
    return r;
  }

  function klok(input, extra) {
    const t = Number(input && input.recordedAt) || tijd();
    return Object.assign({
      occurredAt: Number(input && input.occurredAt) || t,
      observedAt: Number(input && input.observedAt) || t,
      recordedAt: t,
      effectiveAt: Number(input && input.effectiveAt) || t,
      bookedAt: null, settledAt: null, reconciledAt: null
    }, extra || {});
  }

  function idem(sleutel, fingerprint, intentId) {
    const k = String(sleutel || '');
    const r = economischeWortel();
    const bestaand = r.idempotency[k];
    if (bestaand) return veiligGelijk(bestaand.fingerprint, fingerprint)
      ? { replay: true, intentId: bestaand.intentId }
      : { conflict: true, intentId: bestaand.intentId };
    r.idempotency[k] = { fingerprint, intentId, at: tijd() };
    save();
    return { replay: false, intentId };
  }

  function fact(intentId, type, payload, sleutel, clock) {
    const r = economischeWortel();
    const intent = r.intents[intentId];
    if (!intent) throw new Error('Fact zonder economic intent: ' + intentId);
    const factId = id('EF', intentId + ':' + sleutel);
    if (r.facts[factId]) return r.facts[factId];
    const body = {
      id: factId, schemaVersion: SCHEMA_VERSIE, intentId,
      sequence: (intent.factCount || 0) + 1, type: String(type),
      clock: klok(clock), payload: kopie(payload || {}),
      previousHash: intent.lastFactHash || null
    };
    body.hash = sha(body);
    r.facts[factId] = body;
    intent.factCount = body.sequence;
    intent.lastFactHash = body.hash;
    intent.updatedAt = body.clock.recordedAt;
    save();
    return body;
  }

  function ledger(intentId, kind, key, lijst, refs, clock) {
    const bezwaar = toetsPostings(lijst);
    if (bezwaar) return bezwaar;
    const r = economischeWortel();
    const txId = id('EL', intentId + ':' + kind + ':' + key);
    if (r.ledgerTransactions[txId]) return r.ledgerTransactions[txId];
    const body = {
      id: txId, schemaVersion: SCHEMA_VERSIE, intentId, kind,
      postings: kopie(lijst), refs: kopie(refs || {}), clock: klok(clock, { bookedAt: tijd() })
    };
    body.hash = sha(body);
    r.ledgerTransactions[txId] = body;
    fact(intentId, 'LedgerTransactionPosted', { ledgerTransactionId: txId, kind }, 'ledger:' + txId, body.clock);
    return body;
  }

  /* Evidence bewaart geen bankafschrift of persoonsgegevens. Het bewaart de
     herkomst, de authenticiteitsklasse en de hash van het bronmateriaal; het
     document zelf blijft in de bewijs-/documentkluis. */
  function bewaarEconomicBewijs(intentId, kind, key, input, clock) {
    const r = economischeWortel();
    const evidenceId = id('EV', intentId + ':' + kind + ':' + key);
    if (r.evidence[evidenceId]) return r.evidence[evidenceId];
    const body = {
      id: evidenceId, schemaVersion: SCHEMA_VERSIE, intentId, kind,
      sourceRef: input.sourceRef || null,
      externalRef: input.externalRef || null,
      authenticity: input.authenticity || 'UNVERIFIED',
      payloadHash: input.payloadHash || sha(input.payload || {}),
      clock: klok(clock || input.clock)
    };
    body.hash = sha(body);
    r.evidence[evidenceId] = body;
    fact(intentId, 'EvidenceAttached', { evidenceId, kind, authenticity: body.authenticity },
      'evidence:' + evidenceId, body.clock);
    return body;
  }

  function factLijst(intentId) {
    return Object.values(economischeWortel().facts).filter(f => f.intentId === intentId)
      .sort((a, b) => a.sequence - b.sequence);
  }
  const pak = (vak, objectId) => economischeWortel()[vak][objectId] || null;
  const zet = (vak, objectId, waarde) => { economischeWortel()[vak][objectId] = waarde; save(); return waarde; };
  const waarden = vak => Object.values(economischeWortel()[vak]);

  return { wortel: economischeWortel, tijd, sha, id, canon, kopie, klok, idem, fact,
    ledger, bewijs: bewaarEconomicBewijs, factLijst, pak, zet, waarden };
}

module.exports = { maakOpslag, canon, kopie };
