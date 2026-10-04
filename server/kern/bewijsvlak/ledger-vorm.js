/* De zuivere vorm onder ./ledger.js: capaciteitsgrenzen, veilige
   verwijzingen en de binding van metadata aan een digest. Afgesplitst omdat
   de ledger over de omvanggrens ging; hier staat geen opslag en geen keten. */
'use strict';

const { hash, kopie, bevries } = require('./canon');

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

module.exports = { DEFAULT_LIMITS, limiet, capaciteitFout, veiligeTekst, veiligeRef, evidenceRef, metadataBinding };
