/* DE VASTE LINKBASIS: APP_URL, of een ECHTE openbare hostnaam uit RTG_DOMAINS.

   server/server.js nam het EERSTE element van RTG_DOMAINS als hostnaam voor de
   links in een e-mail. Die variabele draagt meestal codedomeinen
   (`auth,member`, server/opzet/routes.js), en dan stond er in een herstelmail
   'https://auth/apps/...': een link die nergens heen wijst, terwijl de
   installatie dacht haar eigen adres te kennen (lib/linkbasis.js vasteBasis).

   Draai los: node --test test/appurlvast.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { vasteBasis } = require('../server/lib/linkbasis');
const { startServer, stop } = require('./helper');
const fs = require('fs'), os = require('os'), path = require('path');

test('alleen APP_URL of een openbare hostnaam wordt de vaste basis', () => {
  assert.equal(vasteBasis({ APP_URL: 'https://rtg.nl/', RTG_DOMAINS: 'member' }), 'https://rtg.nl', 'APP_URL wint altijd');
  for (const codedomeinen of ['member,social', 'auth', 'https://member', ' member , zakelijk ', '-'])
    assert.equal(vasteBasis({ RTG_DOMAINS: codedomeinen }), null, codedomeinen + ' is geen adres');
  for (const geenOpenbaar of ['localhost', 'rtg.test', 'app.example.com', '10.0.0.4', '127.0.0.1:3000', 'intra.local'])
    assert.equal(vasteBasis({ RTG_DOMAINS: geenOpenbaar }), null, geenOpenbaar + ' is geen openbare hostnaam');
  assert.equal(vasteBasis({ RTG_DOMAINS: 'member,app.rtg.nl' }), 'https://app.rtg.nl', 'een codedomein ervoor telt niet mee');
  assert.equal(vasteBasis({ RTG_DOMAINS: 'https://RTG.nl:8443/pad' }), 'https://rtg.nl:8443', 'schema, poort en pad');
  assert.equal(vasteBasis({}), null);
});

test('op een echte server met codedomeinen in RTG_DOMAINS wijst de herstellink niet naar https://auth', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appurlvast-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, APP_URL: '', RTG_DEV_LINKS: '1',
    RTG_DOMAINS: 'auth,member,office,techniek' } });
  try {
    const r = await fetch(srv.base + '/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'roellie.i@gmail.com' }) });
    const b = await r.json();
    assert.equal(r.status, 200, JSON.stringify(b));
    assert.ok(b.devResetUrl, 'de toetsstand geeft de herstellink terug: ' + JSON.stringify(b));
    assert.ok(!/^https:\/\/auth\b/.test(b.devResetUrl), 'de link wijst naar een codedomein: ' + b.devResetUrl);
    assert.ok(b.devResetUrl.startsWith(srv.base), 'zonder vaste basis geldt de lokale kop: ' + b.devResetUrl);
  } finally { stop(srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});
