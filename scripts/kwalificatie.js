#!/usr/bin/env node
/* De releasekwalificatie: test de bytes van het image, niet een tweede bouw.
   Zie scripts/lib/kwalificatie.js voor de keten. Drie standen:

     node scripts/kwalificatie.js --uit-image --image=<lokale tag>
        haalt inhoudsbewijs, Rust-binaries en frontend-build UIT het image in de
        werkboom en legt het image-ID vast;
     node scripts/kwalificatie.js --controle --fase=voor|na
        de werkboom moet byte voor byte de runtime-inhoud van dat image zijn;
     node scripts/kwalificatie.js --gepubliceerd --image=<registryverwijzing>
        het gepubliceerde (en teruggehaalde) image heeft hetzelfde image-ID;
     node scripts/kwalificatie.js --lokaal
        dezelfde bouw en dezelfde voor-controle als de releaseketen, op deze
        machine (zie lokaal() hieronder).

   Elke afwijking is exitcode 1. Er is geen vlag die een verschil toestaat. */
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const kw = require('./lib/kwalificatie');

const ROOT = path.join(__dirname, '..');
const ID = /^sha256:[a-f0-9]{64}$/;
const VLAGGEN = new Set(['uit-image', 'controle', 'gepubliceerd', 'image', 'backup', 'fase', 'lokaal']);

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
      ['/app/rtg-motor', 'rtg-motor'], ['/app/rtg-sentinel', 'rtg-sentinel'], ['/app/public/dist', 'dist'],
      ['/app/public/sw.js', 'sw.js'], ['/app/public/apps/foundation/sw.js', 'foundation-sw.js']])
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
  /* De build stempelt beide workers met de hash van hun werkelijke shell.
     Ook die gebouwde bytes moeten daarom uit hetzelfde image komen; alleen
     dist terughalen liet de voor-controle na iedere shellwijziging zakken. */
  vervang(path.join(ROOT, 'public/sw.js'), path.join(tmp, 'sw.js'));
  vervang(path.join(ROOT, 'public/apps/foundation/sw.js'), path.join(tmp, 'foundation-sw.js'));
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

/* ---------- DE KWALIFICATIE OP DEZE MACHINE ----------

   WAAROM HIJ ALLEEN IN DE KETEN STOND. De drie standen hierboven hangen aan
   een image dat .github/workflows/release-image.yml net heeft gebouwd, en ze
   SCHRIJVEN in de werkboom: --uit-image vervangt public/dist en de
   Rust-binaries door de bytes uit het image. scripts/ci-lokaal.js kan zo'n
   stap hier niet draaien (de tags komen uit een eerdere stap), en dat is
   terecht: in iemands eigen werkboom zou hij diens bouwsel overschrijven.

   WAT --lokaal DOET. Precies de bouw en de voor-controle van de keten, maar in
   een TIJDELIJKE werkboom op HEAD, zodat de werkboom van de ontwikkelaar
   nergens wordt aangeraakt:
     1. de twee `docker build`-opdrachten, GELEZEN uit release-image.yml (geen
        kopie hier die achter kan lopen), met lokale tags in plaats van de
        registrytags en de commit van HEAD in plaats van $GITHUB_SHA;
     2. --uit-image en --controle --fase=voor, ook gelezen uit de werkstroom;
     3. opruimen: de tijdelijke werkboom en de twee lokale images.

   WAT HIJ NIET DOET, en dat staat er met opzet. Tussen voor en na draait de
   keten `npm run afbouw:software` op de imagebytes; dat is een eigen
   mechanisme met een eigen plek op de bewijsladder. Een na-controle zonder
   die afbouw ertussen kan per constructie niet zakken, en een controle die
   niet kan zakken is geen bewijs -- dus die draait hier niet. Publiceren
   (--gepubliceerd) vraagt een registry en blijft van de keten.

   EIS, geen terugval: een schone werkboom (het image komt uit HEAD; een
   wijziging die niet gecommit is, zit er niet in en zou als gekwalificeerd
   lezen) en een draaiende docker-daemon. Ontbreekt een van de twee, dan zakt
   hij -- een overgeslagen kwalificatie telt nooit als groen. */
const LOKAAL_WAARDEN = ['GITHUB_SHA', 'RTG_CANDIDATE_IMAGE', 'RTG_CANDIDATE_BACKUP_IMAGE'];

function woorden(opdracht) {
  const uit = [];
  let huidig = '', aanhaling = null, heeft = false;
  for (const c of String(opdracht)) {
    if (aanhaling) { if (c === aanhaling) aanhaling = null; else huidig += c; continue; }
    if (c === '"' || c === "'") { aanhaling = c; heeft = true; continue; }
    if (/\s/.test(c)) { if (heeft || huidig) uit.push(huidig); huidig = ''; heeft = false; continue; }
    if (/[;&|<>`\\]/.test(c)) throw new Error('Kwalificatie lokaal: de opdracht "' + opdracht + '" is geen enkelvoudige opdracht.');
    huidig += c; heeft = true;
  }
  if (aanhaling) throw new Error('Kwalificatie lokaal: open aanhaling in "' + opdracht + '".');
  if (heeft || huidig) uit.push(huidig);
  return uit;
}

/* De stappen van de keten tot en met de voor-controle, uit de werkstroom zelf.
   `waarden` vult de drie ketenvariabelen; elke andere $-verwijzing is een
   waarde die hier niet bestaat, en dan is dit niet meer dezelfde handeling. */
function lokaalPlan(root, waarden) {
  const W = require('./lib/werkstroom');
  const doc = W.ontleed(fs.readFileSync(path.join(root, '.github/workflows/release-image.yml'), 'utf8'));
  const stappen = ((doc.jobs || {}).image || {}).steps || [];
  const plan = [];
  for (const stap of stappen) {
    if (!stap || typeof stap.run !== 'string') continue;
    for (const o of W.opdrachtenUit(stap.run)) {
      const tekst = o.opdracht;
      const isBouw = /^docker build\b/.test(tekst);
      const isVoor = /^node scripts\/kwalificatie\.js --(?:uit-image|controle --fase=voor)\b/.test(tekst);
      if (/^node scripts\/kwalificatie\.js --controle --fase=na\b/.test(tekst)) return plan;
      if (!isBouw && !isVoor) continue;
      const ingevuld = tekst.replace(/\$\{?([A-Z_]+)\}?/g, (m, naam) => {
        if (!LOKAAL_WAARDEN.includes(naam) || !waarden[naam]) throw new Error('Kwalificatie lokaal: "' + tekst +
          '" leunt op $' + naam + ', en die bestaat hier niet.');
        return waarden[naam];
      });
      const argv = woorden(ingevuld);
      plan.push({ stap: stap.name || '', argv });
    }
  }
  throw new Error('Kwalificatie lokaal: release-image.yml heeft geen voor- en na-controle meer; het plan is niet af te leiden.');
}

/* WAT DE LOKALE ROUTE NIET DOET, afgeleid en niet opgeschreven: elke
   kwalificatie-opdracht van release-image.yml die niet in lokaalPlan() staat.
   scripts/bewijsladder.js zet deze lijst bij het mechanisme (`lokaalNiet`),
   zodat "draait ook lokaal" nooit leest als "draait lokaal volledig". Komt er
   in de keten een vijfde stand bij, dan staat hij hier vanzelf, met de reden
   dat de lokale route hem niet kent. */
const GRENS_REDEN = [
  [/--controle --fase=na\b/, 'de na-controle hoort na de afbouw op de imagebytes (npm run afbouw:software); zonder die afbouw ertussen kan hij niet zakken'],
  [/--gepubliceerd\b/, 'vraagt een registry: het image wordt gepusht en teruggehaald']
];
function lokaalGrens(root) {
  const W = require('./lib/werkstroom');
  const doc = W.ontleed(fs.readFileSync(path.join(root, '.github/workflows/release-image.yml'), 'utf8'));
  const waarden = { GITHUB_SHA: 'x', RTG_CANDIDATE_IMAGE: 'x', RTG_CANDIDATE_BACKUP_IMAGE: 'x' };
  const lokaalVorm = new Set(lokaalPlan(root, waarden).map(s => s.argv.slice(0, 3).join(' ')));
  const uit = [];
  for (const stap of ((doc.jobs || {}).image || {}).steps || []) {
    if (!stap || typeof stap.run !== 'string') continue;
    for (const { opdracht } of W.opdrachtenUit(stap.run)) {
      if (!/^node scripts\/kwalificatie\.js\b/.test(opdracht)) continue;
      const vorm = opdracht.split(/\s+/).slice(0, 3).join(' ');
      if (lokaalVorm.has(vorm) && !/--fase=na\b/.test(opdracht)) continue;
      const reden = GRENS_REDEN.find(([re]) => re.test(opdracht));
      uit.push({ stap: stap.name || '', opdracht,
        waarom: reden ? reden[1] : 'staat in de keten en niet in de lokale route (kwalificatie.js --lokaal)' });
    }
  }
  return uit;
}

function git(args, opties = {}) {
  const r = cp.spawnSync('git', ['-C', opties.cwd || ROOT].concat(args), { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('git ' + args[0] + ' stopte met ' + r.status + ': ' + String(r.stderr || '').trim().slice(0, 300));
  return String(r.stdout || '').trim();
}

/* De twee eisen, los van het uitvoeren zodat ze te toetsen zijn: `status` is
   de uitvoer van `git status --porcelain`, `info` het resultaat van
   `docker info`. Geeft de reden waarom het niet mag, of null. */
function eisen(status, info) {
  if (String(status || '').trim()) return 'De werkboom is niet schoon. Het image komt uit HEAD; commit eerst, anders ' +
    'leest een niet-gecommitte wijziging als gekwalificeerd.';
  if (!info || info.error || info.status !== 0) return 'Geen draaiende docker-daemon. Deze kwalificatie bouwt het releaseimage ' +
    'en kan zonder niet; overslaan zou een kwalificatie als groen tellen die niet is gedaan.';
  return null;
}

function lokaal() {
  const nee = eisen(git(['status', '--porcelain']),
    cp.spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8' }));
  if (nee) throw new Error(nee);
  const commit = git(['rev-parse', 'HEAD']);
  const merk = commit.slice(0, 12) + '-' + process.pid;
  const waarden = { GITHUB_SHA: commit, RTG_CANDIDATE_IMAGE: 'rtg-kwalificatie-lokaal:' + merk,
    RTG_CANDIDATE_BACKUP_IMAGE: 'rtg-kwalificatie-lokaal:backup-' + merk };
  const plan = lokaalPlan(ROOT, waarden);
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rtg-kwal-lokaal-'));
  const boom = path.join(tmp, 'boom');
  git(['worktree', 'add', '--detach', boom, commit]);
  try {
    for (const { stap, argv } of plan) {
      console.log('\n[kwalificatie lokaal] ' + stap + '\n  ' + argv.join(' '));
      const [cmd, ...rest] = argv[0] === 'node' ? [process.execPath].concat(argv.slice(1)) : argv;
      const r = cp.spawnSync(cmd, rest, { cwd: boom, stdio: 'inherit' });
      if (r.error) throw r.error;
      if (r.status !== 0) throw new Error('"' + argv.join(' ') + '" stopte met ' + r.status + '.');
    }
    const rapport = path.join(tmp, 'rapport');
    fs.mkdirSync(rapport);
    for (const rel of [kw.REL.image, kw.REL.voor]) fs.copyFileSync(path.join(boom, rel), path.join(rapport, path.basename(rel)));
    const voor = kw.leesJson(boom, kw.REL.voor);
    console.log('\nKwalificatie lokaal: ' + voor.bestandAantal + ' runtimebestanden van ' + commit.slice(0, 12) +
      ' zijn byte voor byte het image ' + voor.imageId + '.\n  Rapport: ' + rapport +
      '\n  Niet hier: de afbouw tussen voor en na (npm run afbouw:software) en het publiceren (--gepubliceerd).');
  } finally {
    cp.spawnSync('git', ['-C', ROOT, 'worktree', 'remove', '--force', boom]);
    cp.spawnSync('docker', ['image', 'rm', '-f', waarden.RTG_CANDIDATE_IMAGE, waarden.RTG_CANDIDATE_BACKUP_IMAGE]);
    fs.rmSync(boom, { recursive: true, force: true });
  }
}

function hoofd() {
  const onbekend = process.argv.slice(2).filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('=')[0]).filter(n => !VLAGGEN.has(n));
  if (onbekend.length) throw new Error('Onbekende vlag: --' + onbekend.join(', --'));
  if (process.argv.includes('--uit-image')) return uitImage();
  if (process.argv.includes('--controle')) return controle();
  if (process.argv.includes('--gepubliceerd')) return gepubliceerd();
  if (process.argv.includes('--lokaal')) return lokaal();
  throw new Error('Gebruik --uit-image, --controle --fase=voor|na, --gepubliceerd of --lokaal.');
}

module.exports = { lokaalPlan, lokaalGrens, woorden, eisen };

if (require.main === module) {
  try { hoofd(); } catch (e) { console.error('[kwalificatie] ' + e.message); process.exitCode = 1; }
}
