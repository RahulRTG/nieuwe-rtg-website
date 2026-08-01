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

  /* EEN AANGENOMEN CODE IS OP. Deze test deed hier vroeger dezelfde code nog
     eens, om de klokdrift te bewijzen -- en dat SLAAGDE, want een code was
     binnen zijn venster onbeperkt herbruikbaar. Wie hem een keer zag (over een
     schouder, in een screenshot, via een phishing-pagina die hem doorspeelde)
     kon er zelf mee naar binnen. Dan is de tweede factor iets wat je WEET in
     plaats van iets wat je HEBT. RFC 6238 zegt met zoveel woorden dat het niet
     mag. */
  assert.equal(totpOk(SECRET, code, t), false, 'dezelfde code een tweede keer: nee');

  /* De klokdrift bewijzen we nu met een VERSE code op een ander geheim, zodat
     de eenmaligheid hierboven de meting niet in de weg zit. Een toestel dat een
     halve minuut voorloopt of achterloopt moet gewoon binnenkomen. */
  const ANDER = 'KRSXG5CTMVRXEZLU';
  const c2 = totpCode(ANDER, t, 30);
  assert.equal(totpOk(ANDER, c2, t + 30000), true, 'een stap drift mag');
  const c3 = totpCode(ANDER, t + 300000, 30);
  assert.equal(totpOk(ANDER, c3, t + 300000 + 90000), false, 'daarbuiten niet');

  assert.equal(totpOk(SECRET, 'abcdef', t), false);
  assert.equal(totpOk(SECRET, '', t), false);

  /* En een FOUTE code onthouden we niet: anders kon een aanvaller die de code
     van een ander raadt of afkijkt hem alvast "opbranden" voordat de eigenaar
     hem gebruikt -- een weigeringsaanval op de tweede factor. */
  const DERDE = 'MFRGGZDFMZTWQ2LK';
  const c4 = totpCode(DERDE, t, 30);
  const fout = c4 === '111111' ? '222222' : '111111';
  assert.equal(totpOk(DERDE, fout, t), false, 'een foute code wordt geweigerd');
  assert.equal(totpOk(DERDE, c4, t), true, 'en heeft de goede code niet opgebrand');
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
