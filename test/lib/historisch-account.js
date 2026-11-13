/* Expliciete historische betaalrechten voor regressieproeven. Geen registratie-
   bypass in productie: deze helper gebruikt accounts in een test-tempdirectory.
   Gebruik gewone HTTP-registratie wanneer juist nieuwe inschrijving wordt getest. */
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
module.exports = function historischAccount(dir, invoer) {
  const echt = fs.realpathSync(dir), tijdelijk = fs.realpathSync(os.tmpdir());
  assert.ok(echt.startsWith(tijdelijk + path.sep) && path.basename(echt).startsWith('rtg-'),
    'alleen een expliciete RTG-testmap onder os.tmpdir');
  const code = `
    const fs = require('node:fs');
    const x = JSON.parse(fs.readFileSync(0, 'utf8'));
    const accounts = require('./server/accounts');
    accounts.init();
    const u = accounts.createUserSync({ email: x.email, realName: x.name || 'Historisch lid',
      tier: x.tier || 'rtg', password: x.password || 'geheim123', phone: x.phone || null });
    accounts.saveMemberState(u.id, { geboren: '1990-01-01', invoices: [], trip: null,
      creatorCredit: 0, creatorLikes: 0, ...(x.memberState || {}) });
    accounts.checkpoint();
    process.stdout.write('ACCOUNT=' + JSON.stringify({ id: u.id, tier: u.tier }) + '\\n');
  `;
  const r = spawnSync(process.execPath, ['-e', code], {
    cwd: path.join(__dirname, '../..'), input: JSON.stringify(invoer),
    encoding: 'utf8', timeout: 30000,
    env: { ...process.env, RTG_DATA_DIR: echt, NODE_ENV: 'test', RTG_STORE: 'sqlite',
      DATABASE_URL: '', PG_URL: '', RTG_MAGNAAT_TEST: '1', RTG_KLOK: '' }
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const regel = r.stdout.split('\n').find(s => s.startsWith('ACCOUNT='));
  assert.ok(regel, r.stdout);
  return JSON.parse(regel.slice(8));
};
