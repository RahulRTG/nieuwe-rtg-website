'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const bron = require('../scripts/bron-release-bewijs');

const CLI = path.join(__dirname, '..', 'scripts', 'live-kandidaat-bron.js');
const git = (root, ...args) => spawnSync('git', args, { cwd:root, encoding:'utf8' });

test('CI-bronartefact wordt in een verse checkout bewezen zonder lokale buildbytes', t => {
  const basis = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bron-artifact-'));
  const vers = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bron-checkout-'));
  t.after(() => fs.rmSync(basis, { recursive:true, force:true }));
  t.after(() => fs.rmSync(vers, { recursive:true, force:true }));
  fs.writeFileSync(path.join(basis, '.gitignore'), '.release/\n');
  fs.writeFileSync(path.join(basis, 'SUITE.json'), '{"run":"oud"}\n');
  fs.mkdirSync(path.join(basis, 'server'));
  fs.writeFileSync(path.join(basis, 'server', 'app.js'), 'module.exports = 1;\n');
  assert.equal(git(basis, 'init', '--quiet').status, 0);
  assert.equal(git(basis, 'config', 'user.email', 'bron@test.invalid').status, 0);
  assert.equal(git(basis, 'config', 'user.name', 'Bron Test').status, 0);
  assert.equal(git(basis, 'add', '.').status, 0);
  assert.equal(git(basis, 'commit', '--quiet', '-m', 'bron').status, 0);
  const bewijs = bron.schrijf(basis);

  assert.equal(spawnSync('git', ['clone', '--quiet', basis, vers], { encoding:'utf8' }).status, 0);
  fs.mkdirSync(path.join(vers, '.release'), { recursive:true });
  fs.copyFileSync(path.join(basis, bron.STANDAARD), path.join(vers, bron.STANDAARD));
  fs.writeFileSync(path.join(vers, 'SUITE.json'), '{"run":"actueel"}\n');
  const geldig = spawnSync(process.execPath, [CLI, '--root=' + vers], { encoding:'utf8' });
  assert.equal(geldig.status, 0, geldig.stderr);
  assert.equal(geldig.stdout.trim(), bewijs.commit);
  assert.equal(fs.existsSync(path.join(vers, 'motor', 'target', 'release', 'rtg-motor')), false,
    'broncontrole mag geen lokale compileruitvoer vereisen');

  fs.appendFileSync(path.join(vers, 'server', 'app.js'), '// gewijzigd\n');
  const fout = spawnSync(process.execPath, [CLI, '--root=' + vers], { encoding:'utf8' });
  assert.notEqual(fout.status, 0);
  assert.match(fout.stderr, /server\/app\.js|wijzigingen buiten de commit/);
});
