#!/usr/bin/env node
/* De releasekwalificatie: test de bytes van het image, niet een tweede bouw.
   Zie scripts/lib/kwalificatie.js voor de keten. Drie standen:

     node scripts/kwalificatie.js --uit-image --image=<lokale tag>
        haalt inhoudsbewijs, Rust-binaries en frontend-build UIT het image in de
        werkboom en legt het image-ID vast;
     node scripts/kwalificatie.js --controle --fase=voor|na
        de werkboom moet byte voor byte de runtime-inhoud van dat image zijn;
     node scripts/kwalificatie.js --gepubliceerd --image=<registryverwijzing>
        het gepubliceerde (en teruggehaalde) image heeft hetzelfde image-ID.

   Elke afwijking is exitcode 1. Er is geen vlag die een verschil toestaat. */
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const kw = require('./lib/kwalificatie');

const ROOT = path.join(__dirname, '..');
const ID = /^sha256:[a-f0-9]{64}$/;
const VLAGGEN = new Set(['uit-image', 'controle', 'gepubliceerd', 'image', 'backup', 'fase']);

function arg(naam) {
  const v = process.argv.find(a => a.startsWith('--' + naam + '='));
  return v ? v.slice(naam.length + 3) : null;
}

function docker(args, opties = {}) {
  const r = cp.spawnSync('docker', args, { encoding: opties.binair ? 'buffer' : 'utf8', maxBuffer: 1 << 30 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('docker ' + args[0] + ' stopte met ' + r.status + ': ' +
    String(r.stderr || '').trim().slice(0, 400));
  return opties.binair ? r.stdout : String(r.stdout || '').trim();
}

function imageId(ref) {
  const id = docker(['image', 'inspect', '--format', '{{.Id}}', ref]);
  if (!ID.test(id)) throw new Error('Docker gaf geen geldig image-ID voor ' + ref + '.');
  return id;
}

function vervang(doel, bron) {
  fs.rmSync(doel, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(doel), { recursive: true });
  fs.cpSync(bron, doel, { recursive: true });
}

/* Het backupimage draagt twee scripts uit deze werkboom. Ze moeten byte voor
   byte gelijk zijn: anders draait de back-up iets anders dan wat getest is. */
function backupscripts(id) {
  const container = docker(['create', id]);
  const uit = {};
  try {
    for (const [binnen, rel] of [['/usr/local/bin/rtg-backup', 'scripts/docker/backup.sh'],
      ['/usr/local/bin/rtg-herstel', 'scripts/docker/herstel.sh']]) {
      const tar = docker(['cp', container + ':' + binnen, '-'], { binair: true });
      const bytes = uitTar(tar);
      const werk = fs.readFileSync(path.join(ROOT, rel));
      if (!bytes.equals(werk)) throw new Error('Backupimage: ' + binnen + ' is niet byte voor byte ' + rel + '.');
      uit[rel] = kw.sha256(werk);
    }
  } finally { cp.spawnSync('docker', ['rm', '-f', container]); }
  return uit;
}

/* Een `docker cp ... -` geeft een tar met een bestand. Header 512 bytes,
   grootte octaal op offset 124. */
function uitTar(tar) {
  const grootte = parseInt(tar.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim(), 8);
  if (!Number.isSafeInteger(grootte) || grootte < 0 || 512 + grootte > tar.length)
    throw new Error('Onleesbare tar uit docker cp.');
  return tar.subarray(512, 512 + grootte);
}

function uitImage() {
  const ref = arg('image');
  const backupRef = arg('backup');
  if (!ref || !backupRef) throw new Error('--image=<tag> en --backup=<tag> zijn allebei verplicht.');
  const id = imageId(ref);
  const backupId = imageId(backupRef);
  const backupScripts = backupscripts(backupId);
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rtg-kwal-'));
  const container = docker(['create', id]);
  try {
    for (const [binnen, buiten] of [['/app/release-bewijs.json', 'release-bewijs.json'],
      ['/app/rtg-motor', 'rtg-motor'], ['/app/rtg-sentinel', 'rtg-sentinel'], ['/app/public/dist', 'dist']])
      docker(['cp', container + ':' + binnen, path.join(tmp, buiten)]);
  } finally { cp.spawnSync('docker', ['rm', '-f', container]); }
  const bewijsBytes = fs.readFileSync(path.join(tmp, 'release-bewijs.json'));
  const bewijs = JSON.parse(bewijsBytes.toString('utf8'));
  const head = cp.spawnSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  const commit = String(head.stdout || '').trim();
  if (!bewijs.bron || String(bewijs.bron.commit || '').toLowerCase() !== commit.toLowerCase())
    throw new Error('Het image is niet uit de commit van deze werkboom gebouwd (' +
      (bewijs.bron && bewijs.bron.commit) + ' tegen ' + commit + ').');
  fs.mkdirSync(path.join(ROOT, '.release'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, kw.REL.imageBewijs), bewijsBytes);
  /* De geteste binaries ZIJN de geleverde: op de imagepaden (die het
     inhoudsbewijs noemt) en op het pad waar de toetsen de motor zoeken. */
  for (const bin of ['rtg-motor', 'rtg-sentinel']) {
    vervang(path.join(ROOT, bin), path.join(tmp, bin));
    vervang(path.join(ROOT, 'motor/target/release', bin), path.join(tmp, bin));
    fs.chmodSync(path.join(ROOT, bin), 0o755);
    fs.chmodSync(path.join(ROOT, 'motor/target/release', bin), 0o755);
  }
  vervang(path.join(ROOT, 'public/dist'), path.join(tmp, 'dist'));
  fs.rmSync(tmp, { recursive: true, force: true });
  kw.schrijfJson(ROOT, kw.REL.image, { formaat: kw.FORMAAT + '-image', image: ref, imageId: id,
    commit, bewijsSha256: kw.sha256(bewijsBytes), inhoudSha256: bewijs.inhoudSha256,
    backup: backupRef, backupImageId: backupId, backupScripts,
    gepubliceerdImageId: null, gepubliceerdBackupImageId: null, uitgepakt: new Date().toISOString() });
  console.log('Kwalificatie: werkboom draagt nu de runtimebytes van ' + id);
}

function controle() {
  const r = kw.fase(ROOT, arg('fase'));
  if (!r.ok) {
    for (const v of r.verschillen) console.error('✗ ' + v.soort + ' ' + (v.pad || ''));
    if (r.aantalVerschillen > r.verschillen.length)
      console.error('✗ plus ' + (r.aantalVerschillen - r.verschillen.length) + ' andere verschillen');
    throw new Error('De werkboom (' + r.fase + ' de tests) is niet byte voor byte het image ' + r.imageId + '.');
  }
  console.log('Kwalificatie ' + r.fase + ': ' + r.bestandAantal + ' runtimebestanden gelijk aan ' + r.imageId +
    (r.extraToegestaan.length ? ' (niet geleverd volgens .dockerignore: ' + r.extraToegestaan.join(', ') + ')' : ''));
}

function gepubliceerd() {
  const ref = arg('image');
  const backupRef = arg('backup');
  if (!ref || !backupRef) throw new Error('--image=<registryverwijzing> en --backup=<registryverwijzing> zijn verplicht.');
  const rec = kw.imageRecord(ROOT);
  const id = imageId(ref);
  const backupId = imageId(backupRef);
  if (id !== rec.imageId)
    throw new Error('Het gepubliceerde image ' + id + ' is niet het gekwalificeerde image ' + rec.imageId + '.');
  if (backupId !== rec.backupImageId)
    throw new Error('Het gepubliceerde backupimage ' + backupId + ' is niet het gekwalificeerde ' + rec.backupImageId + '.');
  kw.schrijfJson(ROOT, kw.REL.image, { ...rec, gepubliceerd: ref, gepubliceerdImageId: id,
    gepubliceerdBackup: backupRef, gepubliceerdBackupImageId: backupId });
  kw.samenvatting(ROOT);
  console.log('Kwalificatie: gepubliceerd image is het geteste image (' + id + ').');
}

function hoofd() {
  const onbekend = process.argv.slice(2).filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('=')[0]).filter(n => !VLAGGEN.has(n));
  if (onbekend.length) throw new Error('Onbekende vlag: --' + onbekend.join(', --'));
  if (process.argv.includes('--uit-image')) return uitImage();
  if (process.argv.includes('--controle')) return controle();
  if (process.argv.includes('--gepubliceerd')) return gepubliceerd();
  throw new Error('Gebruik --uit-image, --controle --fase=voor|na of --gepubliceerd.');
}

if (require.main === module) {
  try { hoofd(); } catch (e) { console.error('[kwalificatie] ' + e.message); process.exitCode = 1; }
}
