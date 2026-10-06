/* ALLE ACTIETOKENFAMILIES TEGEN DE SESSIEDEUR (audit B-1, tweede ronde).

   De eerste toets (actietoken-geen-sessie) bewijst de oorspronkelijke 2FA-
   reproductie. Deze toets vraagt breder: kan ENIG actietoken, van welke familie
   ook, nog ergens voor een sessie doorgaan? Drie lagen, want ze vangen
   verschillende fouten:

   1. VORM. Elke familie heeft de body `<id>.<doel>.<exp>.<nonce>`. De body van
      een sessie is `<id>.<exp>.<uitgegeven>[...]`. Geen enkele familie, en geen
      aanvalsvorm daaromheen, mag door sessieDelen (de enige vormcontrole van
      verifyToken) als sessie worden gelezen. Met een CONTROLE dat een echte
      sessiebody wel doorkomt -- anders staat deze laag groen omdat hij alles weigert.
   2. UITGIFTE. Een doel dat zelf een getal is of een punt bevat zou in het
      exp-slot kunnen landen. Elk doel in de BRON moet aan doelGeldig voldoen, en
      issueActionToken weigert al het andere.
   3. HTTP. Een echt verify-email-actietoken als bearer op meerdere beschermde
      routes: nooit een sessie. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sessieDelen, doelGeldig } = require('../server/accounts/tokenvorm');
const { startServer, stop } = require('./helper');

const DOELEN = ['inlog2', 'verify-email', 'mailwissel', 'sso-overdracht'];
const TOEKOMST = String(Date.now() + 86400000);
const NONCE = 'AbCdEfGhIjKlMnOpQrStUv';

test('1. geen actietokenbody, in geen enkele vorm, is een sessiebody', () => {
  for (const doel of DOELEN) {
    assert.equal(sessieDelen(`42.${doel}.${TOEKOMST}.${NONCE}`), null, doel + ': standaardvorm');
    assert.equal(sessieDelen(`42.${doel}.${TOEKOMST}`), null, doel + ': zonder nonce (oude vorm)');
    assert.equal(sessieDelen(`42.${doel}.NaN.${NONCE}`), null, doel + ': exp NaN');
    assert.equal(sessieDelen(`42.${doel}.0.${NONCE}`), null, doel + ': exp nul');
    assert.equal(sessieDelen(`42.${doel}`), null, doel + ': kaal');
  }
  // aanvalsvormen rond de tijdvelden
  for (const kwaad of ['42.-1.5', '42.1e12.5', '42.0x10.5', '42. 5.5', '42.5.5 ', '42..5', '.5.5', '42.5.', '42.5.-1',
    '42.5.abc', '42.+5.5', '42.５.5', '42.5.5\n', '', '.', '..']) {
    assert.equal(sessieDelen(kwaad), null, JSON.stringify(kwaad));
  }
});

test('1b. CONTROLE: de echte sessievormen komen wel door', () => {
  const nu = String(Date.now());
  assert.ok(sessieDelen(`42.${TOEKOMST}.${nu}.abcdefghijkl`), 'vier delen (sid)');
  assert.ok(sessieDelen(`42.${TOEKOMST}.${nu}.abcdefghijkl.abcdef0123456789abcdef0123456789`), 'vijf delen (apparaat)');
  assert.ok(sessieDelen(`42.${TOEKOMST}.${nu}`), 'drie delen');
  assert.ok(sessieDelen(`42.${TOEKOMST}`), 'oud token zonder uitgegeven');
});

test('2. een doel kan nooit voor een tijdveld doorgaan', () => {
  for (const goed of DOELEN) assert.equal(doelGeldig(goed), true, goed);
  for (const kwaad of ['', '123', '1700000000000', 'a.b', '5.5', 'Inlog2', ' inlog2', 'inlog2 ', null, undefined, 12, {}, ['a'], 'a'.repeat(41)]) {
    assert.equal(doelGeldig(kwaad), false, JSON.stringify(kwaad));
  }
});

test('2b. elk doel dat de bron uitgeeft voldoet aan doelGeldig, en de uitgifte weigert de rest', () => {
  const wortel = path.join(__dirname, '..', 'server');
  const gezien = new Set();
  const loop = (map) => {
    for (const e of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') loop(p); continue; }
      if (!e.name.endsWith('.js')) continue;
      const bron = fs.readFileSync(p, 'utf8');
      for (const m of bron.matchAll(/issueActionToken\(\s*[^,()]+,\s*'([^']*)'/g)) gezien.add(m[1]);
      for (const m of bron.matchAll(/issueActionToken\(\s*[^,()]+,\s*([A-Z_]+)\s*,/g)) {
        const c = bron.match(new RegExp('const ' + m[1] + "\\s*=\\s*'([^']*)'"));
        assert.ok(c, p + ': het doel ' + m[1] + ' is geen leesbare constante -- verklaar hem hier of maak hem een letterlijke');
        gezien.add(c[1]);
      }
    }
  };
  loop(wortel);
  assert.ok(gezien.size >= 3, 'de scan vond te weinig doelen: ' + [...gezien].join(','));
  for (const d of gezien) assert.equal(doelGeldig(d), true, 'uitgegeven doel ' + JSON.stringify(d));
  const tokens = fs.readFileSync(path.join(wortel, 'accounts', 'tokens.js'), 'utf8');
  assert.match(tokens, /doelGeldig\(purpose\)\)\s*throw/, 'issueActionToken moet een ongeldig doel weigeren');
});

const post = (base) => async (pad, body, tok) => {
  const r = await fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  });
  return { status: r.status };
};
const get = (base) => async (pad, tok) => {
  const r = await fetch(base + pad + (pad.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(tok || ''), {
    headers: tok ? { Authorization: 'Bearer ' + tok } : {}
  });
  return { status: r.status };
};

test('3. een echt actietoken opent geen enkele beschermde deur', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const p = post(srv.base);
  const g = get(srv.base);
  try {
    const r = await fetch(srv.base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Familie Lid', email: 'familielid@x.nl', password: 'geheim123',
        geboortedatum: '1990-01-01', pasApp: 'rtg' })
    });
    const j = await r.json();
    const sessie = j.token;
    const m = String(j.devVerifyUrl || '').match(/[?&]verify=([^&]+)/);
    assert.ok(sessie && m, 'registreren leverde geen sessie en verify-link: ' + JSON.stringify(j).slice(0, 160));
    const actie = decodeURIComponent(m[1]);

    // controle: het sessietoken werkt op dezelfde deuren waar het actietoken niet mag
    assert.equal((await p('/api/auth/me', {}, sessie)).status, 200, 'sessietoken op /api/auth/me');
    assert.equal((await p('/api/auth/resend', {}, sessie)).status, 200, 'sessietoken op /api/auth/resend');

    for (const [naam, res] of [
      ['POST /api/auth/me', await p('/api/auth/me', {}, actie)],
      ['POST /api/auth/resend', await p('/api/auth/resend', {}, actie)],
      ['POST /api/auth/logout-all', await p('/api/auth/logout-all', {}, actie)],
      ['GET /api/office/doc (query-token)', await g('/api/office/doc?id=1', actie)],
      ['GET /api/office/stream (query-token)', await g('/api/office/stream', actie)]
    ]) {
      assert.ok(res.status === 401 || res.status === 403 || res.status === 404,
        naam + ': een actietoken gaf ' + res.status + ' en hoort geen sessie te zijn');
    }
  } finally { await stop(srv); }
});
