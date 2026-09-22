'use strict';
// Synthetic test keys only. Private keys never leave process memory.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const trust = require('../server/config/release-trust');
function trustFixture(root, supplied = {}) {
  fs.mkdirSync(path.join(root, 'deploy'), { recursive:true });
  const keys = {};
  for (const [name, entry] of Object.entries(trust.ROLES)) {
    const file = path.join(root, entry.publicFile);
    if (!supplied[name] && fs.existsSync(file)) continue;
    keys[name] = supplied[name] || crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(file, keys[name].publicKey.export({ type:'spki', format:'pem' }));
  }
  return keys;
}
module.exports = { trustFixture };
