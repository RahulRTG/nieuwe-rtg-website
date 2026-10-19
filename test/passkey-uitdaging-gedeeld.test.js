'use strict';
/* DE PASSKEY-UITDAGING OVERLEEFT EEN ANDER PROCES (X4, integrator 19 oktober
   2026).

   De uitdaging stond in een Map in het RAM van een proces
   (kern/webauthn-ceremonie.js). Na een herstart, of als /opties en /login op
   twee instances uitkomen, gaf de login 400 "De aanvraag is verlopen" -- bij
   meer dan een instance dus willekeurig. Nu staat hij in dezelfde opslag als de
   toesteluitdaging (een eigen collectie, kern/identiteit/toestellen.js): een
   tweede proces op dezelfde data vindt hem, en hij blijft eenmalig.

   De toets start proces A, vraagt een uitdaging, stopt A en rondt af op proces
   B met dezelfde data. Een echte authenticator is er niet; het bewijs is dat B
   de uitdaging KENT (dan volgt "onbekende passkey", 401) in plaats van hem
   kwijt te zijn (400 "verlopen"), en dat een tweede poging hem niet meer vindt. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');

const post = (base, pad, body) => fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('een uitdaging van proces A is op proces B te gebruiken, en een keer', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-passkeyproces-'));
  let a, b;
  try {
    a = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const o = await post(a.base, '/api/webauthn/opties', {});
    assert.equal(o.status, 200, JSON.stringify(o.body).slice(0, 160));
    assert.ok(o.body.ceremonie, 'een ceremonie');
    await stop(a); a = null;

    b = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const antwoord = { id: 'bestaatniet', rawId: 'bestaatniet', type: 'public-key', response: {} };
    const eerst = await post(b.base, '/api/webauthn/login', { ceremonie: o.body.ceremonie, antwoord });
    assert.doesNotMatch(String(eerst.body.error || ''), /verlopen/, 'proces B kent de uitdaging: ' + JSON.stringify(eerst.body));
    assert.equal(eerst.status, 401, 'onbekende passkey, geen verlopen aanvraag');
    const weer = await post(b.base, '/api/webauthn/login', { ceremonie: o.body.ceremonie, antwoord });
    assert.match(String(weer.body.error || ''), /verlopen/, 'en eenmalig: de tweede poging vindt hem niet meer');
  } finally {
    if (a) stop(a); if (b) stop(b);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
