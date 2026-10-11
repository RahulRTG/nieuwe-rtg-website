'use strict';
/* Gedeelde opstelling voor de artefactketen-toetsen: een wegwerpwortel met drie
   verschillende vaste ankers (deploy/*.pub) en de bijbehorende geheimen. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const trust = require('../../server/config/release-trust');

const COMMIT = 'a'.repeat(40);
const dig = c => 'sha256:' + c.repeat(64);

function wortel(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-artefact-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'deploy'));
  const env = {}, sleutels = {};
  for (const [naam, rol] of Object.entries(trust.ROLES)) {
    const k = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(path.join(root, rol.publicFile), k.publicKey.export({ type: 'spki', format: 'pem' }));
    env[rol.secret] = k.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    sleutels[naam] = k.privateKey;
  }
  return { root, env, sleutels };
}
const bouw = (c, extra) => ({ commit: COMMIT, run: 'run-' + c, digest: dig(c), backupDigest: dig(c === 'a' ? 'b' : String.fromCharCode(c.charCodeAt(0) + 1)),
  imageId: dig('1'), backupImageId: dig('2'), ...extra });
const test_ = (g, extra) => ({ commit: g.velden.commit, digest: g.velden.digest, backupDigest: g.velden.backupDigest,
  waargenomenDigest: g.velden.digest, waargenomenBackupDigest: g.velden.backupDigest, testBewijsSha256: 'c'.repeat(64),
  geslaagd: true, gebouwdRecord: g.hash, ...extra });

module.exports = { wortel, COMMIT, dig, bouw, test_ };
