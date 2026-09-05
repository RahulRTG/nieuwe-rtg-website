/* De laatste release-uitspraak. Dit script maakt niets groen: het verbindt de
   onafhankelijke, commitgebonden bewijzen en faalt zodra één bron ontbreekt,
   oud is, skips bevat of na de meting is vervangen. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const { hoortBij, beoordeel } = require('./lib/productie-oordeel');
const schermBewijs = require('./lib/schermsuite-bewijs');
const { BRONNEN } = require('./lib/productie-vrijgave');
const externBewijs = require('../server/config/external-release');

const ROOT = path.join(__dirname, '..');
const DOEL = path.join(ROOT, '.release', 'productie-status.json');

function lees(root, rel) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
  catch (e) { return null; }
}

function sha256Bestand(root, rel) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex'); }
  catch (e) { return null; }
}

function suiteInventaris(root) {
  const namen = fs.readdirSync(path.join(root, 'test')).filter(n => n.endsWith('.test.js')).sort();
  return { bestanden: namen.length,
    bestandenSha256: crypto.createHash('sha256').update(namen.join('\n') + '\n').digest('hex') };
}

function maak(root = ROOT) {
  const commitUit = cp.spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const commit = commitUit.status === 0 ? String(commitUit.stdout || '').trim() : null;
  let codeSchoon = false;
  try { codeSchoon = require('./lib/productie-vrijgave').eisSchoneReleasebron(root) === commit; }
  catch (e) { codeSchoon = false; }
  const invoer = { commit, codeSchoon, suiteVerwachting: suiteInventaris(root),
    schermVerwachting: schermBewijs.inventaris(root) };
  const bronnen = {};
  for (const [naam, rel] of Object.entries(BRONNEN)) {
    invoer[naam] = lees(root, rel);
    bronnen[naam] = { pad: rel, sha256: sha256Bestand(root, rel) };
  }
  invoer.externControle = externBewijs.controleerReleaseRoot(root, commit);
  try {
    const kandidaat = require('./lib/live-kandidaat').controleer(root, commit);
    invoer.kandidaatControle = { ok:true, commit:kandidaat.commit,
      image:kandidaat.image, backup:kandidaat.backup, bewijsSha256:kandidaat.bewijsSha256 };
  } catch (e) { invoer.kandidaatControle = { ok:false, reden:e.message }; }
  const oordeel = beoordeel(invoer);
  const rapport = {
    formaat: 'rtg-production-status-v1', gemaakt: new Date().toISOString(), commit,
    release: (() => { try { return JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version; }
      catch (e) { return null; } })(),
    PRODUCTION_STATUS: oordeel.status, blokkades: oordeel.blokkades, bronnen,
    externeVrijgave: externBewijs.samenvatting(invoer.externControle),
    kandidaatVrijgave: invoer.kandidaatControle
  };
  rapport.bewijsSha256 = crypto.createHash('sha256').update(JSON.stringify(rapport)).digest('hex');
  return rapport;
}

function schrijf(root = ROOT, doel = DOEL) {
  const rapport = maak(root);
  fs.mkdirSync(path.dirname(doel), { recursive: true, mode: 0o700 });
  const tijdelijk = doel + '.tmp-' + process.pid;
  fs.writeFileSync(tijdelijk, JSON.stringify(rapport, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tijdelijk, doel);
  fs.chmodSync(doel, 0o600);
  return rapport;
}

if (require.main === module) {
  try {
    const rapport = schrijf();
    console.log('PRODUCTION_STATUS=' + rapport.PRODUCTION_STATUS);
    console.log('Commit: ' + (rapport.commit || 'onbekend'));
    console.log('Bewijs SHA-256: ' + rapport.bewijsSha256);
    for (const b of rapport.blokkades) console.error('✗ ' + b);
    if (rapport.PRODUCTION_STATUS !== 'READY') process.exitCode = 1;
  } catch (e) { console.error('[productie-status] ' + e.message); process.exitCode = 1; }
}

module.exports = { hoortBij, suiteInventaris, beoordeel, maak, schrijf };
