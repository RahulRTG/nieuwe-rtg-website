/* De losse leverancierspagina's in de app: het RTG-reisbureau (samengestelde
   reizen aanvragen), RTG Verblijven (hotels/appartementen/villa's boeken via
   /api/verblijf) en RTG Uitgaan (bars/clubs/beachclubs, aanmelden via
   /api/event/rsvp). Draai: npm test */
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
function overNdagen(n) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }

let srv, base, lid;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisbureau-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Reiziger', email: 'r' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  lid = { token: reg.body.token };
});
test.after(() => stop(srv && srv.child));

test('1. het reisbureau toont reizen; alleen na inlog', async () => {
  assert.equal((await api(base, '/api/reisbureau', {}, null)).status, 401);
  const r = await api(base, '/api/reisbureau', {}, lid.token);
  assert.equal(r.status, 200);
  assert.ok(r.body.reizen.length >= 1, 'er staat minstens een reis klaar');
  const eerste = r.body.reizen[0];
  assert.ok(eerste.id && eerste.titel && eerste.prijs > 0, 'elke reis heeft een titel en nettoprijs');
});

test('2. een reis aanvragen landt als aanvraag; dubbel wordt geweigerd', async () => {
  const ov = await api(base, '/api/reisbureau', {}, lid.token);
  const id = ov.body.reizen[0].id;
  const boek = await api(base, '/api/reisbureau/boek', { tripId: id, personen: 2, vertrek: overNdagen(30) }, lid.token);
  assert.equal(boek.status, 200);
  assert.equal(boek.body.aanvraag.status, 'aangevraagd');
  assert.equal(boek.body.aanvraag.prijs.totaal, ov.body.reizen[0].prijs * 2);
  // dezelfde reis nog eens open aanvragen kan niet
  assert.equal((await api(base, '/api/reisbureau/boek', { tripId: id, personen: 1 }, lid.token)).status, 409);
  // onbekende reis
  assert.equal((await api(base, '/api/reisbureau/boek', { tripId: 'bestaat-niet' }, lid.token)).status, 404);
  const mijn = await api(base, '/api/reisbureau/mijn', {}, lid.token);
  assert.ok(mijn.body.aanvragen.some(a => a.tripId === id), 'de aanvraag staat bij mij');
});

test('3. RTG Verblijven toont huizen met kamers en boekt via /api/verblijf', async () => {
  assert.equal((await api(base, '/api/hotels', {}, null)).status, 401);
  const h = await api(base, '/api/hotels', {}, lid.token);
  assert.equal(h.status, 200);
  assert.ok(h.body.huizen.length >= 1, 'er is minstens een verblijf');
  const huis = h.body.huizen[0];
  assert.ok(huis.kamers.length >= 1 && huis.kamers[0].prijs > 0, 'elk huis heeft kamers met prijs');
  assert.ok(['hotel', 'apartment', 'villa'].includes(huis.soort), 'het soort klopt');
  const vb = await api(base, '/api/verblijf', { supplierCode: huis.code, roomId: huis.kamers[0].id,
    aankomst: overNdagen(5), vertrek: overNdagen(8), personen: 2 }, lid.token);
  assert.equal(vb.status, 200);
  assert.equal(vb.body.verblijf.status, 'aangevraagd');
});

test('4. RTG Uitgaan toont nachtadressen met avonden en meldt aan via /api/event/rsvp', async () => {
  assert.equal((await api(base, '/api/uitgaan', {}, null)).status, 401);
  const u = await api(base, '/api/uitgaan', {}, lid.token);
  assert.equal(u.status, 200);
  assert.ok(u.body.zaken.length >= 1, 'er is minstens een nachtadres met een avond');
  const zaak = u.body.zaken[0];
  assert.ok(['bar', 'club', 'beachclub'].includes(zaak.soort), 'het soort klopt');
  const ev = zaak.events[0];
  assert.ok(ev.id && ev.capaciteit > 0, 'de avond heeft een capaciteit');
  const rsvp = await api(base, '/api/event/rsvp', { supplierCode: zaak.code, eventId: ev.id, qty: 2 }, lid.token);
  assert.equal(rsvp.status, 200);
  assert.equal(rsvp.body.ok, true);
  // mijn avonden toont de aanmelding; afmelden haalt hem weg
  const mijn = await api(base, '/api/uitgaan/mijn', {}, lid.token);
  assert.ok(mijn.body.avonden.some(a => a.eventId === ev.id && a.supplierCode === zaak.code), 'de avond staat bij mij');
  const af = await api(base, '/api/event/rsvp/annuleer', { supplierCode: zaak.code, eventId: ev.id }, lid.token);
  assert.equal(af.status, 200);
  const mijn2 = await api(base, '/api/uitgaan/mijn', {}, lid.token);
  assert.ok(!mijn2.body.avonden.some(a => a.eventId === ev.id), 'na afmelden staat de avond niet meer bij mij');
});

test('5. een reisaanvraag intrekken; daarna kan dezelfde reis weer', async () => {
  const mijn = await api(base, '/api/reisbureau/mijn', {}, lid.token);
  const open = mijn.body.aanvragen.find(a => a.status === 'aangevraagd');
  assert.ok(open, 'er staat een open aanvraag (uit test 2)');
  const ann = await api(base, '/api/reisbureau/annuleer', { ref: open.ref }, lid.token);
  assert.equal(ann.status, 200);
  assert.equal(ann.body.aanvraag.status, 'geannuleerd');
  // onbekende ref
  assert.equal((await api(base, '/api/reisbureau/annuleer', { ref: 'RTG-R-XXXXXX' }, lid.token)).status, 404);
  // dezelfde reis mag nu weer aangevraagd worden
  const opnieuw = await api(base, '/api/reisbureau/boek', { tripId: open.tripId, personen: 2 }, lid.token);
  assert.equal(opnieuw.status, 200);
});

test('6. AI-reisadvies wijst een reis uit de catalogus aan (regel-fallback zonder sleutel)', async () => {
  const r = await api(base, '/api/reisbureau/advies', { wens: 'zon, zee en strand op een eiland' }, lid.token);
  assert.equal(r.status, 200);
  assert.ok(r.body.reis && r.body.reis.id, 'er komt een concrete reis terug');
  assert.ok(typeof r.body.reden === 'string' && r.body.reden.length, 'met een korte reden');
  const cat = await api(base, '/api/reisbureau', {}, lid.token);
  assert.ok(cat.body.reizen.some(x => x.id === r.body.reis.id), 'de aangeraden reis komt uit de catalogus');
});
