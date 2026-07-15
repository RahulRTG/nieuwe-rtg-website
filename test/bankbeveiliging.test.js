/* De bank-laag: tijd-veilige vergelijkingen, de TOTP-tweede factor op de
   backoffice en het inlog-auditlog.
   Draai: node --experimental-sqlite --test test/bankbeveiliging.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');
const { totpCode, totpOk } = require('../server/kern/totp');
const { veiligGelijk } = require('../server/kern/util');

const SECRET = 'JBSWY3DPEHPK3PXP'; // bekend RFC-testgeheim (base32)

test('totp: RFC 6238-codes, venster van een stap, en rommel wordt geweigerd', () => {
  // deterministisch: zelfde geheim + zelfde tijdvak = zelfde code
  const t = 1700000000000;
  const code = totpCode(SECRET, t, 30);
  assert.match(code, /^\d{6}$/);
  assert.equal(totpOk(SECRET, code, t), true);
  assert.equal(totpOk(SECRET, code, t + 30000), true, 'een stap drift mag');
  assert.equal(totpOk(SECRET, code, t + 90000), false, 'daarbuiten niet');
  assert.equal(totpOk(SECRET, '000000', t), totpCode(SECRET, t, 30) === '000000');
  assert.equal(totpOk(SECRET, 'abcdef', t), false);
  assert.equal(totpOk(SECRET, '', t), false);
});

test('veiligGelijk: klopt inhoudelijk en accepteert elke lengte', () => {
  assert.equal(veiligGelijk('RTG-OFFICE', 'RTG-OFFICE'), true);
  assert.equal(veiligGelijk('RTG-OFFICE', 'RTG-OFFICF'), false);
  assert.equal(veiligGelijk('kort', 'veel-langere-invoer-mag-gewoon'), false);
  assert.equal(veiligGelijk('', ''), true);
});

test('backoffice met 2FA aan: code alleen is niet genoeg; met authenticator-code wel; alles in het auditlog', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-2fa-'));
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', OFFICE_TOTP_SECRET: SECRET } });
  const api = async (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  });
  try {
    // zonder tweede factor: geweigerd, ook met de juiste code
    const zonder = await api('/api/office/login', { code: 'RTG-OFFICE' });
    assert.equal(zonder.status, 401);
    assert.match((await zonder.json()).error, /tweede factor/i);
    // met een verkeerde authenticator-code: geweigerd
    assert.equal((await api('/api/office/login', { code: 'RTG-OFFICE', totp: '000001' })).status, 401);
    // met de echte code van dit moment: binnen
    const goed = await api('/api/office/login', { code: 'RTG-OFFICE', totp: totpCode(SECRET) });
    assert.equal(goed.status, 200);
    const token = (await goed.json()).token;
    // het auditlog heeft de mislukte en de gelukte poging vastgelegd
    const log = (await (await api('/api/office/securitylog', {}, token)).json()).log;
    assert.ok(log.find(x => x.kanaal === 'office' && x.ok === true), 'gelukte inlog gelogd');
    assert.ok(log.find(x => x.ok === false), 'mislukte poging gelogd');
    // en gewone ledenlogins komen er ook in
    await api('/api/login', { username: 'Rahul', password: 'fout' });
    const log2 = (await (await api('/api/office/securitylog', {}, token)).json()).log;
    assert.ok(log2.find(x => x.kanaal === 'lid' && x.ok === false));
  } finally {
    try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
