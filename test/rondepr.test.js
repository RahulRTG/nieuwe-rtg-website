/* DE RONDE LEVERT EEN VOORSTEL EN GEEN VASTLEGGING (.github/workflows/ronde.yml,
   job `registers-pr`).

   De toets draait de ECHTE stap uit de werkstroom -- gelezen met dezelfde lezer
   als scripts/ci-keten.js, niet overgetypt -- in een wegwerprepo, met een lokale
   bare-repo achter de GitHub-url en een nep-`gh` die alleen opschrijft wat hem
   gevraagd wordt. Zo zijn vier dingen te zien die niet mogen sneuvelen:

     1. er komt een CONCEPT-PR naar main en een CI-start, en verder niets;
     2. iets dat geen wortelregister is, laat het hele voorstel zakken;
     3. geen verschil is geen PR (een lege PR is ruis);
     4. het token komt nooit in .git/config. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const W = require('../scripts/lib/werkstroom');

const TOKEN = 'proeftoken-' + Date.now();

function job() {
  const ronde = W.werkstromen().find(w => path.basename(w.bestand) === 'ronde.yml');
  assert.ok(ronde, 'ronde.yml is gelezen');
  const j = ronde.doc.jobs['registers-pr'];
  assert.ok(j, 'de job registers-pr bestaat');
  return j;
}

function opzet(registers) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rondepr-'));
  const git = (...a) => execFileSync('git', a, { cwd: path.join(map, 'repo'), encoding: 'utf8' });
  fs.mkdirSync(path.join(map, 'bin'));
  fs.writeFileSync(path.join(map, 'bin', 'gh'), '#!/bin/bash\necho "$*" >> "$GH_LOG"\n', { mode: 0o755 });
  execFileSync('git', ['init', '-q', '--bare', path.join(map, 'bare.git')]);
  fs.mkdirSync(path.join(map, 'repo'));
  git('init', '-q');
  git('config', 'user.email', 'proef@example.test'); git('config', 'user.name', 'proef');
  fs.writeFileSync(path.join(map, 'repo', 'IDEMPROEF.json'), '{}\n');
  git('add', '.'); git('commit', '-q', '-m', 'basis');
  fs.mkdirSync(path.join(map, 'repo', 'ronde-registers'));
  for (const [naam, inhoud] of Object.entries(registers))
    fs.writeFileSync(path.join(map, 'repo', 'ronde-registers', naam), inhoud);
  return { map, git };
}

function draai({ map, git }) {
  const stap = job().steps.find(s => s.run && /gh pr create/.test(s.run));
  assert.ok(stap, 'de stap die de PR opent');
  const log = path.join(map, 'gh.log');
  const r = spawnSync('bash', ['-e', '-c', stap.run], { cwd: path.join(map, 'repo'), encoding: 'utf8',
    env: { ...process.env, PATH: path.join(map, 'bin') + ':' + process.env.PATH, GH_LOG: log,
      GH_TOKEN: TOKEN, GITHUB_RUN_ID: '42', GITHUB_SHA: git('rev-parse', 'HEAD').trim(),
      GITHUB_REPOSITORY: 'o/r', RUN_URL: 'https://example.test/run',
      GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'url.' + path.join(map, 'bare.git') + '.insteadOf',
      GIT_CONFIG_VALUE_0: 'https://github.com/o/r.git' } });
  const gh = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
  const takken = execFileSync('git', ['branch', '--list'], { cwd: path.join(map, 'bare.git'), encoding: 'utf8' });
  return { status: r.status, uit: r.stdout + r.stderr, gh, takken,
    config: fs.readFileSync(path.join(map, 'repo', '.git', 'config'), 'utf8') };
}

test('1. een gewijzigd register wordt een concept-PR naar main, met de CI erbij', () => {
  const u = draai(opzet({ 'IDEMPROEF.json': '{"vers":true}\n' }));
  assert.equal(u.status, 0, u.uit);
  assert.match(u.takken, /ronde\/registers-42/);
  assert.match(u.gh, /^pr create --draft --base main --head ronde\/registers-42 /m);
  assert.match(u.gh, /^workflow run ci\.yml --ref ronde\/registers-42 -f verwachte_commit=[0-9a-f]{40}$/m);
  assert.doesNotMatch(u.gh, /\bmerge\b|--auto/, 'de ronde merget nooit zelf');
});

test('2. iets dat geen wortelregister is, laat het hele voorstel zakken', () => {
  for (const vreemd of ['db.json', 'NOTITIE.md', 'idemproef.json']) {
    const u = draai(opzet({ 'IDEMPROEF.json': '{"vers":true}\n', [vreemd]: 'x' }));
    assert.equal(u.status, 1, vreemd + ' had moeten zakken: ' + u.uit);
    assert.match(u.uit, new RegExp('hoort niet in een registervoorstel: ' + vreemd.replace('.', '\\.')));
    assert.equal(u.gh, '', 'er is niets aan gh gevraagd');
    assert.equal(u.takken.trim(), '', 'er is niets gepusht');
  }
});

test('3. geen verschil is geen voorstel', () => {
  const u = draai(opzet({ 'IDEMPROEF.json': '{}\n' }));
  assert.equal(u.status, 0, u.uit);
  assert.match(u.uit, /geen voorstel nodig/);
  assert.equal(u.gh, '');
});

test('4. het token komt nooit in .git/config, en schrijfrecht staat alleen op deze job', () => {
  const u = draai(opzet({ 'IDEMPROEF.json': '{"vers":true}\n' }));
  assert.equal(u.status, 0, u.uit);
  assert.ok(!u.config.includes(TOKEN), 'het token staat in .git/config');
  const j = job();
  assert.equal(j.permissions['contents'], 'write');
  const ronde = W.werkstromen().find(w => path.basename(w.bestand) === 'ronde.yml');
  assert.equal(ronde.doc.permissions.contents, 'read', 'de workflow zelf blijft alleen-lezen');
});
