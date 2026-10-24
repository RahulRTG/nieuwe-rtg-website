/* DE VERSHEID VAN APPWERKT IS EEN RELEASEPOORT, GEEN RAPPORT.

   Een app die als 8/8 geldt terwijl een van zijn bewijzen sinds de meting is
   vervallen, is geen 8/8 meer (BETROUWBAARHEID.md par. 4i). De poort staat in
   scripts/release-gate.js en niet in scripts/check.js: check draait bij elke
   commit en zou na elke wijziging in de gedeelde kern rood staan tot de
   volgende meetronde, een release mag die stand niet erven. Hier staat vast
   dat de stap er is, en dat hij werkelijk zakt -- op een register met een 8/8
   waarvan het bewijs niet meer vers is.

   Draai los: node --test test/appwerkt-vers-releasepoort.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const HEAD = cp.execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();

function draai(register) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appwerkt-vers-'));
  try {
    const pad = path.join(map, 'APPWERKT.json');
    fs.writeFileSync(pad, JSON.stringify(register));
    return cp.spawnSync(process.execPath, ['scripts/appwerkt-vers.js', '--controle', '--register', pad],
      { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
}
const rij = (app, status) => ({ app, functie: 'link:' + app, ingang: '/apps/' + app + '.html', status,
  bewijzen: { bereikbaar: { status: 'BEWEZEN', reden: 'gemeten', bewijs: '/apps/' + app + '.html' } } });

test('1. de releasepoort draait appwerkt:vers --controle, na de bronregels', () => {
  const bron = fs.readFileSync(path.join(ROOT, 'scripts/release-gate.js'), 'utf8');
  const stap = /\['APPWERKT-versheid', process\.execPath, \['scripts\/appwerkt-vers\.js', '--controle'\]\]/.exec(bron);
  assert.ok(stap, 'de stap APPWERKT-versheid ontbreekt in scripts/release-gate.js');
  assert.ok(bron.indexOf("['Bron- en securityregels'") < stap.index, 'de versheid hoort na check.js te komen');
});

test('2. een 8/8 waarvan het bewijs niet vers is, laat de poort zakken', () => {
  /* Gemeten op een commit die niet bestaat: de grove regel kan dat niet vers
     noemen, en het raakvlak ook niet. */
  const r = draai({ stempel: { op: 'toen', commit: 'deadbeef', boomVuil: false }, regels: [rij('x', 'BEWEZEN')] });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /NIET OK: x geldt als 8\/8, maar bereikbaar is/);
});

test('3. dezelfde rij, vers op de huidige commit, laat hem open', () => {
  const r = draai({ stempel: { op: 'nu', commit: HEAD, boomVuil: false }, regels: [rij('x', 'BEWEZEN')] });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('4. een vervallen bewijs van een rij die geen 8/8 is, zakt de poort niet', () => {
  const r = draai({ stempel: { op: 'toen', commit: 'deadbeef', boomVuil: false }, regels: [rij('x', 'NIET_GETEST')] });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /als 8\/8 gelden: 0,/);
});
