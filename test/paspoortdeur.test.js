/* DE DEUR VAN DE UNIVERSELE BODEM (server/kern/onvervreemdbaar.js), tegen een
   echte server.

   Het besluit van 27 september 2026 (SAMENLEVING.md, besluit 4c): een afspraak
   bij de gemeente, aangifte bij de overheid en een zorgintake delen gaan open
   voor een GRATIS account, maar pas nadat RTG het paspoort heeft gezien. De
   nulmeting (scripts/onvervreemdbaar.js) vond ze achter de pas.

   Wat hier vastligt, in de volgorde waarin het mis kan gaan:
     - een gratis account ZONDER paspoortcontrole blijft buiten, met een `hoe`
     - na de controle gaat de deur open (de handler antwoordt, geen 401/403)
     - een bezoeker zonder account blijft buiten
     - een betaalde pas merkt niets: geen nieuwe eis voor wie al binnenkwam
     - wat NIET onder het besluit valt (een aanslag betalen) blijft dicht

   Het tweede besluit (29 september 2026, SAMENLEVING.md par. 11.4) zette er
   drie deuren bij die een account BELOOFDEN en een pas VROEGEN: melden bij de
   stad, meepraten in een raadpleging en de intake van RTG Neiging. Zelfde deur,
   dus dezelfde vijf toetsen.

   Draai los: node --test test/paspoortdeur.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, keurLidGoed } = require('./helper');
const { maakPaspoortdeur } = require('../server/kern/onvervreemdbaar');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

const DEUREN = ['/api/gemeente/afspraak', '/api/overheid/aangifte', '/api/care/intake/deel',
  '/api/stad/melding', '/api/stad/raadpleging/reageer', '/api/neiging/intake'];
const DICHT = new Set([401, 403]);

let srv, base, seq = 0;

async function registreer(tier) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const r = await api(base, '/api/auth/register', { name: 'Proef Genoot', email: 'pd' + u + '@voorbeeld.nl',
    phone: '06' + u, password: 'geheim12345', geboortedatum: '1988-04-04', tier });
  assert.ok(r.body.token, 'registreren als ' + tier + ' leverde geen token: ' + JSON.stringify(r.body).slice(0, 120));
  return { token: r.body.token, codenaam: r.body.state.user.codename, tier: r.body.state.user.tier };
}

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-paspoortdeur-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' } });
  base = srv.base;
});
test.after(() => stop(srv && srv.child));

test('1. zonder idGeverifieerd weigert de deur te bestaan', () => {
  assert.throws(() => maakPaspoortdeur({}), /idGeverifieerd ontbreekt/);
});

test('2. een gratis account zonder paspoortcontrole blijft buiten, en hoort hoe het wel kan', async () => {
  const g = await registreer('guest');
  assert.equal(g.tier, 'guest');
  for (const pad of DEUREN) {
    const r = await api(base, pad, {}, g.token);
    assert.equal(r.status, 403, pad + ' liet een ongecontroleerd gratis account binnen');
    assert.match(r.body.error, /paspoort/, pad + ' zegt niet waar het op wacht');
    assert.ok(r.body.hoe, pad + ' weigert zonder te zeggen hoe het wel kan (SAM-04)');
  }
});

test('3. na de paspoortcontrole gaat de deur open voor een gratis account, zonder pas', async () => {
  const g = await registreer('guest');
  await keurLidGoed(base, g.token, g.codenaam);
  for (const pad of DEUREN) {
    const r = await api(base, pad, {}, g.token);
    assert.ok(!DICHT.has(r.status), pad + ' bleef dicht na de controle: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 120));
  }
  /* Wat NIET onder het besluit valt, blijft waar het was: een aanslag betalen
     is geld, en daarover is niets besloten. */
  const betaal = await api(base, '/api/overheid/aanslag/betaal', {}, g.token);
  assert.equal(betaal.status, 403, 'een aanslag betalen is mee opengegaan, en dat was niet het besluit');
});

test('4. een bezoeker zonder account blijft buiten', async () => {
  const r0 = await api(base, '/api/login', { tier: 'guest' });
  if (!r0.body.token) return;   // zonder demo-inlog bestaat deze bezoeker niet
  for (const pad of DEUREN) {
    const r = await api(base, pad, {}, r0.body.token);
    assert.equal(r.status, 403, pad + ' liet een bezoeker zonder account binnen');
    assert.match(r.body.error, /gratis account/);
  }
});

test('5. een betaalde pas merkt niets: geen nieuwe eis voor wie al binnenkwam', async () => {
  const p = await registreer('rtg');
  assert.equal(p.tier, 'rtg');
  for (const pad of DEUREN) {
    const r = await api(base, pad, {}, p.token);
    assert.ok(!DICHT.has(r.status), pad + ' weigert nu een RTG Pass zonder paspoortcontrole: ' + r.status);
  }
});
