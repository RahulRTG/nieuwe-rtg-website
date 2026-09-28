#!/usr/bin/env node
/* ============================================================================
   BEWIJSVERSLAGEN VOOR HET EXTERNE VRIJGAVEDOSSIER -- het meetbare deel.

   Het externe dossier (server/config/external-release.js) eist per controle een
   bewijsbestand met een pinnende hash, getekend door een beoordelaar. Wat erin
   staat leest de poort niet: dat is het werk van de beoordelaar. Maar vier van
   de achttien controles zijn grotendeels MACHINAAL vast te stellen, en tot nu
   toe maakte geen enkel script dat bestand. Dan typt een mens een verslag over
   een proef die hij zelf heeft uitgevoerd, en dat is precies het soort bewijs
   dat dit huis niet vertrouwt (RELEASEKANDIDAAT.md A8-A11).

   Dit script VOERT de proef uit op de echte host en schrijft wat het zag:

     herstel <stempel>   de echte herstelroute (live.sh restore), met tijden,
                         exitcode en twee MENSVERKLARINGEN die alleen een mens
                         kan geven: een bestaand lid logt in, en zijn echte naam
                         is zichtbaar (LIVEGANG.md). Zonder die twee: OPEN.
     rollback            de echte rollback (live.sh rollback): welke set draaide,
                         welke kwam terug, hoe lang tot ready.
     malware             ClamAV: versie en DATUM van de definities, een EICAR-
                         proef die moet raken en een schoon bestand dat door moet.
     objectopslag        put/get/hash/delete over twee instanties tegen de echte
                         S3-doelopslag (dezelfde proef als de go-live-keuring).

   Elk verslag draagt de commit waarop het draaide en een uitkomst PASS, FAIL
   of OPEN. OPEN is geen FAIL: er ontbreekt iets wat een mens moet doen, en het
   verslag zegt wat. Er wordt nooit iets PASS zonder dat het hier gezien is.

   DRAAIEN (op de productiehost, na live:init):
     node scripts/extern-bewijs.js malware
     node scripts/extern-bewijs.js objectopslag
     node scripts/extern-bewijs.js rollback
     RTG_HERSTEL_LOGIN_GEZIEN="Naam Beheerder" RTG_HERSTEL_NAAM_GEZIEN="Naam Beheerder" \
       node scripts/extern-bewijs.js herstel 20260815T030000Z
   ========================================================================== */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DOEL = path.join(ROOT, '.release', 'external-evidence');
const BESTAND = {
  herstel: 'backup-herstel.json',
  rollback: 'deployment-rollback.json',
  malware: 'malware-definitions-scan.json',
  objectopslag: 'object-storage-delivery.json'
};
const CONTROLE = {
  herstel: 'backupHerstel', rollback: 'deploymentRollback',
  malware: 'malwareDefinitionsScan', objectopslag: 'objectStorage'
};
/* Definities ouder dan dit zijn geen actuele bescherming meer; freshclam draait
   dagelijks (LIVEGANG.md), dus twee dagen laat een gemiste ronde toe en geen
   tweede. */
const MAX_DEFINITIE_DAGEN = 2;
/* EICAR, opgebouwd tijdens de run zodat de standaardteststring niet als
   bestand in de repository staat (een scanner op de ontwikkelmachine hoort
   niet op deze bron af te gaan). */
const EICAR = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$', 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'].join('');

function commitVan(root) {
  const r = cp.spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const sha = String(r.stdout || '').trim();
  return /^[a-f0-9]{40,64}$/.test(sha) ? sha : null;
}

function verslag(soort, commit, van, tot, uitkomst, redenen, gegevens, mensVerklaring) {
  return { formaat: 'rtg-extern-bewijsverslag-v1', controle: CONTROLE[soort], commit,
    gemeten: { van: new Date(van).toISOString(), tot: new Date(tot).toISOString(), duurMs: tot - van },
    uitkomst, redenen, gegevens, mensVerklaring: mensVerklaring || null,
    wat_dit_niet_zegt: 'Dit verslag is wat de proef op deze host zag. Het is geen oordeel van een ' +
      'beoordelaar; het externe dossier wordt pas geldig met diens Ed25519-handtekening.' };
}

/* ---------- malware ---------- */
function definitieDatum(versietekst) {
  // "ClamAV 1.3.1/27410/Fri Sep 26 08:20:00 2026"
  const deel = String(versietekst || '').split('/');
  const d = Date.parse(deel.slice(2).join('/'));
  return Number.isFinite(d) ? d : null;
}

async function malware(o) {
  const van = o.nu();
  const clamd = o.clamd();
  if (!clamd) return verslag('malware', o.commit, van, o.nu(), 'FAIL',
    ['RTG_CLAMD_HOST ontbreekt: er is geen scanner om te beproeven'], {});
  const redenen = [];
  const versie = await clamd.definitieVersie().catch(e => { redenen.push(e.message); return null; });
  const datum = definitieDatum(versie);
  const leeftijdDagen = datum == null ? null : Math.floor((o.nu() - datum) / 86400000);
  if (datum == null) redenen.push('de definitiedatum is niet uit het VERSION-antwoord te lezen');
  else if (leeftijdDagen > MAX_DEFINITIE_DAGEN) redenen.push('de definities zijn ' + leeftijdDagen + ' dagen oud');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-malwareproef-'));
  let besmet = null, schoon = null;
  try {
    fs.writeFileSync(path.join(map, 'eicar.txt'), EICAR);
    fs.writeFileSync(path.join(map, 'schoon.txt'), 'RTG bewijsverslag: een gewoon tekstbestand.\n');
    besmet = await clamd.scanBestand(path.join(map, 'eicar.txt')).catch(e => ({ fout: e.message }));
    schoon = await clamd.scanBestand(path.join(map, 'schoon.txt')).catch(e => ({ fout: e.message }));
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
  if (!besmet || besmet.verdict !== 'besmet') redenen.push('de EICAR-proef werd NIET herkend');
  if (!schoon || schoon.verdict !== 'schoon') redenen.push('een schoon bestand kwam niet schoon terug');
  return verslag('malware', o.commit, van, o.nu(), redenen.length ? 'FAIL' : 'PASS', redenen,
    { versie, definitieDatum: datum == null ? null : new Date(datum).toISOString(), leeftijdDagen,
      maxDefinitieDagen: MAX_DEFINITIE_DAGEN, eicar: besmet, schoon });
}

/* ---------- objectopslag ---------- */
async function objectopslag(o) {
  const van = o.nu();
  const r = await o.beproefMedia(o.env);
  return verslag('objectopslag', o.commit, van, o.nu(), r && r.ok === true ? 'PASS' : 'FAIL',
    r && r.ok === true ? [] : [String((r && r.reden) || 'geen uitslag')], r || {});
}

/* ---------- rollback ---------- */
function regels(pad) {
  try { return fs.readFileSync(pad, 'utf8').split('\n').filter(Boolean).slice(0, 3); } catch (e) { return null; }
}

function rollback(o) {
  const van = o.nu();
  const voor = regels(o.staat), set = regels(o.rollbackStaat);
  const r = o.draai('sh', ['scripts/docker/live.sh', 'rollback']);
  const na = regels(o.staat);
  const redenen = [];
  if (!set) redenen.push('er was geen bewezen rollbackset');
  if (r.status !== 0) redenen.push('live.sh rollback eindigde met exitcode ' + r.status);
  if (set && JSON.stringify(na) !== JSON.stringify(set)) redenen.push('de actieve set is na afloop niet de rollbackset');
  if (voor && set && JSON.stringify(voor) === JSON.stringify(set))
    redenen.push('de actieve set WAS al de rollbackset: er is niets teruggezet');
  return verslag('rollback', o.commit, van, o.nu(), redenen.length ? 'FAIL' : 'PASS', redenen,
    { exitcode: r.status, voor, rollbackset: set, na });
}

/* ---------- herstel ---------- */
function herstel(o, stempel) {
  const van = o.nu();
  if (!/^\d{8}T\d{6}Z$/.test(String(stempel || '')))
    return verslag('herstel', o.commit, van, o.nu(), 'FAIL', ['geef de exacte back-upstempel (JJJJMMDDTuummssZ)'], {});
  const r = o.draai('sh', ['scripts/docker/live.sh', 'restore', stempel]);
  const tot = o.nu();
  const login = String(o.env.RTG_HERSTEL_LOGIN_GEZIEN || '').trim();
  const naam = String(o.env.RTG_HERSTEL_NAAM_GEZIEN || '').trim();
  const redenen = [];
  if (r.status !== 0) redenen.push('live.sh restore eindigde met exitcode ' + r.status);
  const open = [];
  if (!login) open.push('een mens heeft nog niet verklaard dat een bestaand lid na het herstel kan inloggen (RTG_HERSTEL_LOGIN_GEZIEN)');
  if (!naam) open.push('een mens heeft nog niet verklaard dat de echte naam zichtbaar is, dus dat de kluissleutel bij de data hoort (RTG_HERSTEL_NAAM_GEZIEN)');
  const uitkomst = redenen.length ? 'FAIL' : open.length ? 'OPEN' : 'PASS';
  return verslag('herstel', o.commit, van, tot, uitkomst, redenen.concat(open),
    { stempel, exitcode: r.status, hersteltijdMs: tot - van },
    login && naam ? { inlogGezienDoor: login.slice(0, 120), naamGezienDoor: naam.slice(0, 120) } : null);
}

/* ---------- schrijven ---------- */
function schrijf(soort, uit, map = DOEL) {
  fs.mkdirSync(map, { recursive: true, mode: 0o700 });
  const bytes = Buffer.from(JSON.stringify(uit, null, 2) + '\n');
  const pad = path.join(map, BESTAND[soort]);
  fs.writeFileSync(pad, bytes, { mode: 0o600 });
  return { pad, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
}

function standaard(root = ROOT, env = process.env) {
  return {
    env, commit: commitVan(root), nu: () => Date.now(),
    clamd: () => require('../server/kern/clamd').maakClamd({}),
    beproefMedia: e => require('./lib/golive-uitgangen').beproefMedia(e),
    draai: (cmd, args) => cp.spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env }),
    staat: path.join(root, '.rtg-live-release'),
    rollbackStaat: path.join(root, '.rtg-live-rollback')
  };
}

async function voer(soort, arg, o) {
  if (soort === 'malware') return malware(o);
  if (soort === 'objectopslag') return objectopslag(o);
  if (soort === 'rollback') return rollback(o);
  if (soort === 'herstel') return herstel(o, arg);
  throw new Error('Onbekende proef. Kies uit: ' + Object.keys(BESTAND).join(', '));
}

if (require.main === module) {
  const [soort, arg] = process.argv.slice(2);
  voer(soort, arg, standaard()).then(uit => {
    const w = schrijf(soort, uit);
    console.log('[extern-bewijs] ' + CONTROLE[soort] + ': ' + uit.uitkomst);
    for (const r of uit.redenen) console.log('  - ' + r);
    console.log('  verslag: ' + path.relative(ROOT, w.pad) + '  sha256 ' + w.sha256);
    if (uit.uitkomst === 'FAIL') process.exitCode = 1;
    if (uit.uitkomst === 'OPEN') process.exitCode = 2;
  }).catch(e => { console.error('[extern-bewijs] ' + e.message); process.exitCode = 1; });
}

module.exports = { voer, schrijf, definitieDatum, BESTAND, CONTROLE, MAX_DEFINITIE_DAGEN, EICAR };
