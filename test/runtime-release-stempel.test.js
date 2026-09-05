'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { maakManifest } = require('../scripts/release-bewijs');
const runtime = require('../scripts/lib/runtime-release-stempel');

test('container zonder .git ontleent commit alleen aan zijn geverifieerde eigen bytes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-runtimebewijs-'));
  for (const map of ['server', 'public/dist', 'scripts', 'motor/src'])
    fs.mkdirSync(path.join(root, map), { recursive: true });
  const bestanden = {
    'package.json': '{"name":"rtg-proef","version":"1"}', 'package-lock.json': '{}',
    'motor/Cargo.toml': '[package]', 'motor/Cargo.lock': '',
    'server/app.js': 'module.exports=1', 'public/dist/app.js': 'bouw',
    'scripts/start.js': 'start', 'motor/src/lib.rs': 'pub fn x(){}',
    'rtg-motor': 'motor', 'rtg-sentinel': 'sentinel', 'BEGROTING.json': '{"grens":1}',
    'SUITE.json': '{"meetuitvoer":true}'
  };
  for (const [rel, inhoud] of Object.entries(bestanden)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), inhoud);
  }
  const vorig = process.env.RTG_RELEASE_COMMIT;
  process.env.RTG_RELEASE_COMMIT = 'a'.repeat(40);
  try {
    const manifest = maakManifest(root);
    assert.equal(manifest.bestanden.some(b => b.pad === 'SUITE.json'), false,
      'suite-meetuitvoer hoort niet als runtimebyte in het imagebewijs');
    fs.writeFileSync(path.join(root, 'release-bewijs.json'), JSON.stringify(manifest));
    const onbekend = { commit: null, boomVuil: null };
    const bron = runtime.lees(root, onbekend);
    assert.equal(bron.commit, 'a'.repeat(40));
    assert.equal(bron.boomVuil, false);
    fs.writeFileSync(path.join(root, 'BEGROTING.json'), '{"grens":2}');
    assert.equal(runtime.lees(root, onbekend).commit, null,
      'na runtimewijziging mag het ingebakken commitbewijs niet worden vertrouwd');
  } finally {
    if (vorig === undefined) delete process.env.RTG_RELEASE_COMMIT;
    else process.env.RTG_RELEASE_COMMIT = vorig;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
