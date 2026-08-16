/* Maak en verifieer een cryptografisch releasebewijs zonder externe pakketten.

   Het manifest bevat SHA-256, grootte en pad van alle runtimebron, gebouwde
   frontend en de Rust-binary. Geheimen en runtime-data zijn uitgesloten. De
   controlemodus rekent alles opnieuw uit en detecteert ook toegevoegde of
   verdwenen bestanden. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const STANDAARD_UIT = '.release/release-bewijs.json';
const MAX_BESTANDEN = 20_000;
const MAX_BESTAND = 128 * 1024 * 1024;
const MAPPEN = ['server', 'public', 'scripts', 'motor/src'];
const LOS = ['package.json', 'package-lock.json', 'motor/Cargo.toml', 'motor/Cargo.lock',
  'Dockerfile', 'docker-compose.yml', '.env.example', 'SLO.json', 'RUST-MIGRATIES.json'];

function uitgesloten(rel) {
  return rel === 'server/data' || rel.startsWith('server/data/') ||
    rel === '.release' || rel.startsWith('.release/') ||
    rel === 'node_modules' || rel.startsWith('node_modules/');
}

function verzamel(root) {
  const uit = [];
  function voeg(rel) {
    if (uitgesloten(rel)) return;
    const volledig = path.join(root, rel);
    let stat;
    try { stat = fs.lstatSync(volledig); } catch (e) { return; }
    if (stat.isSymbolicLink()) throw new Error('Releasebron bevat een symlink: ' + rel);
    if (stat.isDirectory()) {
      for (const naam of fs.readdirSync(volledig).sort()) voeg(path.posix.join(rel, naam));
    } else if (stat.isFile()) {
      if (stat.size > MAX_BESTAND) throw new Error('Releasebestand is te groot: ' + rel);
      uit.push(rel);
      if (uit.length > MAX_BESTANDEN) throw new Error('Meer dan ' + MAX_BESTANDEN + ' releasebestanden.');
    }
  }
  for (const rel of LOS) voeg(rel);
  for (const rel of MAPPEN) voeg(rel);
  const image = fs.existsSync(path.join(root, 'rtg-motor'));
  const bins = image ? ['rtg-motor', 'rtg-sentinel']
    : ['motor/target/release/rtg-motor', 'motor/target/release/rtg-sentinel'];
  for (const bin of bins) {
    if (!fs.existsSync(path.join(root, bin)))
      throw new Error('Rust-releasebinary ontbreekt: ' + bin + '; draai eerst npm run motor:build.');
    voeg(bin);
  }
  if (!fs.existsSync(path.join(root, 'public/dist'))) throw new Error('Frontend-build ontbreekt; draai eerst npm run build.');
  return [...new Set(uit)].sort();
}

function hashBestand(volledig) {
  const stat = fs.statSync(volledig);
  return { bytes: stat.size, sha256: crypto.createHash('sha256').update(fs.readFileSync(volledig)).digest('hex') };
}

function commando(naam, args) {
  const r = cp.spawnSync(naam, args, { encoding: 'utf8' });
  return r.status === 0 ? String(r.stdout || '').trim() : null;
}

function gitInfo(root) {
  const commit = cp.spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const status = cp.spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  return {
    commit: commit.status === 0 ? commit.stdout.trim() : null,
    gewijzigd: status.status === 0 ? !!status.stdout.trim() : null
  };
}

function totaalHash(bestanden) {
  const h = crypto.createHash('sha256');
  for (const b of bestanden) h.update(b.pad + '\0' + b.bytes + '\0' + b.sha256 + '\n');
  return h.digest('hex');
}

function maakManifest(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const bestanden = verzamel(root).map(rel => ({ pad: rel, ...hashBestand(path.join(root, rel)) }));
  return {
    formaat: 'rtg-release-bewijs-v1', gemaakt: new Date().toISOString(),
    pakket: { naam: pkg.name, versie: pkg.version },
    bron: gitInfo(root),
    gereedschap: {
      node: process.version,
      cargo: commando('cargo', ['--version']),
      rustc: commando('rustc', ['--version'])
    },
    dependencies: {
      runtime: Object.keys(pkg.dependencies || {}).length,
      ontwikkeling: Object.keys(pkg.devDependencies || {}).length,
      cargo: 0
    },
    bestandAantal: bestanden.length,
    inhoudSha256: totaalHash(bestanden),
    bestanden
  };
}

function verifieer(root, manifest) {
  const fouten = [];
  const verschillen = [];
  const fout = (soort, padNaam, tekst) => {
    fouten.push(tekst);
    verschillen.push({ soort, pad: padNaam || null, uitleg: tekst });
  };
  if (!manifest || manifest.formaat !== 'rtg-release-bewijs-v1' || !Array.isArray(manifest.bestanden))
    return { ok: false, fouten: ['Onbekend of beschadigd releasebewijs.'],
      verschillen: [{ soort: 'bewijs', pad: null, uitleg: 'Onbekend of beschadigd releasebewijs.' }] };
  let huidig;
  try { huidig = verzamel(root); } catch (e) {
    return { ok: false, fouten: [e.message], verschillen: [{ soort: 'scan', pad: null, uitleg: e.message }] };
  }
  const verwacht = manifest.bestanden.map(b => b.pad);
  const huidigSet = new Set(huidig);
  const verwachtSet = new Set(verwacht);
  for (const padNaam of huidig) if (!verwachtSet.has(padNaam))
    fout('nieuw', padNaam, 'Nieuw bestand buiten bewijs: ' + padNaam);
  for (const b of manifest.bestanden) {
    const volledig = path.join(root, b.pad);
    if (!huidigSet.has(b.pad) || !fs.existsSync(volledig)) { fout('ontbreekt', b.pad, 'Bestand ontbreekt: ' + b.pad); continue; }
    const nu = hashBestand(volledig);
    if (nu.bytes !== b.bytes) fout('grootte', b.pad, 'Grootte gewijzigd: ' + b.pad);
    else if (nu.sha256 !== b.sha256) fout('inhoud', b.pad, 'Inhoud gewijzigd: ' + b.pad);
  }
  if (manifest.inhoudSha256 !== totaalHash(manifest.bestanden))
    fout('bewijs', null, 'De verzamelhash in het bewijs zelf klopt niet.');
  return { ok: fouten.length === 0, fouten, verschillen, bestandAantal: huidig.length,
    inhoudSha256: manifest.inhoudSha256 };
}

function argument(naam) {
  const i = process.argv.indexOf(naam);
  return i >= 0 ? process.argv[i + 1] : null;
}

function hoofd() {
  const root = path.join(__dirname, '..');
  const controle = process.argv.includes('--controle');
  const rel = argument('--uit') || argument('--controle') || STANDAARD_UIT;
  const doel = path.resolve(root, rel);
  if (controle) {
    const resultaat = verifieer(root, JSON.parse(fs.readFileSync(doel, 'utf8')));
    if (!resultaat.ok) {
      for (const fout of resultaat.fouten.slice(0, 50)) console.error('✗ ' + fout);
      if (resultaat.fouten.length > 50) console.error('✗ plus ' + (resultaat.fouten.length - 50) + ' andere verschillen');
      process.exit(1);
    }
    console.log('Releasebewijs geldig: ' + resultaat.bestandAantal + ' bestanden, SHA-256 ' + resultaat.inhoudSha256);
    return;
  }
  const manifest = maakManifest(root);
  fs.mkdirSync(path.dirname(doel), { recursive: true });
  fs.writeFileSync(doel, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o644 });
  console.log('Releasebewijs geschreven: ' + path.relative(root, doel) + ' (' + manifest.bestandAantal + ' bestanden)');
  console.log('Inhoud SHA-256: ' + manifest.inhoudSha256 + (manifest.bron.gewijzigd ? ' · let op: werkboom bevat wijzigingen' : ''));
}

if (require.main === module) {
  try { hoofd(); } catch (e) { console.error('[releasebewijs] ' + e.message); process.exitCode = 1; }
}

module.exports = { verzamel, hashBestand, totaalHash, maakManifest, verifieer };
