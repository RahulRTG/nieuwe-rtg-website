/* De echte serverketen met de persoonlijke poort in afdwingstand: gewone
   ledenmutaties, de techniekdeur en /api/stream. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

let srv;
const OWNER = 'isolatie-eigenaar@x.nl';

async function post(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(srv.base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function logInAlsEigenaar() {
  const r = await post('/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' });
  assert.ok(r.body.token, JSON.stringify(r.body).slice(0, 200));
  return r.body.token;
}

async function openStream(token) {
  const ac = new AbortController();
  const res = await fetch(srv.base + '/api/stream?token=' + encodeURIComponent(token), { signal: ac.signal });
  assert.equal(res.status, 200, 'de nog niet geisoleerde sessie hoort te openen');
  const reader = res.body.getReader();
  let tekst = '';
  for (let i = 0; i < 5 && !tekst.includes('event: hello'); i++) {
    const deel = await reader.read();
    if (deel.done) break;
    tekst += Buffer.from(deel.value).toString();
  }
  assert.match(tekst, /event: hello/, 'de stream is volledig geregistreerd voor de zetting');
  return { ac, reader };
}

async function wachtDicht(reader) {
  const einde = (async () => {
    for (let i = 0; i < 5; i++) {
      const deel = await reader.read();
      if (deel.done) return true;
    }
    return false;
  })();
  return Promise.race([einde, new Promise(resolve => setTimeout(() => resolve(false), 3000))]);
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_OWNER_EMAIL: OWNER, RTG_ISOLATIE_AFDWINGEN: '1' } });
});
test.after(() => stop(srv && srv.child));

test('persoonlijke isolatie sluit HTTP, techniek en bestaande/nieuwe SSE terwijl de uitgang openblijft', async () => {
  const token = await logInAlsEigenaar();
  const stroom = await openStream(token);
  try {
    const zet = await post('/api/isolatie/mijn/zet', { drager: 'identiteit', naar: 'isolatie',
      reden: 'verdachte eigenaarssessie onmiddellijk containen' }, token);
    assert.equal(zet.status, 200, JSON.stringify(zet.body));
    assert.equal(await wachtDicht(stroom.reader), true,
      'een bestaande lokale verbinding hoort bij de zetting te sluiten, niet pas bij een volgende payload');

    const mutatie = await post('/api/notifications/read', {}, token);
    assert.equal(mutatie.status, 503);
    assert.equal(mutatie.body.as, 'isolatie');

    const techniek = await post('/api/techniek/functie', { alles: true, aan: false }, token);
    assert.equal(techniek.status, 503,
      '/api/techniek mag geen bypass zijn voor een geisoleerd eigenaar-account');
    assert.equal(techniek.body.as, 'isolatie');

    const uitgang = await post('/api/isolatie/mijn', {}, token);
    assert.equal(uitgang.status, 200, 'Mijn bescherming blijft bereikbaar; isolatie is geen val');

    const nieuw = await fetch(srv.base + '/api/stream?token=' + encodeURIComponent(token));
    assert.equal(nieuw.status, 503, 'dezelfde geisoleerde identiteit opent geen nieuwe stream');
    const lijf = await nieuw.json();
    assert.equal(lijf.reden, 'ISOLATIE_REALTIME_DICHT');
  } finally {
    try { stroom.ac.abort(); } catch (e) {}
  }
});
