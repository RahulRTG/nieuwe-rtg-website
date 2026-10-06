/* Scan exact het kandidaatimage, niet de werkboom. De releasecommit komt uit
   /app/release-bewijs.json in datzelfde image; een tag zonder digest is nooit
   voldoende bewijs. Trivy of Grype is hostgereedschap en geen appdependency. */
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const imageHerkomst = require('../imageherkomst');
const releaseTrust = require('../../server/config/release-trust');
const { canon } = require('../../server/kern/bewijsvlak/canon');

const DIGEST = /@sha256:([a-f0-9]{64})$/i;
const MAX_UIT = 32 * 1024 * 1024;
const MAX_DB_OUDERDOM_MS = 72 * 3600 * 1000;
const ROOT = path.join(__dirname, '..', '..');
const MAX_HERKOMST_BYTES = 1024 * 1024;
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

function leesRegulier(bestand) {
  let fd;
  try {
    const voor = fs.lstatSync(bestand);
    if (!voor.isFile() || voor.isSymbolicLink() || voor.size < 1 || voor.size > MAX_HERKOMST_BYTES)
      throw new Error('geen begrensd regulier bestand');
    fd = fs.openSync(bestand, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const bytes = fs.readFileSync(fd);
    if (bytes.length !== voor.size || fs.fstatSync(fd).size !== voor.size)
      throw new Error('bestand veranderde tijdens lezen');
    return bytes;
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}

/* De scanner mag niet zelf verklaren welk image hij onderzocht. Vóór de
   scan wordt de digest vergeleken met de afzonderlijk getekende buildherkomst.
   Die volledige provenance blijft in het scanverslag, zodat de latere
   releaseverifier de buildhandtekening opnieuw kan controleren zonder de
   evidence-signer als vervangende bron van waarheid te gebruiken. */
function kandidaatHerkomst({ root = ROOT, document, publicKey, imageDigest, commit, release } = {}) {
  let bytes = null;
  if (!document) {
    bytes = leesRegulier(path.join(root, '.release', 'herkomst.json'));
    try { document = JSON.parse(bytes.toString('utf8')); }
    catch (e) { throw new Error('de getekende kandidaatherkomst is onleesbaar'); }
  }
  let ankerBytes;
  if (publicKey) ankerBytes = Buffer.from(publicKey);
  else ankerBytes = releaseTrust.anchors(root).BUILD.bytes;
  const controle = imageHerkomst.controleerHerkomst({ document,
    publiekPem:ankerBytes, draait:imageDigest });
  if (!controle.ok) throw new Error('de getekende kandidaatherkomst faalt: ' + controle.klachten.join('; '));
  if (!document.bron || document.bron.commit !== commit || document.bron.werkboomSchoon !== true ||
      !document.releasebewijs || !release ||
      document.releasebewijs.inhoudSha256 !== release.inhoudSha256)
    throw new Error('de getekende kandidaatherkomst hoort niet bij deze commit en runtime-inhoud');
  return { canonicalSha256:sha256(Buffer.from(canon(document))),
    buildKeySha256:sha256(ankerBytes), document };
}

function run(cmd, args, opties) {
  return (opties.spawnSync || cp.spawnSync)(cmd, args, { encoding: 'utf8', maxBuffer: MAX_UIT,
    env: opties.env || process.env });
}

function beschikbaar(naam, opties) {
  const r = run(naam, ['--version'], opties);
  return r && r.status === 0 ? String(r.stdout || r.stderr || '').trim().slice(0, 4000) : null;
}

function scannerVan(env, opties) {
  const gevraagd = String(env.RTG_IMAGE_SCANNER || '').trim().toLowerCase();
  if (gevraagd && !['trivy', 'grype'].includes(gevraagd))
    return { fout: 'RTG_IMAGE_SCANNER moet trivy of grype zijn' };
  for (const naam of gevraagd ? [gevraagd] : ['trivy', 'grype']) {
    const versie = beschikbaar(naam, opties);
    if (versie) return { naam, versie };
  }
  return { open: 'geen Trivy- of Grype-binary gevonden; installeer één scanner op de releasehost' };
}

function jsonVan(r, naam) {
  if (!r || r.error) throw new Error(naam + ' kon niet starten');
  if (r.status !== 0) throw new Error(naam + ' eindigde met exitcode ' + r.status + ': ' +
    String(r.stderr || '').trim().slice(0, 300));
  try { return JSON.parse(String(r.stdout || '')); }
  catch (e) { throw new Error(naam + ' gaf geen geldige JSON'); }
}

function releaseManifest(image, commit, opties) {
  const r = run('docker', ['run', '--rm', '--entrypoint', 'cat', image, '/app/release-bewijs.json'], opties);
  const m = jsonVan(r, 'docker image-inspectie');
  if (m.formaat !== 'rtg-release-bewijs-v1' || !m.bron || m.bron.commit !== commit ||
      m.bron.gewijzigd !== false)
    throw new Error('het kandidaatimage draagt geen schoon releasebewijs voor exact deze commit');
  return { inhoudSha256: m.inhoudSha256 || null, bestandAantal: m.bestandAantal || null };
}

function datumUitVersie(tekst) {
  const m = /(?:UpdatedAt|Built|BuildDate)\s*:\s*([^\r\n]+)/i.exec(String(tekst || ''));
  const t = m && Date.parse(m[1].trim());
  return Number.isFinite(t) ? t : null;
}

function telTrivy(data) {
  const v = (data.Results || []).flatMap(r => Array.isArray(r.Vulnerabilities) ? r.Vulnerabilities : []);
  return { high: v.filter(x => String(x.Severity).toUpperCase() === 'HIGH').length,
    critical: v.filter(x => String(x.Severity).toUpperCase() === 'CRITICAL').length,
    totaal: v.length };
}

function telGrype(data) {
  const v = Array.isArray(data.matches) ? data.matches : [];
  return { high: v.filter(x => String(x.vulnerability && x.vulnerability.severity).toUpperCase() === 'HIGH').length,
    critical: v.filter(x => String(x.vulnerability && x.vulnerability.severity).toUpperCase() === 'CRITICAL').length,
    totaal: v.length };
}

function scan(image, scanner, opties) {
  if (scanner.naam === 'trivy') {
    const r = run('trivy', ['image', '--quiet', '--format', 'json', '--scanners', 'vuln',
      '--severity', 'HIGH,CRITICAL', image], opties);
    return { aantallen: telTrivy(jsonVan(r, 'Trivy')), dbDatum: datumUitVersie(scanner.versie) };
  }
  const db = run('grype', ['db', 'status', '-o', 'json'], opties);
  let dbData = null;
  try { if (db.status === 0) dbData = JSON.parse(String(db.stdout || '')); } catch (e) {}
  const r = run('grype', [image, '-o', 'json'], opties);
  const datum = Date.parse(dbData && (dbData.built || dbData.buildDate || dbData.updatedAt) || '');
  return { aantallen: telGrype(jsonVan(r, 'Grype')),
    dbDatum: Number.isFinite(datum) ? datum : datumUitVersie(scanner.versie) };
}

function voer({ env, commit, nu, spawnSync, root, provenanceDocument, buildPublicKey } = {}) {
  env = env || process.env;
  const opties = { env, spawnSync };
  const image = String(env.RTG_CANDIDATE_IMAGE || '').trim();
  const match = DIGEST.exec(image);
  if (!image) return { stand: 'OPEN', redenen: ['RTG_CANDIDATE_IMAGE ontbreekt'] };
  if (!match) return { stand: 'FAIL', redenen: ['RTG_CANDIDATE_IMAGE moet aan een onveranderlijke sha256-digest zijn gepind'] };
  const scanner = scannerVan(env, opties);
  if (scanner.open) return { stand: 'OPEN', redenen: [scanner.open] };
  if (scanner.fout) return { stand: 'FAIL', redenen: [scanner.fout] };
  try {
    const release = releaseManifest(image, commit, opties);
    const imageDigest = 'sha256:' + match[1].toLowerCase();
    const candidateProvenance = kandidaatHerkomst({ root:root || ROOT,
      document:provenanceDocument, publicKey:buildPublicKey,
      imageDigest, commit, release });
    const uitslag = scan(image, scanner, opties);
    const tijd = typeof nu === 'function' ? nu() : Date.now();
    const leeftijdMs = uitslag.dbDatum == null ? null : tijd - uitslag.dbDatum;
    const redenen = [];
    if (leeftijdMs == null) redenen.push('de scanner gaf geen controleerbare kwetsbaarheidsdatabankdatum');
    else if (leeftijdMs < -300000 || leeftijdMs > MAX_DB_OUDERDOM_MS)
      redenen.push('de kwetsbaarheidsdatabank is ouder dan 72 uur of komt uit de toekomst');
    if (uitslag.aantallen.high || uitslag.aantallen.critical)
      redenen.push('het image bevat HIGH/CRITICAL-kwetsbaarheden volgens de actuele scanner');
    return { stand: redenen.length ? 'FAIL' : 'OK', redenen,
      gegevens: { imageDigest, scanner: scanner.naam,
        scannerVersion: scanner.versie, databaseUpdatedAt: uitslag.dbDatum == null ? null : new Date(uitslag.dbDatum).toISOString(),
        databaseAgeMs: leeftijdMs, blocking: uitslag.aantallen, release, candidateProvenance } };
  } catch (e) { return { stand: 'FAIL', redenen: [String(e && e.message || e).slice(0, 400)] }; }
}

module.exports = { voer, scannerVan, datumUitVersie, telTrivy, telGrype,
  MAX_DB_OUDERDOM_MS, kandidaatHerkomst, _releaseManifest: releaseManifest };
