'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const promotie = require('../scripts/lib/productie-promotie');
const { BRONNEN } = require('../scripts/lib/productie-vrijgave');
const extern = require('../server/config/external-release');
const { maakGetekendeVrijgave } = require('./foundation-vrijgave-fixture');

const COMMIT = 'a'.repeat(40);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function kandidaat(backup) {
  const teken = backup ? '6' : '5';
  const digest = 'sha256:' + teken.repeat(64);
  const tag = backup ? 'candidate-backup-' : 'candidate-';
  const verwijzing = 'ghcr.io/rtg/test:' + tag + COMMIT.slice(0, 12) + '-123';
  return { verwijzing, digest, immutable:verwijzing + '@' + digest,
    id:'sha256:' + (backup ? '8' : '7').repeat(64),
    bewijsBestandSha256:'9'.repeat(64), herkomstSha256:'b'.repeat(64),
    sbomSha256:'c'.repeat(64) };
}

function opstelling(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-promotie-'));
  t.after(() => fs.rmSync(root, { recursive:true, force:true }));
  maakGetekendeVrijgave(root, { commit:COMMIT });
  const bronnen = {};
  for (const [naam, rel] of Object.entries(BRONNEN)) {
    const pad = path.join(root, rel);
    if (!fs.existsSync(pad)) {
      fs.mkdirSync(path.dirname(pad), { recursive:true });
      fs.writeFileSync(pad, JSON.stringify({ naam, commit:COMMIT }) + '\n');
    }
    bronnen[naam] = { pad:rel, sha256:sha(fs.readFileSync(pad)) };
  }
  const image = kandidaat(false), backup = kandidaat(true);
  const status = { formaat:'rtg-production-status-v1', gemaakt:new Date().toISOString(),
    commit:COMMIT, release:'1.2.3', PRODUCTION_STATUS:'READY', blokkades:[], bronnen,
    externeVrijgave:extern.samenvatting(extern.controleerReleaseRoot(root, COMMIT)),
    kandidaatVrijgave:{ ok:true, commit:COMMIT, bewijsSha256:'d'.repeat(64), image, backup } };
  status.bewijsSha256 = sha(JSON.stringify(status));
  const statusPad = path.join(root, '.release', 'productie-status.json');
  fs.writeFileSync(statusPad, JSON.stringify(status) + '\n');
  const keys = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(path.join(root, promotie.REL.sleutel),
    keys.publicKey.export({ type:'spki', format:'pem' }));
  const document = { formaat:'rtg-productie-promotie-v1', gemaakt:new Date().toISOString(),
    commit:COMMIT, release:status.release, goedgekeurdDoor:'Release Authority', besluit:'CAB-123',
    productionStatus:{ pad:'.release/productie-status.json',
      sha256:sha(fs.readFileSync(statusPad)), bewijsSha256:status.bewijsSha256 },
    kandidaat:{ image:{ immutable:image.immutable, id:image.id, digest:image.digest,
      bewijsBestandSha256:image.bewijsBestandSha256 },
    backup:{ immutable:backup.immutable, id:backup.id, digest:backup.digest,
      herkomstSha256:backup.herkomstSha256 } }, bewijzen:promotie.bewijskaart(root),
    externeBewijzen:status.externeVrijgave.bewijsBestanden };
  const bytes = Buffer.from(JSON.stringify(document, null, 2) + '\n');
  fs.writeFileSync(path.join(root, promotie.REL.document), bytes);
  fs.writeFileSync(path.join(root, promotie.REL.handtekening),
    promotie.teken(bytes, keys.privateKey) + '\n');
  return { root, status, statusPad };
}

test('aparte Ed25519-promotie bindt READY, kandidaat en alle bewijsbytes', t => {
  const { root } = opstelling(t);
  const document = promotie.controleer(root, COMMIT);
  assert.equal(document.commit, COMMIT);
  assert.equal(Object.keys(document.bewijzen).length, Object.keys(BRONNEN).length);
  assert.equal(document.kandidaat.image.digest, 'sha256:' + '5'.repeat(64));
  assert.ok(document.externeBewijzen.some(b => b.controle === 'deploymentRollback'));
});

test('een zelf herschreven READY en bewijs-hash kan de release-authority niet nabootsen', t => {
  const { root, status, statusPad } = opstelling(t);
  const rel = BRONNEN.golive;
  fs.writeFileSync(path.join(root, rel), '{"verzonnen":"PASS"}\n');
  status.bronnen.golive.sha256 = sha(fs.readFileSync(path.join(root, rel)));
  delete status.bewijsSha256;
  status.bewijsSha256 = sha(JSON.stringify(status));
  fs.writeFileSync(statusPad, JSON.stringify(status) + '\n');
  assert.throws(() => promotie.controleer(root, COMMIT), /promotie hoort niet exact|READY/);
});

test('tamper, verkeerde signer en ontbrekende promotieartefacten falen gesloten', t => {
  let s = opstelling(t);
  fs.appendFileSync(path.join(s.root, promotie.REL.handtekening), 'x');
  assert.throws(() => promotie.controleer(s.root, COMMIT), /handtekening/);

  s = opstelling(t);
  const vreemd = crypto.generateKeyPairSync('ed25519').publicKey.export({ type:'spki', format:'pem' });
  fs.writeFileSync(path.join(s.root, promotie.REL.sleutel), vreemd);
  assert.throws(() => promotie.controleer(s.root, COMMIT), /handtekening/);

  s = opstelling(t);
  fs.rmSync(path.join(s.root, promotie.REL.document));
  assert.throws(() => promotie.controleer(s.root, COMMIT), /ontbreekt/);
});
