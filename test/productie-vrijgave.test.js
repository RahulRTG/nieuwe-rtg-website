'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { BRONNEN, eisSchoneReleasebron, leesProductiestatus } = require('../scripts/lib/productie-vrijgave');
const extern = require('../server/config/external-release');
const { maakGetekendeVrijgave } = require('./foundation-vrijgave-fixture');

const sha = b => crypto.createHash('sha256').update(b).digest('hex');

test('READY wordt opnieuw aan alle ongewijzigde onderbewijzen gebonden', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ready-'));
  t.after(() => fs.rmSync(root, { recursive:true, force:true }));
  const commit = 'a'.repeat(40);
  maakGetekendeVrijgave(root, { commit });
  const bronnen = {};
  for (const [naam, rel] of Object.entries(BRONNEN)) {
    const pad = path.join(root, rel);
    if (!fs.existsSync(pad)) {
      fs.mkdirSync(path.dirname(pad), { recursive: true });
      fs.writeFileSync(pad, JSON.stringify({ naam, commit }) + '\n');
    }
    bronnen[naam] = { pad: rel, sha256: sha(fs.readFileSync(pad)) };
  }
  const rapport = { formaat: 'rtg-production-status-v1', gemaakt: new Date().toISOString(),
    commit, PRODUCTION_STATUS: 'READY', blokkades: [], bronnen,
    externeVrijgave:extern.samenvatting(extern.controleerReleaseRoot(root, commit)) };
  rapport.bewijsSha256 = sha(JSON.stringify(rapport));
  fs.writeFileSync(path.join(root, '.release', 'productie-status.json'), JSON.stringify(rapport));
  assert.equal(leesProductiestatus(commit, root).PRODUCTION_STATUS, 'READY');
  fs.appendFileSync(path.join(root, BRONNEN.pg), 'gewijzigd');
  assert.throws(() => leesProductiestatus(commit, root), /wijzigde na de READY-uitspraak/);
});

test('signature, vertrouwenssleutel en externe bewijsbytes blijven na READY exact gepind', t => {
  const opstelling = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ready-extern-'));
    t.after(() => fs.rmSync(root, { recursive:true, force:true }));
    const commit = 'a'.repeat(40);
    maakGetekendeVrijgave(root, { commit });
    const bronnen = {};
    for (const [naam, rel] of Object.entries(BRONNEN)) {
      const pad = path.join(root, rel);
      if (!fs.existsSync(pad)) {
        fs.mkdirSync(path.dirname(pad), { recursive:true });
        fs.writeFileSync(pad, JSON.stringify({ naam, commit }) + '\n');
      }
      bronnen[naam] = { pad:rel, sha256:sha(fs.readFileSync(pad)) };
    }
    const rapport = { formaat:'rtg-production-status-v1', gemaakt:new Date().toISOString(),
      commit, PRODUCTION_STATUS:'READY', blokkades:[], bronnen,
      externeVrijgave:extern.samenvatting(extern.controleerReleaseRoot(root, commit)) };
    rapport.bewijsSha256 = sha(JSON.stringify(rapport));
    fs.writeFileSync(path.join(root, '.release', 'productie-status.json'), JSON.stringify(rapport));
    assert.equal(leesProductiestatus(commit, root).PRODUCTION_STATUS, 'READY');
    return { root, commit };
  };

  let s = opstelling();
  fs.appendFileSync(path.join(s.root, '.release', 'external-release.sig'), 'x');
  assert.throws(() => leesProductiestatus(s.commit, s.root), /Bewijsbron wijzigde|externe dossier/);

  s = opstelling();
  fs.appendFileSync(path.join(s.root, '.release', 'external-evidence', 'webhook-delivery.bewijs'), 'x');
  assert.throws(() => leesProductiestatus(s.commit, s.root), /externe dossier|bewijsbestand/);

  s = opstelling();
  fs.writeFileSync(path.join(s.root, 'deploy', 'release-sleutel.pub'), 'geen sleutel\n');
  assert.throws(() => leesProductiestatus(s.commit, s.root), /externe dossier/);
});

test('alleen de actuele getrackte SUITE-uitvoer mag naast een schone HEAD bestaan', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bronpoort-'));
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  try {
    assert.equal(git('init', '--quiet').status, 0);
    assert.equal(git('config', 'user.email', 'release@test.invalid').status, 0);
    assert.equal(git('config', 'user.name', 'Release Test').status, 0);
    fs.writeFileSync(path.join(root, 'SUITE.json'), '{"oud":true}\n');
    fs.writeFileSync(path.join(root, 'notitie.txt'), 'vast\n');
    assert.equal(git('add', 'SUITE.json', 'notitie.txt').status, 0);
    assert.equal(git('commit', '--quiet', '-m', 'basis').status, 0);
    fs.writeFileSync(path.join(root, 'SUITE.json'), '{"actueel":true}\n');
    assert.match(eisSchoneReleasebron(root), /^[a-f0-9]{40}$/,
      'de apart gepinde suite-uitvoer blokkeert de kandidaat niet');
    fs.appendFileSync(path.join(root, 'notitie.txt'), 'onbekende wijziging\n');
    assert.throws(() => eisSchoneReleasebron(root), /notitie\.txt/,
      'een willekeurige niet-codewijziging mag niet meeliften op de bewijsuitzondering');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
