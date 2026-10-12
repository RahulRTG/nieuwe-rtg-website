/* DE SESSIESTROOM TAK VOOR TAK (server/kern/sessiestroom.js, met
   sessiestroom-kijk.js).

   Naast test/sessiestroom.test.js houdt dit bestand de randen vast, alleen
   met de mechaniek (geen server): de dienst start niet zonder crypto of
   zegelsleutel, weigert in productie zonder collectietransactie, valt
   daarbuiten terug op een eigen collectie, ruimt ingetrokken en misvormde
   rijen op, geeft geen ticket zonder een sleutel van precies 32 bytes, opent
   niets met een geknoeid of ingekort onderwerp of na een sleutelwissel, en een
   deurcontrole die gooit is een weigering. `kijk` leest een ticket zonder het
   te claimen, met dezelfde controles. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sessiestroom = require('../server/kern/sessiestroom');
const { maak, COLLECTIE, STANDAARD } = sessiestroom;

const A = 'SESSIE-A-' + 'x'.repeat(40);
const B = 'SESSIE-B-' + 'y'.repeat(40);

function wereld({ sleutel = crypto.randomBytes(32), metBewerk = true, gooi = false } = {}) {
  let klok = Date.parse('2026-10-12T09:00:00.000Z');
  let sl = sleutel;
  const nu = () => new Date(klok).toISOString();
  const opslag = {};
  const bewerkCollectie = (naam, werk) => {
    if (gooi) throw new Error('opslag weg');
    const k = JSON.parse(JSON.stringify(opslag[naam] || {}));
    const uit = werk(k); opslag[naam] = k; return uit;
  };
  const db = { data: {} };
  const dienst = maak({ db, crypto, nu, zegelSleutel: () => sl, productie: false,
    ...(metBewerk ? { bewerkCollectie } : {}) });
  const levend = new Set([A, B]);
  dienst.soort('lid', { geldig: raw => levend.has(raw) });
  dienst.soort('video', { geldig: (raw, bij) => levend.has(raw) && bij.startsWith('v'), metBij: true });
  return { dienst, opslag, db, levend, schuif: ms => { klok += ms; }, zetSleutel: k => { sl = k; } };
}
const rijen = (w, naam = 'lid') => (w.opslag[COLLECTIE] || w.db.data[COLLECTIE] || {})[naam] || [];

test('maak: zonder node:crypto of zegelsleutel start de dienst niet', () => {
  assert.throws(() => maak({ zegelSleutel: () => null }), /vereist node:crypto/);
  assert.throws(() => maak({ crypto: {}, zegelSleutel: () => null }), /vereist node:crypto/);
  assert.throws(() => maak({ crypto }), /vereist een zegelsleutel/);
  assert.throws(() => maak({ crypto, zegelSleutel: Buffer.alloc(32) }), /vereist een zegelsleutel/);
});

test('maak: de dienst is de actieve van dit proces, met zijn soorten en zijn collectie', () => {
  const w = wereld();
  assert.equal(sessiestroom.actief(), w.dienst);
  assert.deepEqual(w.dienst.soorten(), ['lid', 'video']);
  assert.equal(w.dienst.COLLECTIE, 'sessieStroomTickets');
  assert.deepEqual(STANDAARD, { geldigMs: 60000, maxGebruik: 1, maxOpen: 8 });
  assert.ok(Object.isFrozen(STANDAARD));
});

test('soort: een ongeldige naam, een dubbele soort of een soort zonder geldig() bestaat niet', () => {
  const w = wereld();
  for (const naam of ['', null, 'A', '1lid', 'l', 'lid_x', 'x'.repeat(32)])
    assert.throws(() => w.dienst.soort(naam, { geldig: () => true }), /ongeldige soortnaam/, String(naam));
  assert.throws(() => w.dienst.soort('lid', { geldig: () => true }), /soort lid bestaat al/);
  assert.throws(() => w.dienst.soort('kantoor'), /soort kantoor zonder geldig\(\)/);
  assert.throws(() => w.dienst.soort('zaak', { geldig: 'ja' }), /zonder geldig\(\)/);
  w.dienst.soort('zaak-2', { geldig: () => true });
  assert.ok(w.dienst.soorten().includes('zaak-2'));
});

test('geef: een lege sessie of een deurcontrole die gooit is een 401', async () => {
  const w = wereld();
  for (const raw of [null, undefined, '', '   '])
    assert.deepEqual(await w.dienst.geef('lid', raw), { status: 401, error: 'Deze sessie mag deze stroom niet openen.' }, String(raw));
  w.dienst.soort('stuk', { geldig: () => { throw new Error('kluis weg'); } });
  assert.equal((await w.dienst.geef('stuk', A)).status, 401);
  assert.equal((await w.dienst.geef(null, A)).status, 400);
  assert.equal((await w.dienst.geef('video', A, null)).status, 400, 'een onderwerp is verplicht');
  assert.equal((await w.dienst.geef('video', A, '   ')).status, 400);
});

test('geef en open: het onderwerp wordt getrimd en op 200 tekens begrensd, voor uitgifte en claim gelijk', async () => {
  const w = wereld();
  const bij = '  v' + 'k'.repeat(300) + '  ';
  const t = await w.dienst.geef('video', A, bij);
  assert.equal(t.ok, true);
  assert.equal(rijen(w, 'video')[0].onderwerp.bij, ('v' + 'k'.repeat(300)).slice(0, 200));
  assert.match(t.geldigTot, /^2026-10-12T09:01:00/);
  assert.deepEqual(await w.dienst.open('video', t.ticket, 'v' + 'k'.repeat(250)), { ok: true, token: A },
    'alles na teken 200 telt niet');
  const zonderBij = await w.dienst.geef('video', A, 'v1');
  assert.deepEqual(await w.dienst.open('video', zonderBij.ticket, null), { status: 401 });
});

test('geef: zonder sleutel van precies 32 bytes geen ticket', async () => {
  for (const sleutel of [null, crypto.randomBytes(16), 'k'.repeat(32), crypto.randomBytes(33)]) {
    const w = wereld({ sleutel });
    assert.deepEqual(await w.dienst.geef('lid', A), { status: 503, error: 'De stroom kan nu niet veilig worden geopend.' });
    assert.deepEqual(rijen(w), [], 'er staat niets in de opslag');
  }
});

test('open: een onbekende soort, een misvormd ticket of geen ticket opent niets', async () => {
  const w = wereld();
  const t = await w.dienst.geef('lid', A);
  assert.deepEqual(await w.dienst.open('bestaat-niet', t.ticket), { status: 401 });
  assert.deepEqual(await w.dienst.open(null, t.ticket), { status: 401 });
  for (const tk of [null, '', 'ST.kort', 'XX.' + '0'.repeat(32), t.ticket.toLowerCase() + 'z'])
    assert.deepEqual(await w.dienst.open('lid', tk), { status: 401 }, String(tk));
  assert.deepEqual(await w.dienst.open('lid', t.ticket), { ok: true, token: A }, 'het echte ticket staat er nog');
});

test('open: een deurcontrole die bij openen gooit is een weigering', async () => {
  const w = wereld();
  let stuk = false;
  w.dienst.soort('wankel', { geldig: raw => { if (stuk) throw new Error('weg'); return raw === A; } });
  const t = await w.dienst.geef('wankel', A);
  stuk = true;
  assert.deepEqual(await w.dienst.open('wankel', t.ticket), { status: 401 });
});

test('open: een opslag die gooit geeft 503, en kijk dan null', async () => {
  const w = wereld();
  const t = await w.dienst.geef('lid', A);
  const kapot = wereld({ gooi: true });
  assert.deepEqual(await kapot.dienst.open('lid', t.ticket), { status: 503 });
  assert.equal(await kapot.dienst.kijk(t.ticket), null);
  await assert.rejects(kapot.dienst.geef('lid', A), /opslag weg/);
});

test('open: een sleutelwissel na de uitgifte maakt de zegel onleesbaar', async () => {
  const w = wereld();
  const t = await w.dienst.geef('lid', A);
  w.zetSleutel(crypto.randomBytes(32));
  assert.deepEqual(await w.dienst.open('lid', t.ticket), { status: 401 });
  const u = await w.dienst.geef('lid', A);
  w.zetSleutel(null);
  assert.deepEqual(await w.dienst.open('lid', u.ticket), { status: 401 });
});

test('open: een geknoeid onderwerp opent niets -- ingekorte, ontbrekende of verplaatste zegel', async () => {
  const knoei = [
    o => { o.zegel = Buffer.alloc(20).toString('base64'); },        // te kort voor iv + tag
    o => { o.zegel = 12345; },                                     // geen tekst
    o => { delete o.zegel; },
    o => { o.sessie = 'niet-hex'; },
    o => { o.sessie = 'a'.repeat(64); },                           // andere sessie: AAD klopt niet
    o => { o.soort = 'video'; }                                     // een andere soort in het onderwerp
  ];
  for (const [i, fn] of knoei.entries()) {
    const w = wereld();
    const t = await w.dienst.geef('lid', A);
    fn(rijen(w)[0].onderwerp);
    assert.deepEqual(await w.dienst.open('lid', t.ticket), { status: 401 }, 'knoeigeval ' + i);
    assert.equal(await w.dienst.kijk(t.ticket), null, 'kijk ziet het ook, geval ' + i);
  }
});

test('transactie: ingetrokken en misvormde rijen verdwijnen bij de volgende handeling', async () => {
  const w = wereld();
  const t = await w.dienst.geef('lid', A);
  rijen(w)[0].ingetrokken_at = '2026-10-12T09:00:10.000Z';
  w.opslag[COLLECTIE].rommel = 'geen lijst';
  w.opslag[COLLECTIE].leeg = [];
  assert.deepEqual(await w.dienst.open('lid', t.ticket), { status: 401 }, 'een ingetrokken ticket opent niets');
  assert.deepEqual(Object.keys(w.opslag[COLLECTIE]), [], 'de opgeruimde kaart is leeg');
});

test('zonder collectietransactie: in productie een weigering, daarbuiten een eigen collectie', async () => {
  const echt = maak({ db: { data: {} }, crypto, zegelSleutel: () => crypto.randomBytes(32), productie: true });
  echt.soort('lid', { geldig: raw => raw === A });
  await assert.rejects(echt.geef('lid', A), /geen collectietransactie in productie/);
  /* Buiten productie (met de echte klok): de eigen collectie in db.data. */
  const w = wereld({ metBewerk: false });
  const t = await w.dienst.geef('lid', A);
  assert.equal(Array.isArray(w.db.data[COLLECTIE].lid), true);
  assert.deepEqual(await w.dienst.open('lid', t.ticket), { ok: true, token: A });
  const u = await w.dienst.geef('lid', B);
  assert.deepEqual(await w.dienst.open('lid', u.ticket), { ok: true, token: B }, 'de collectie wordt hergebruikt');
});

test('de standaard productiestand volgt NODE_ENV', async () => {
  const oud = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const d = maak({ db: { data: {} }, crypto, zegelSleutel: () => crypto.randomBytes(32) });
    d.soort('lid', { geldig: () => true });
    await assert.rejects(d.geef('lid', A), /in productie/);
    process.env.NODE_ENV = 'development';
    const e = maak({ db: { data: {} }, crypto, zegelSleutel: () => Buffer.alloc(32, 7) });
    e.soort('lid', { geldig: () => true });
    assert.equal((await e.geef('lid', A)).ok, true);
  } finally { if (oud === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oud; }
});

test('kijk: leest een ticket zonder het te claimen, met dezelfde controles als de claim', async () => {
  const w = wereld();
  const t = await w.dienst.geef('video', A, 'v9');
  assert.deepEqual(await w.dienst.kijk('  ' + t.ticket + '  '), { soort: 'video', token: A });
  assert.deepEqual(await w.dienst.kijk(t.ticket), { soort: 'video', token: A }, 'kijken claimt niets');
  assert.deepEqual(await w.dienst.open('video', t.ticket, 'v9'), { ok: true, token: A });
  assert.equal(await w.dienst.kijk(t.ticket), null, 'na de claim is het op');
  for (const tk of [null, undefined, '', 'onzin', 'ST.' + 'A'.repeat(32)])
    assert.equal(await w.dienst.kijk(tk), null, String(tk));
  const oud = await w.dienst.geef('lid', A);
  w.schuif(60001);
  assert.equal(await w.dienst.kijk(oud.ticket), null, 'een verlopen ticket opent ook de zekering niet');
});

test('kijk zonder soorten kent geen enkel ticket', async () => {
  const d = maak({ db: { data: {} }, crypto, zegelSleutel: () => crypto.randomBytes(32), bewerkCollectie: (n, w) => w({}) });
  assert.equal(await d.kijk('ST.' + '0'.repeat(32)), null);
  assert.deepEqual(d.soorten(), []);
});
