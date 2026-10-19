'use strict';
/* DE POSTKEUZE WORDT BIJ DE VERZENDER AFGEDWONGEN (X3, integrator 19 oktober
   2026).

   Post van RTG (kern/identiteit/commercieel.js) legde de keuze van het lid
   netjes vast, maar `mag()` had geen enkele aanroeper: de nieuwsbrief van een
   zaak (routes/supplier/prplus.js) ging naar ELKE volger, terwijl "Post namens
   partners" standaard UIT staat. Volgen in De Salon is geen toestemming voor
   post (Telecommunicatiewet art. 11.7: vooraf opt-in). Nu:
     - alleen volgers met partners via e-mail aan krijgen de brief;
     - de zaak ziet hoeveel volgers geen toestemming gaven (een getal, geen namen);
     - trekt het lid de toestemming in, dan krijgt hij de volgende brief niet. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-postpoort-'));
const post = (pad, body, tok) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(() => { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de nieuwsbrief van een zaak gaat alleen naar volgers die partnerpost aanzetten', async () => {
  const zaak = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body;
  assert.ok(zaak.token, 'een zaaksessie');
  const code = zaak.state && zaak.state.supplier && zaak.state.supplier.code;
  const lid = async (n) => (await post('/api/auth/register', { name: 'Post ' + n, email: n + Date.now() + '@x.nl',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body;
  const ja = await lid('ja'), nee = await lid('nee');
  for (const l of [ja, nee]) assert.equal((await post('/api/salon/volg', { code }, l.token)).status, 200, 'volgen');
  assert.equal((await post('/api/mijn/post/zet', { soort: 'partners', kanalen: ['email'], bron: 'toets' }, ja.token)).status, 200);

  const r = await post('/api/supplier/pr/nieuwsbrief', { onderwerp: 'Nieuw op de kaart', tekst: 'Proef' }, zaak.token);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  assert.equal(r.body.verstuurd, 1, 'alleen het lid dat ja zei: ' + JSON.stringify(r.body));
  assert.ok(r.body.zonderToestemming >= 1, 'de zaak ziet hoeveel volgers geen toestemming gaven');
});
