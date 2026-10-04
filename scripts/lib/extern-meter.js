/* Een externe meting is pas bewijs als de meetdienst exact de releasecommit en
   de unieke proef-ID terugtekent. Een willekeurige JSON met `PASS` wordt hier
   nooit gelezen. De inhoudelijke controle gebeurt daarna per proef. */
'use strict';

const crypto = require('node:crypto');
const { canon } = require('../../server/kern/bewijsvlak/canon');
const { veiligeExternalUrl } = require('../../server/kern/ssrf');
const runnerTrust = require('../../server/config/evidence-runner-trust');

const FORMAAT = runnerTrust.MEASUREMENT_FORMAT;
const SHA = /^[a-f0-9]{40,64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/;
const MAX_ANTWOORD = 1024 * 1024;

const sha256 = waarde => crypto.createHash('sha256').update(waarde).digest('hex');

function configuratie(env, root) {
  const url = String(env.RTG_EVIDENCE_RUNNER_URL || '').trim();
  const token = String(env.RTG_EVIDENCE_RUNNER_TOKEN || '');
  if (!url) return { open: 'RTG_EVIDENCE_RUNNER_URL ontbreekt' };
  const keur = veiligeExternalUrl(url);
  let u;
  try { u = new URL(url); } catch (e) {}
  if (!keur.ok || !u || u.protocol !== 'https:' || u.username || u.password)
    return { fout: 'de externe meetrunner moet een veilig publiek HTTPS-adres zijn' };
  if (token.length < 32) return { open: 'RTG_EVIDENCE_RUNNER_TOKEN ontbreekt of is korter dan 32 tekens' };
  if (String(env.RTG_EVIDENCE_RUNNER_PUBLIC_KEY_FILE || '').trim())
    return { fout: 'RTG_EVIDENCE_RUNNER_PUBLIC_KEY_FILE is niet toegestaan; gebruik een gecommit versieanker' };
  const version = String(env.RTG_EVIDENCE_RUNNER_TRUST_VERSION || '').trim();
  if (!version) return { open: 'RTG_EVIDENCE_RUNNER_TRUST_VERSION ontbreekt' };
  try {
    const sleutel = runnerTrust.laad(root, version);
    return { url:u.href, token, key:sleutel.key, sleutelSha256:sleutel.sha256,
      runnerTrustVersion:sleutel.version };
  } catch (e) { return { fout:String(e.message || e) }; }
}

async function httpAanroep(cfg, verzoek, opties) {
  const http = opties.http || require('../../server/lib/http');
  const r = await http.vraag({ url: cfg.url, method: 'POST', json: verzoek,
    headers: { authorization: 'Bearer ' + cfg.token,
      'x-rtg-evidence-correlation': verzoek.correlationId,
      'idempotency-key': verzoek.correlationId },
    timeout: opties.timeout || 120000, maxRetries: 0 });
  if (!Number.isInteger(r.status) || r.status < 200 || r.status >= 300)
    throw new Error('de externe meetrunner antwoordde HTTP ' + r.status);
  if (Buffer.byteLength(String(r.tekst || '')) > MAX_ANTWOORD)
    throw new Error('het antwoord van de externe meetrunner is te groot');
  try { return r.json(); } catch (e) { throw new Error('de externe meetrunner gaf geen geldige JSON'); }
}

function verifieer(antwoord, verwacht, sleutel, nu) {
  if (!antwoord || typeof antwoord !== 'object' || Array.isArray(antwoord))
    throw new Error('de externe meting ontbreekt');
  const handtekening = String(antwoord.signature || '');
  const toegestaan = new Set(['format', 'runnerTrustVersion', 'control', 'commit', 'correlationId', 'requestSha256', 'measurementId',
    'startedAt', 'finishedAt', 'observations', 'signature']);
  const vreemd = Object.keys(antwoord).filter(k => !toegestaan.has(k));
  /* VeldNAMEN komen van een externe partij. Neem ze niet over in een lokaal
     bewijsrapport: een kwaadwillende runner kon anders een geheim als keynaam
     coderen en het via de foutmelding duurzaam laten opslaan. */
  if (vreemd.length) throw new Error('de externe meting bevat onbekende velden');
  const ongetekend = { ...antwoord }; delete ongetekend.signature;
  if (!runnerTrust.verifieer(ongetekend, handtekening, sleutel))
    throw new Error('de handtekening van de externe meting klopt niet');
  if (ongetekend.format !== FORMAAT || ongetekend.control !== verwacht.control ||
      ongetekend.runnerTrustVersion !== verwacht.runnerTrustVersion ||
      ongetekend.commit !== verwacht.commit || ongetekend.correlationId !== verwacht.correlationId ||
      ongetekend.requestSha256 !== verwacht.requestSha256)
    throw new Error('de externe meting hoort niet bij dit exacte verzoek, deze controle, commit en proef-ID');
  if (!ID.test(String(ongetekend.measurementId || '')))
    throw new Error('de externe meting mist een geldige measurementId');
  const start = Date.parse(ongetekend.startedAt || '');
  const klaar = Date.parse(ongetekend.finishedAt || '');
  const gevraagd = Date.parse(verwacht.requestedAt);
  if (![start, klaar, gevraagd].every(Number.isFinite) || klaar < start || start < gevraagd - 300000 ||
      klaar > nu + 300000 || klaar - start > 3600000)
    throw new Error('de externe meting heeft geen geldige actuele meetperiode');
  if (!ongetekend.observations || typeof ongetekend.observations !== 'object' ||
      Array.isArray(ongetekend.observations))
    throw new Error('de externe meting bevat geen waarnemingen');
  return { ...ongetekend, signature: handtekening };
}

async function meet(control, input, opties) {
  opties = opties || {};
  const env = opties.env || process.env;
  const commit = String(opties.commit || '').toLowerCase();
  if (!SHA.test(commit)) return { stand: 'FAIL', redenen: ['de releasecommit ontbreekt of is ongeldig'] };
  let cfg;
  if (opties.runnerCall && opties.runnerPublicKey) {
    try {
      const key = crypto.createPublicKey(opties.runnerPublicKey);
      if (key.asymmetricKeyType !== 'ed25519') throw new Error('geen Ed25519');
      cfg = { key, sleutelSha256: sha256(Buffer.from(String(opties.runnerPublicKey))),
        runnerTrustVersion:String(opties.runnerTrustVersion || 'v1') };
      runnerTrust.keurVersie(cfg.runnerTrustVersion);
    } catch (e) { return { stand: 'FAIL', redenen: ['de geïnjecteerde runnersleutel is ongeldig'] }; }
  } else {
    cfg = configuratie(env, opties.root);
    if (cfg.open) return { stand: 'OPEN', redenen: [cfg.open] };
    if (cfg.fout) return { stand: 'FAIL', redenen: [cfg.fout] };
  }
  const nu = typeof opties.nu === 'function' ? opties.nu : Date.now;
  const correlationId = String(opties.correlationId || (opties.randomUUID || crypto.randomUUID)());
  if (!ID.test(correlationId)) return { stand: 'FAIL', redenen: ['de proef-ID is ongeldig'] };
  const verzoekInhoud = { format:runnerTrust.REQUEST_FORMAT,
    runnerTrustVersion:cfg.runnerTrustVersion, control, commit, correlationId,
    requestedAt: new Date(nu()).toISOString(), input: input || {} };
  /* De hash is over het verzoek zonder zijn eigen hashveld. De runner tekent
     hem terug; daarmee zijn ook doel-URL, autorisatiereferentie en grenzen
     achteraf onderdeel van de attestatie en niet alleen van het HTTP-verkeer. */
  const verzoek = { ...verzoekInhoud,
    requestSha256: sha256(Buffer.from(canon(verzoekInhoud))) };
  try {
    const antwoord = opties.runnerCall
      ? await opties.runnerCall(verzoek)
      : await httpAanroep(cfg, verzoek, opties);
    const gemeten = verifieer(antwoord, verzoek, cfg.key, nu());
    return { stand: 'OK', meting: gemeten, runnerTrustVersion:cfg.runnerTrustVersion,
      runnerKeySha256: cfg.sleutelSha256,
      responseSha256: sha256(Buffer.from(canon(gemeten))) };
  } catch (e) {
    return { stand: 'FAIL', redenen: [String(e && e.message || e).slice(0, 300)] };
  }
}

module.exports = { FORMAAT, meet, verifieer, configuratie, sha256,
  signaturePayload:runnerTrust.payload, _httpAanroep: httpAanroep };
