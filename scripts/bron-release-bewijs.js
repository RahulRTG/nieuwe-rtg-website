#!/usr/bin/env node
/* Een CI-bronbewijs is iets anders dan het manifest IN het image.

   Dit bestand beschrijft exact de Git-boom waaruit CI bouwde. Het bevat geen
   lokaal gebouwde Rust-binaries of public/dist: die bytes ontstaan pas tijdens
   de imagebouw en worden door /app/release-bewijs.json gedekt. Daardoor kan
   een verse productie-checkout het CI-artefact controleren zonder dezelfde
   compiler/base-image opnieuw te hoeven reproduceren. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const STANDAARD = '.release/bron-release-bewijs.json';
const GIT_SHA = /^[a-f0-9]{40,64}$/;

function git(root, args) {
  const r = cp.spawnSync('git', args, { cwd:root, encoding:'buffer', maxBuffer:32 * 1024 * 1024 });
  if (r.error || r.status !== 0)
    throw new Error('Git-bron kon niet worden gelezen: ' + args.join(' ') + '.');
  return r.stdout;
}

function tekst(root, args) { return git(root, args).toString('utf8').trim(); }

function inventaris(root, commit = 'HEAD') {
  const ruw = git(root, ['ls-tree', '-r', '-z', '--full-tree', commit]);
  const bestanden = [];
  for (const regel of ruw.toString('utf8').split('\0')) {
    if (!regel) continue;
    const m = /^(\d{6}) (blob) ([a-f0-9]{40,64})\t([\s\S]+)$/.exec(regel);
    if (!m) throw new Error('De Git-boom bevat een niet-ondersteund item.');
    if (m[1] === '120000') throw new Error('De releaseboom bevat een symlink: ' + m[4] + '.');
    bestanden.push({ pad:m[4], modus:m[1], object:m[3] });
  }
  bestanden.sort((a, b) => a.pad.localeCompare(b.pad));
  return bestanden;
}

function inventarisHash(bestanden) {
  const h = crypto.createHash('sha256');
  for (const b of bestanden) h.update(b.modus + '\0' + b.object + '\0' + b.pad + '\n');
  return h.digest('hex');
}

function maak(root) {
  const commit = tekst(root, ['rev-parse', '--verify', 'HEAD']).toLowerCase();
  const boom = tekst(root, ['rev-parse', '--verify', 'HEAD^{tree}']).toLowerCase();
  if (!GIT_SHA.test(commit) || !GIT_SHA.test(boom)) throw new Error('Git HEAD of boom-ID is ongeldig.');
  const bestanden = inventaris(root, commit);
  return { formaat:'rtg-bron-release-bewijs-v1', gemaakt:new Date().toISOString(),
    commit, boom, bestandAantal:bestanden.length,
    inventarisSha256:inventarisHash(bestanden), bestanden };
}

function controleer(root, bewijs, verwachtCommit) {
  const fouten = [];
  if (!bewijs || bewijs.formaat !== 'rtg-bron-release-bewijs-v1' ||
      !GIT_SHA.test(String(bewijs.commit || '')) || !GIT_SHA.test(String(bewijs.boom || '')) ||
      !Array.isArray(bewijs.bestanden) || bewijs.bestandAantal !== bewijs.bestanden.length ||
      bewijs.inventarisSha256 !== inventarisHash(bewijs.bestanden))
    return { ok:false, fouten:['Bronbewijs heeft een onbekend of beschadigd contract.'] };
  let commit, boom, huidig;
  try {
    commit = tekst(root, ['rev-parse', '--verify', 'HEAD']).toLowerCase();
    boom = tekst(root, ['rev-parse', '--verify', 'HEAD^{tree}']).toLowerCase();
    huidig = inventaris(root, commit);
  } catch (e) { return { ok:false, fouten:[e.message] }; }
  if (commit !== bewijs.commit || (verwachtCommit && commit !== String(verwachtCommit).toLowerCase()))
    fouten.push('Bronbewijs hoort niet bij de huidige exacte HEAD.');
  if (boom !== bewijs.boom) fouten.push('Bronbewijs hoort niet bij de huidige Git-boom.');
  if (JSON.stringify(huidig) !== JSON.stringify(bewijs.bestanden))
    fouten.push('De getrackte bestandsinventaris wijkt af van het CI-bronbewijs.');
  return { ok:fouten.length === 0, fouten, commit, boom,
    bestandAantal:huidig.length, inventarisSha256:inventarisHash(huidig) };
}

function waarde(naam) {
  const gelijk = process.argv.find(a => a.startsWith('--' + naam + '='));
  return gelijk ? gelijk.slice(naam.length + 3) : null;
}

function schrijf(root, doel = path.join(root, STANDAARD)) {
  require('./lib/productie-vrijgave').eisSchoneReleasebron(root);
  const bewijs = maak(root);
  fs.mkdirSync(path.dirname(doel), { recursive:true, mode:0o700 });
  const tijdelijk = doel + '.tmp-' + process.pid;
  fs.writeFileSync(tijdelijk, JSON.stringify(bewijs, null, 2) + '\n', { mode:0o600 });
  fs.renameSync(tijdelijk, doel);
  return bewijs;
}

if (require.main === module) {
  try {
    const root = path.resolve(waarde('root') || path.join(__dirname, '..'));
    const doel = path.resolve(root, waarde('uit') || STANDAARD);
    if (process.argv.includes('--controle')) {
      require('./lib/productie-vrijgave').eisSchoneReleasebron(root);
      const r = controleer(root, JSON.parse(fs.readFileSync(doel)), waarde('commit'));
      if (!r.ok) throw new Error(r.fouten.join(' '));
      console.log('Bronbewijs geldig: ' + r.bestandAantal + ' bestanden · ' + r.boom);
    } else {
      const b = schrijf(root, doel);
      console.log('Bronbewijs geschreven: ' + b.bestandAantal + ' bestanden · ' + b.boom);
    }
  } catch (e) { console.error('[bron-release-bewijs] ' + e.message); process.exitCode = 1; }
}

module.exports = { STANDAARD, inventaris, inventarisHash, maak, controleer, schrijf };
