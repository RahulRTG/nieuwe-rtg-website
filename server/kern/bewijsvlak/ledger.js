/* Append-only bewijs. De ledger bewaart verklaringen en digests, geen kopie van
   de domeinpayload. Elke trust boundary heeft zijn eigen hashketen. */
'use strict';

const klok = require('../../lib/klok');
const { hash, id, kopie, bevries } = require('./canon');
const { verifieerLedger } = require('./ledger-verifier');
const { weigerLegacyLedgerinhoud } = require('./ledger-legacy');

const DEFAULT_LIMITS = Object.freeze({ records: 100000, evidence: 50000 });

function limiet(v, standaard, naam) {
  const n = v == null ? standaard : Number(v);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error('bewijsvlak ledger: ongeldige capaciteit ' + naam);
  return n;
}

function capaciteitFout(soort, maximum) {
  const fout = new Error('bewijsvlak ledger: capaciteit bereikt voor ' + soort +
    '; archiveer de immutable historie voordat nieuw bewijs wordt toegelaten');
  fout.code = 'EVIDENCE_CAPACITY_REACHED';
  fout.collection = soort;
  fout.limit = maximum;
  return fout;
}

function veiligeTekst(v, maximum) {
  if (v == null) return null;
  const s = String(v);
  return /^[a-zA-Z0-9:._-]+$/.test(s) && s.length <= (maximum || 180) ? s : null;
}

function veiligeRef(v) {
  if (!v) return null;
  if (typeof v === 'string') return veiligeTekst(v);
  if (typeof v !== 'object') return null;
  const uit = {}, idWaarde = veiligeTekst(v.id);
  if (idWaarde) uit.id = idWaarde;
  if (Number.isSafeInteger(Number(v.version)) && Number(v.version) > 0) uit.version = Number(v.version);
  if (/^[a-f0-9]{64}$/.test(String(v.digest || ''))) uit.digest = String(v.digest);
  return Object.keys(uit).length ? uit : null;
}

function evidenceRef(v) {
  const r = typeof v === 'string' ? { evidenceId: v } : (v || {});
  const evidenceId = veiligeTekst(r.evidenceId, 220);
  if (!evidenceId) throw new Error('bewijsvlak ledger: ongeldige evidence-ref');
  const uit = { evidenceId };
  if (/^[a-f0-9]{64}$/.test(String(r.digest || ''))) uit.digest = String(r.digest);
  return uit;
}

/* Alleen deze velden mogen terugleesbaar in de primaire ledger staan. De
   volledige metadata wordt wel door haar digest aan het bewijs gebonden, maar
   nooit als vrije payload opgeslagen. Subjecten worden uitsluitend als digest
   bewaard: een evidence-ref hoeft geen betaling, lid of reservering te noemen. */
function metadataBinding(metadata) {
  const m = kopie(metadata || {}), subject = m.subjectRef || m.domainRef || null;
  const capabilityRef = veiligeRef(m.capabilityRef || m.capability);
  const authorityRef = veiligeRef(m.authorityRef || m.authority);
  const publiek = {
    kind: veiligeTekst(m.kind), classification: veiligeTekst(m.classification),
    purpose: veiligeTekst(m.purpose), capabilityRef,
    subjectRefDigest: hash(subject), authorityRefDigest: hash(m.authorityRef || m.authority || null),
    metadataDigest: hash(m)
  };
  return bevries({ publiek: Object.fromEntries(Object.entries(publiek).filter(([, v]) => v != null)),
    idBinding: { subjectRefDigest: publiek.subjectRefDigest, capabilityRef,
      authorityRefDigest: publiek.authorityRefDigest, metadataDigest: publiek.metadataDigest } });
}

function maakLedger(opties) {
  const o = opties || {};
  const vasteRegels = o.regels || [], vasteBlobs = o.blobs || {};
  const regels = () => typeof o.regelsFor === 'function' ? o.regelsFor() : vasteRegels;
  const blobs = () => typeof o.blobsFor === 'function' ? o.blobsFor() : vasteBlobs;
  const limits = Object.freeze({ records: limiet(o.limits && o.limits.records, DEFAULT_LIMITS.records, 'records'),
    evidence: limiet(o.limits && o.limits.evidence, DEFAULT_LIMITS.evidence, 'evidence') });
  const nu = o.nu || (() => klok.datum().toISOString());
  const save = typeof o.save === 'function' ? o.save : () => {};
  const transaction = o.transaction || null;
  const heeftBlob = sleutel => blobs() instanceof Map
    ? blobs().has(sleutel) : Object.prototype.hasOwnProperty.call(blobs(), sleutel);
  const zetBlob = (sleutel, waarde) => blobs() instanceof Map
    ? blobs().set(sleutel, waarde) : (blobs()[sleutel] = waarde);
  const haalBlob = sleutel => blobs() instanceof Map ? blobs().get(sleutel) : blobs()[sleutel];
  const blobAantal = () => blobs() instanceof Map ? blobs().size : Object.keys(blobs()).length;

  if (regels().length > limits.records) throw capaciteitFout('records', limits.records);
  if (blobAantal() > limits.evidence) throw capaciteitFout('evidence', limits.evidence);
  weigerLegacyLedgerinhoud(blobs());

  function laatsteLedgerregel(boundary) {
    if (transaction) {
      const gepland = transaction.pending(op => op.type === 'ledger-append' &&
        op.record.boundary === boundary);
      if (gepland.length) return gepland[gepland.length - 1].record;
    }
    const lijst = regels();
    for (let i = lijst.length - 1; i >= 0; i--) if (lijst[i].boundary === boundary) return lijst[i];
    return null;
  }

  function bewijs(inhoud, metadata) {
    if (transaction && transaction.active()) {
      const error = new Error('bewijsvlak ledger: V2-blobbewijs mag niet midden in een V3-transactie schrijven');
      error.code = 'MIXED_EVIDENCE_TRANSACTION';
      throw error;
    }
    const digest = hash(inhoud);
    const binding = metadataBinding(metadata);
    const evidenceId = 'evidence_' + hash({ contentDigest: digest, ...binding.idBinding });
    if (!heeftBlob(evidenceId)) {
      if (blobAantal() >= limits.evidence) throw capaciteitFout('evidence', limits.evidence);
      zetBlob(evidenceId, bevries({ schemaVersion: 2, evidenceId,
        digest, contentDigest: digest, metadata: binding.publiek }));
      save();
    }
    return bevries({ evidenceId, digest });
  }

  function generatie(invoer) {
    const g = { inputs: (invoer && invoer.inputs || []).slice().sort(),
      contracts: (invoer && invoer.contracts || []).slice().sort(),
      environment: (invoer && invoer.environment) || 'runtime', at: nu() };
    return bevries({ generationId: id('gen', g), ...g });
  }

  function append(invoer) {
    const i = kopie(invoer || {});
    if (!i.boundary || !/^[a-zA-Z0-9:._-]{1,180}$/.test(i.boundary))
      throw new Error('bewijsvlak ledger: boundary ontbreekt of is ongeldig');
    const pendingCount = transaction ? transaction.pending(op => op.type === 'ledger-append').length : 0;
    const lijst = regels();
    if (lijst.length + pendingCount >= limits.records) throw capaciteitFout('records', limits.records);
    const vorige = laatsteLedgerregel(i.boundary);
    const body = {
      evidenceRecordId: i.evidenceRecordId || id('record', { boundary: i.boundary, at: nu(),
        n: lijst.length + pendingCount, claim: i.claimId }),
      boundary: i.boundary,
      at: i.at || nu(),
      chainId: i.chainId || null,
      stepId: i.stepId || null,
      claimId: i.claimId || null,
      generationId: i.generationId || null,
      kind: i.kind || 'observation',
      decision: i.decision || null,
      reasonCodes: Array.isArray(i.reasonCodes) ? i.reasonCodes.map(x => String(x).slice(0, 180)) : [],
      evidenceRefs: Array.isArray(i.evidenceRefs) ? i.evidenceRefs.map(evidenceRef) : [],
      contractRef: veiligeRef(i.contractRef),
      policyRef: veiligeRef(i.policyRef),
      inputHash: i.inputHash || null,
      previousHash: vorige ? vorige.hash : null
    };
    body.hash = hash(body);
    const vast = bevries(body);
    if (transaction && transaction.active()) {
      transaction.stage({ type: 'ledger-append', key: 'ledger:' + vast.evidenceRecordId,
        record: vast,
        validate() {
          if (lijst.length >= limits.records) throw capaciteitFout('records', limits.records);
        },
        apply() {
          const huidig = laatsteZonderTransactie(lijst, vast.boundary);
          if ((huidig ? huidig.hash : null) !== vast.previousHash)
            throw new Error('bewijsvlak ledger: gelijktijdige ketenwijziging');
          lijst.push(vast);
        },
        rollback() {
          const laatsteRegel = lijst[lijst.length - 1];
          if (laatsteRegel && laatsteRegel.hash === vast.hash) lijst.pop();
        }
      });
      return vast;
    }
    lijst.push(vast);
    try { save(); }
    catch (error) { if (lijst[lijst.length - 1] === vast) lijst.pop(); throw error; }
    return vast;
  }

  function laatsteZonderTransactie(lijst, boundary) {
    for (let i = lijst.length - 1; i >= 0; i--) if (lijst[i].boundary === boundary) return lijst[i];
    return null;
  }

  function verifyLedger(boundary) {
    return verifieerLedger(regels(), boundary);
  }

  function lijst(filter) {
    const f = filter || {};
    return regels().filter(r => (!f.boundary || r.boundary === f.boundary) &&
      (!f.chainId || r.chainId === f.chainId) && (!f.claimId || r.claimId === f.claimId))
      .slice(-(f.limit || 100)).map(kopie);
  }

  return Object.freeze({ bewijs, generatie, append, verify: verifyLedger, lijst,
    capacity: () => bevries({ records: { used: regels().length, limit: limits.records },
      evidence: { used: blobAantal(), limit: limits.evidence } }),
    haalBewijs: evidenceId => heeftBlob(evidenceId) ? kopie(haalBlob(evidenceId)) : null });
}

module.exports = { DEFAULT_LIMITS, maakLedger };
