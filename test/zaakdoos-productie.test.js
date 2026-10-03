/* DE EIGEN ZAAKDOOSSLEUTEL OP EEN ECHTE PRODUCTIESERVER (devices.zaakdoos_sleutel,
   besluit B12). De gedeelde sleutel opent daar niets (test/foundation-gezinstoken-
   productie.test.js toets 3); de eigen sleutel van een doos komt door de
   productiepoort, maar alleen voor zijn eigen zaak.

   Draai los: node --test test/zaakdoos-productie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, stopNet, kantoorAlsPersoon } = require('./helper');

const PROXY = { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' };
const SLEUTEL = 'd'.repeat(40);

/* De eigen sleutel in PRODUCTIE: uitgegeven op een testserver, daarna dezelfde
   opslag in productie gestart (uitgeven vraagt daar een eigenaar met passkey). */
test('echte productieserver: de eigen doossleutel komt door, alleen voor zijn eigen zaak', async t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doos-prod-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const KEYS = { RTG_ENC_KEY: 'k'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64) };
  const proef = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '', ...KEYS } });
  const eig = await kantoorAlsPersoon(proef.base);
  const r = await fetch(proef.base + '/api/office/doos/sleutel', { method: 'POST', body: JSON.stringify({ doos: 'proddoos', zaak: 'KIKUNOI' }),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + eig } });
  const sleutel = (await r.json()).sleutel;
  assert.equal(r.status, 200);
  await stopNet(proef.child);
  const { child, base } = await startServer({ env: { NODE_ENV: 'production', RTG_DEMO: '0', RTG_DATA_DIR: tmp,
    APP_URL: 'https://rtg.voorbeeld.test/', SMTP_URL: 'smtp://rtg:test@mail.voorbeeld.test:587',
    TURN_URL: 'turns:turn.rahultravelgroup.com:5349', TURN_SECRET: 'T9!relay-A7#tijdelijk-B4$geheim-C8%2026',
    ERR_WEBHOOK_URL: 'https://alarm.voorbeeld.test/rtg', ...KEYS, RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl',
    OFFICE_CODE: 'GEHEIME-CODE-123', OFFICE_TOTP_SECRET: 'JBSWY3DPEHPK3PXP', RTG_ISOLATIE_AFDWINGEN: '1',
    RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1', RTG_DOOS_SLEUTEL: SLEUTEL } });
  t.after(() => stop(child));
  const eigen = { ...PROXY, 'x-doos-id': 'proddoos', 'x-doos-eigen-sleutel': sleutel };
  const m = await fetch(base + '/api/doos/meting', { method: 'POST', headers: eigen, body: JSON.stringify({ doos: 'x', rtt: 1 }) });
  assert.equal(m.status, 200, 'de eigen sleutel werkt in productie');
  assert.equal((await fetch(base + '/api/doos/kloon?zaak=HOSHI', { headers: eigen })).status, 403, 'geen andere zaak');
  /* De eigen sleutel komt door de productiepoort (geen 503). De demozaak is in
     productie opgeruimd (kern/demostand.js), dus de kloon zegt dat de zaak weg
     is -- en geeft niets anders in de plaats. */
  const k = await fetch(base + '/api/doos/kloon', { headers: eigen });
  const kb = await k.json();
  assert.equal(k.status, 404, JSON.stringify(kb));
  assert.equal(kb.data, undefined);
});
