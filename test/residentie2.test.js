/* De Residence, samen spelen: uitdagen en accepteren in de juiste zaal,
   om de beurt spelen met een timing-nauwkeurigheid, een eerlijke uitslag
   zonder ranglijsten, de vragen van het huis aan het diner, en de
   huistelefoon die een lid in het huis uitnodigt. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const ECHT = 'Speels Testmens';

let srv, base, a, b;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-residentie2-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-RES2' } });
  base = srv.base;
  const reg = async (n) => {
    const u = (Date.now() + n).toString().slice(-8);
    const r = await api(base, '/api/auth/register', { name: ECHT + ' ' + n, email: 'sp' + n + u + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1992-01-01', tier: 'rtg', pasApp: 'rtg' });
    return { token: r.body.token };
  };
  a = await reg(1); b = await reg(2);
  const inA = await api(base, '/api/residentie/betreed', { kamer: 'golf' }, a.token);
  a.codenaam = inA.body.ik;
  const inB = await api(base, '/api/residentie/betreed', { kamer: 'golf' }, b.token);
  b.codenaam = inB.body.ik;
});
test.after(() => stop(srv && srv.child));

test('uitdagen: alleen het spel van de zaal, alleen wie er echt is', async () => {
  assert.equal((await api(base, '/api/residentie/spel/daag', { codenaam: b.codenaam, spel: 'darts' }, a.token)).status, 409, 'darts hoort in de bar');
  assert.equal((await api(base, '/api/residentie/spel/daag', { codenaam: 'Niemand X', spel: 'golf' }, a.token)).status, 404);
  const d = await api(base, '/api/residentie/spel/daag', { codenaam: b.codenaam, spel: 'golf' }, a.token);
  assert.equal(d.status, 200);
  assert.equal((await api(base, '/api/residentie/spel/antwoord', { ja: false }, b.token)).status, 200, 'afslaan mag altijd');
});

test('een potje midgetgolf: om de beurt, eerlijke uitslag, geen ranglijst', async () => {
  await api(base, '/api/residentie/spel/daag', { codenaam: b.codenaam, spel: 'golf' }, a.token);
  const ja = await api(base, '/api/residentie/spel/antwoord', { ja: true }, b.token);
  assert.equal(ja.status, 200);
  assert.equal(ja.body.potje.aanZet, a.codenaam);
  assert.ok(!JSON.stringify(ja.body).includes(ECHT), 'alleen codenamen in het potje');
  // de wereld speelt mee: bij de start treedt iedereen aan op de speelplek
  const st = await api(base, '/api/residentie/pols', {}, a.token);
  const mij = st.body.leden.find(l => l.codenaam === a.codenaam);
  assert.deepEqual([mij.dx, mij.dy], [1, 7], 'de speler staat op de afslagmat');
  assert.equal((await api(base, '/api/residentie/spel/zet', { kracht: 50 }, b.token)).status, 409, 'de ander is aan zet');
  let laatste = null;
  for (let ronde = 0; ronde < 3; ronde++) {
    const za = await api(base, '/api/residentie/spel/zet', { kracht: 95 }, a.token);
    assert.equal(za.status, 200); assert.equal(za.body.punt, 1, 'bijna raak is een slag');
    laatste = await api(base, '/api/residentie/spel/zet', { kracht: 10 }, b.token);
    assert.equal(laatste.status, 200); assert.equal(laatste.body.punt, 4);
  }
  assert.ok(laatste.body.uitslag, 'na drie holes elk valt de uitslag');
  assert.deepEqual(laatste.body.uitslag.stand, [3, 12]);
  assert.equal(laatste.body.uitslag.winnaar, 0, 'bij golf wint de laagste');
  assert.equal((await api(base, '/api/residentie/spel/zet', { kracht: 50 }, a.token)).status, 404, 'het potje is voorbij');
});

test('de vragen van het huis: alleen aan het diner, met een adempauze', async () => {
  assert.equal((await api(base, '/api/residentie/vraag', {}, a.token)).status, 409, 'niet op de golfbaan');
  await api(base, '/api/residentie/betreed', { kamer: 'restaurant' }, a.token);
  await api(base, '/api/residentie/betreed', { kamer: 'restaurant' }, b.token);
  const v = await api(base, '/api/residentie/vraag', {}, a.token);
  assert.equal(v.status, 200);
  assert.ok(v.body.tekst && v.body.tekst.includes('?'));
  assert.equal((await api(base, '/api/residentie/vraag', {}, b.token)).status, 429, 'even laten landen');
});

test('de huistelefoon: nodig een lid in het huis uit, echte namen nergens', async () => {
  const su = await api(base, '/api/residentie/suite', {}, a.token);
  await api(base, '/api/residentie/betreed', { kamer: su.body.suite.adres }, a.token);
  const h = await api(base, '/api/residentie/huis', {}, a.token);
  assert.equal(h.status, 200);
  assert.ok(h.body.leden.some(l => l.codenaam === b.codenaam));
  assert.ok(!JSON.stringify(h.body).includes(ECHT));
  assert.equal((await api(base, '/api/residentie/bel', { codenaam: b.codenaam }, a.token)).status, 200);
  assert.equal((await api(base, '/api/residentie/bel', { codenaam: 'Niemand X' }, a.token)).status, 404);
  const gast = (await api(base, '/api/login', { tier: 'guest' })).body.token;
  assert.equal((await api(base, '/api/residentie/bel', { codenaam: b.codenaam }, gast)).status, 403, 'gasten bellen niet');
});
