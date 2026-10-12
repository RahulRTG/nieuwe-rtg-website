/* De sandboxkwalificatie van Stripe Connect schrijft NOOIT een geslaagd verslag
   zonder echte invoer: geen sleutels, een livesleutel, of geen geverifieerde
   releasebinding betekent EXTERNAL EVIDENCE REQUIRED, uitgang 3, en geen
   bestand. Of de kwalificatie tegen een echte sandbox slaagt, kan deze toets
   per definitie niet zeggen -- dat is precies het externe bewijs dat ontbreekt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const kwal = require('../scripts/extern-bewijs-stripe-connect');
const { maakGetekendeVrijgave } = require('./foundation-vrijgave-fixture');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kwal-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const VOL = { STRIPE_SANDBOX_SECRET_KEY: 'sk_test_x', STRIPE_SANDBOX_CONNECT_ACCOUNT: 'acct_proef123',
  RTG_EVIDENCE_RC_URL: 'https://rc.voorbeeld.nl', RTG_EVIDENCE_RC_TOKEN: 't' };

test('zonder sandboxinvoer: uitgang 3, de woorden, en geen bestand', () => {
  const doel = path.join(__dirname, '..', '.release', 'external-evidence', kwal.NAAM);
  const er = fs.existsSync(doel);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(STRIPE_SANDBOX|RTG_EVIDENCE)/.test(k)));
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'extern-bewijs-stripe-connect.js')], { encoding: 'utf8', env });
  assert.equal(r.status, 3, r.stderr);
  assert.match(r.stderr, /EXTERNAL EVIDENCE REQUIRED/);
  assert.equal(fs.existsSync(doel), er, 'er is toch een verslag geschreven');
});

test('een livesleutel wordt geweigerd, en zonder releasebinding komt er niets', async () => {
  const uit = path.join(TMP, 'uit');
  await assert.rejects(kwal.main({ env: Object.assign({}, VOL, { STRIPE_SANDBOX_SECRET_KEY: 'sk_live_x' }), root: TMP, uit }),
    e => e.nodig && /sk_test_/.test(e.message));
  await assert.rejects(kwal.main({ env: VOL, root: TMP, uit }), e => e.nodig && /release-bewijs/.test(e.message));
  assert.equal(fs.existsSync(uit), false);
});

test('met een geverifieerde releasebinding en volledige invoer bindt hij aan commit en inhoudshash', () => {
  const root = path.join(TMP, 'rel');
  fs.mkdirSync(root);
  maakGetekendeVrijgave(root);
  const cfg = kwal.invoer(VOL, root);
  assert.equal(cfg.commit, 'a'.repeat(40));
  assert.match(cfg.inhoudSha256, /^[a-f0-9]{64}$/);
  /* En een bedrag buiten de grens is geen kwalificatie maar een betaling. */
  assert.throws(() => kwal.invoer(Object.assign({}, VOL, { RTG_EVIDENCE_MAX_MINOR: '50000' }), root), e => e.nodig);
});
