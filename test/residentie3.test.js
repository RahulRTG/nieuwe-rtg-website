/* De Residence, het paar en de directeur: samen "vast" wandelen (verzoek,
   volgen bij stap en kamerwissel, losmaken), koppel tegen koppel spelen
   (2 tegen 2 met teamstand) en Rahul, de directeur, die het vragenspel
   overneemt -- gewaagd alleen voor een paar dat prive in de suite zit.
   Alles op codenaam. Draai: npm test */
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
const ECHT = 'Verliefd Testduo';

let srv, base, a, b, c, d;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-residentie3-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-RES3' } });
  base = srv.base;
  const reg = async (n) => {
    const u = (Date.now() + n).toString().slice(-8);
    const r = await api(base, '/api/auth/register', { name: ECHT + ' ' + n, email: 'duo' + n + u + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1993-01-01', tier: 'rtg', pasApp: 'rtg' });
    return { token: r.body.token };
  };
  [a, b, c, d] = [await reg(1), await reg(2), await reg(3), await reg(4)];
  for (const wie of [a, b, c, d]) {
    const r = await api(base, '/api/residentie/betreed', { kamer: 'golf' }, wie.token);
    wie.codenaam = r.body.ik;
  }
});
test.after(() => stop(srv && srv.child));

async function koppel(x, y) {
  await api(base, '/api/residentie/paar/vraag', { codenaam: y.codenaam }, x.token);
  return api(base, '/api/residentie/paar/antwoord', { ja: true }, y.token);
}

test('het paar: verzoek en ja, volgen bij een stap en bij een kamerwissel', async () => {
  assert.equal((await api(base, '/api/residentie/paar/antwoord', { ja: true }, b.token)).status, 404, 'zonder verzoek geen paar');
  const ja = await koppel(a, b);
  assert.equal(ja.status, 200); assert.equal(ja.body.paar, a.codenaam);
  const st = await api(base, '/api/residentie/pols', {}, a.token);
  assert.equal(st.body.paar, b.codenaam);
  assert.ok(st.body.kamer.paren.some(p2 => p2.includes(a.codenaam) && p2.includes(b.codenaam)), 'het paar staat in de kamerstaat');
  // een stap: de partner komt op de tegel die u verliet
  const voor = st.body.leden.find(l => l.codenaam === a.codenaam);
  await api(base, '/api/residentie/stap', { x: 4, y: 6 }, a.token);
  const na = await api(base, '/api/residentie/pols', {}, b.token);
  const partner = na.body.leden.find(l => l.codenaam === b.codenaam);
  assert.deepEqual([partner.dx, partner.dy], [voor.dx, voor.dy], 'de partner volgt op uw oude tegel');
  // een kamerwissel: de partner wandelt mee
  await api(base, '/api/residentie/betreed', { kamer: 'bar' }, a.token);
  const inBar = await api(base, '/api/residentie/pols', {}, b.token);
  assert.equal(inBar.body.kamer.id, 'bar', 'de partner is meegenomen naar de bar');
  await api(base, '/api/residentie/betreed', { kamer: 'golf' }, a.token);
});

test('koppel tegen koppel: 2 tegen 2 met een teamstand', async () => {
  await koppel(c, d);
  const daag = await api(base, '/api/residentie/spel/daag', { codenaam: c.codenaam, spel: 'golf' }, a.token);
  assert.equal(daag.status, 200); assert.equal(daag.body.teams, true, 'twee paren = twee teams');
  const ja = await api(base, '/api/residentie/spel/antwoord', { ja: true }, c.token);
  assert.equal(ja.body.potje.spelers.length, 4);
  assert.ok(!JSON.stringify(ja.body).includes(ECHT));
  // beurtvolgorde: a, c, b, d -- drie rondes lang
  let laatste = null;
  for (let r = 0; r < 3; r++) {
    for (const [wie, kracht] of [[a, 95], [c, 10], [b, 95], [d, 10]]) {
      laatste = await api(base, '/api/residentie/spel/zet', { kracht }, wie.token);
      assert.equal(laatste.status, 200, wie.codenaam + ' is aan zet');
    }
  }
  assert.ok(laatste.body.uitslag);
  assert.deepEqual(laatste.body.uitslag.stand, [6, 24], 'teamsom per kant');
  assert.equal(laatste.body.uitslag.winnaar, 0, 'het laagste team wint bij golf');
  assert.ok(laatste.body.uitslag.teams[0].includes(' & '), 'teamnamen als paar');
});

test('Rahul, de directeur: gewaagd alleen prive met het eigen paar in de suite', async () => {
  // het paar a+b naar de eigen suite van a: alleen met zijn tweeen
  const su = await api(base, '/api/residentie/suite', {}, a.token);
  await api(base, '/api/residentie/betreed', { kamer: su.body.suite.adres }, a.token);
  const v1 = await api(base, '/api/residentie/vraag', {}, a.token);
  assert.equal(v1.status, 200);
  assert.equal(v1.body.van, 'rahul', 'prive met het paar is de directeur de gastheer');
  assert.ok(['intiem', 'ongemakkelijk', 'traan', 'gewaagd'].includes(v1.body.niveau));
  assert.ok(v1.body.intro && v1.body.tekst.includes('?'));
  // in het restaurant zonder paar-privacy: de gewone vraag van het huis
  await api(base, '/api/residentie/betreed', { kamer: 'restaurant' }, c.token);
  const v2 = await api(base, '/api/residentie/vraag', {}, c.token);
  assert.equal(v2.status, 200);
  assert.equal(v2.body.van, 'huis', 'de eerste restaurantvraag is gewoon van het huis');
  assert.ok(v2.body.niveau && v2.body.niveau !== 'gewaagd', 'huis-vragen hebben een genre, nooit gewaagd');
});

test('losmaken en de schone staat erna', async () => {
  assert.equal((await api(base, '/api/residentie/paar/los', {}, a.token)).status, 200);
  const st = await api(base, '/api/residentie/pols', {}, a.token);
  assert.equal(st.body.paar, null);
  assert.equal((await api(base, '/api/residentie/paar/los', {}, a.token)).status, 404, 'twee keer losmaken kan niet');
  // wie het huis verlaat, is het paar ook kwijt (c en d zijn nog gekoppeld)
  await api(base, '/api/residentie/weg', {}, c.token);
  await api(base, '/api/residentie/betreed', { kamer: 'golf' }, d.token);
  assert.equal((await api(base, '/api/residentie/pols', {}, d.token)).body.paar, null, 'het huis uit = het paar los');
});
