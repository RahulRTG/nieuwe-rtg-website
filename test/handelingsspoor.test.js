/* HET HANDELINGSSPOOR -- wie deed wat, wanneer.

   De AUDIT-kolom van de bewijsmatrix stond op 0 van 3987 routes: niet omdat de
   meter ontbrak, maar omdat er niets te meten viel. Deze laag legt elke
   geslaagde schrijfactie vast, geketend.

   WAT DEZE TOETS VOORAL BEWAAKT IS WAT ER NIET IN KOMT. Een auditlog dat de
   body bewaart, is een tweede onversleutelde kopie van alles wat er ooit is
   ingevuld -- op een plek die juist LANG bewaard blijft. Het verwerkingsregister
   zegt dat al over het inzagejournaal; hier geldt het dubbel. De toets die dat
   vastlegt is de belangrijkste van dit bestand.

   Draai los: node --test test/handelingsspoor.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');
const maakSpoor = require('../server/lib/handelingsspoor');
const keten = require('../server/lib/keten');

function maak(opts) {
  const db = { data: {} };
  let saves = 0;
  const spoor = maakSpoor(Object.assign({ db, save: () => { saves++; } }, opts || {}));
  return { spoor, db, saves: () => saves, rij: () => db.data.handelingLog || [] };
}

function nepReq({ methode = 'POST', pad = '/api/concern/nieuw', body = {}, sessie = { key: 'user-42' } } = {}) {
  return { method: methode, path: pad, url: pad, body, session: sessie };
}
function nepRes() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.verzonden = null;
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (l) => { res.verzonden = l; return res; };
  return res;
}
function doe(spoor, req, route) {
  const res = nepRes();
  spoor.middleware(req, res, () => route(req, res));
  return res;
}

test('een geslaagde schrijfactie laat een geketende regel na', () => {
  const o = maak();
  doe(o.spoor, nepReq({ body: { naam: 'RTG' } }), (q, r) => r.status(200).json({ ok: true }));

  const rij = o.rij();
  assert.equal(rij.length, 1);
  assert.equal(rij[0].wie, 'user-42');
  assert.equal(rij[0].methode, 'POST');
  assert.equal(rij[0].pad, '/api/concern/nieuw');
  assert.equal(rij[0].status, 200);
  assert.ok(rij[0].hash, 'geketend');
  assert.equal(o.saves(), 1, 'en weggeschreven');
});

/* ------------------------------------------------------------------------
   DE BELANGRIJKSTE TOETS VAN DIT BESTAND.
   ------------------------------------------------------------------------ */
test('DE BODY KOMT ER NOOIT IN -- alleen een afdruk', () => {
  const o = maak();
  const geheim = {
    naam: 'Jan Jansen',
    iban: 'NL62INGB0111177588',
    email: 'jan@voorbeeld.nl',
    aandoening: 'iets medisch',
    bericht: 'een heel persoonlijk bericht'
  };
  doe(o.spoor, nepReq({ body: geheim }), (q, r) => r.status(200).json({ ok: true }));

  const alles = JSON.stringify(o.rij());
  for (const waarde of Object.values(geheim)) {
    assert.ok(!alles.includes(waarde),
      'de waarde "' + waarde + '" hoort NIET in het handelingsspoor te staan');
  }
  assert.ok(o.rij()[0].afdruk, 'wel een afdruk, zodat twee gelijke handelingen herkenbaar zijn');
  assert.ok(o.rij()[0].afdruk.length <= 16, 'en die afdruk is een hash en geen inhoud');
});

test('dezelfde handeling geeft dezelfde afdruk, een andere niet', () => {
  const o = maak();
  doe(o.spoor, nepReq({ body: { naam: 'A' } }), (q, r) => r.status(200).json({ ok: true }));
  doe(o.spoor, nepReq({ body: { naam: 'A' } }), (q, r) => r.status(200).json({ ok: true }));
  doe(o.spoor, nepReq({ body: { naam: 'B' } }), (q, r) => r.status(200).json({ ok: true }));
  const [c, b, a] = o.rij();            // nieuwste eerst
  assert.equal(a.afdruk, b.afdruk, 'twee keer dezelfde handeling');
  assert.notEqual(a.afdruk, c.afdruk, 'een andere handeling');
});

test('een MISLUKTE schrijfactie komt er niet in -- er is niets veranderd', () => {
  const o = maak();
  doe(o.spoor, nepReq(), (q, r) => r.status(403).json({ error: 'nee' }));
  doe(o.spoor, nepReq(), (q, r) => r.status(503).json({ error: 'functie uit' }));
  doe(o.spoor, nepReq(), (q, r) => r.status(500).json({ error: 'stuk' }));
  assert.equal(o.rij().length, 0, 'alleen geslaagde handelingen horen in het spoor');
});

test('LEZEN laat geen spoor na -- anders is het een volglog en geen auditlog', () => {
  const o = maak();
  doe(o.spoor, nepReq({ methode: 'GET' }), (q, r) => r.status(200).json({ ok: true }));
  assert.equal(o.rij().length, 0);
});

test('bij de gedeelde kantoorcode staat er niemand, en dat is het eerlijke antwoord', () => {
  const o = maak();
  doe(o.spoor, nepReq({ pad: '/api/office/handelingen', sessie: null }),
    (q, r) => r.status(200).json({ ok: true }));
  assert.match(o.rij()[0].wie, /gedeelde code/,
    'liever "niemand aan te wijzen" dan een verzonnen naam');
});

test('sleutelen aan een regel breekt de keten aantoonbaar', () => {
  const o = maak();
  for (const n of ['a', 'b', 'c']) {
    doe(o.spoor, nepReq({ pad: '/api/x/' + n }), (q, r) => r.status(200).json({ ok: true }));
  }
  assert.equal(o.spoor.ketenstand().ok, true, 'ongemoeid is heel');

  // "dat pad heeft hij nooit aangeroepen"
  o.rij()[1].pad = '/api/iets/anders';
  const stand = o.spoor.ketenstand();
  assert.equal(stand.ok, false, 'een regel bijstellen HOORT op te vallen');
  assert.ok(stand.gebroken.length > 0);
});

test('een regel uit het midden weghalen valt op', () => {
  const o = maak();
  for (const n of ['a', 'b', 'c', 'd']) {
    doe(o.spoor, nepReq({ pad: '/api/x/' + n }), (q, r) => r.status(200).json({ ok: true }));
  }
  o.rij().splice(1, 1);
  assert.equal(o.spoor.ketenstand().ok, false);
});

test('een lid ziet zijn EIGEN handelingen en niet die van een ander', () => {
  const o = maak();
  doe(o.spoor, nepReq({ sessie: { key: 'user-1' }, pad: '/api/a' }), (q, r) => r.status(200).json({ ok: true }));
  doe(o.spoor, nepReq({ sessie: { key: 'user-2' }, pad: '/api/b' }), (q, r) => r.status(200).json({ ok: true }));

  const eigen = o.spoor.lijst({ over: 'user-1' });
  assert.equal(eigen.totaal, 1);
  assert.equal(eigen.regels[0].pad, '/api/a');
  assert.ok(!JSON.stringify(eigen.regels).includes('/api/b'), 'niets van een ander');
});

test('de ketenstand gaat over het HELE spoor, niet over de selectie', () => {
  const o = maak();
  doe(o.spoor, nepReq({ sessie: { key: 'user-1' } }), (q, r) => r.status(200).json({ ok: true }));
  doe(o.spoor, nepReq({ sessie: { key: 'user-2' } }), (q, r) => r.status(200).json({ ok: true }));
  o.rij()[0].pad = '/api/gesleuteld';        // een regel van user-2

  const vanEen = o.spoor.lijst({ over: 'user-1' });
  assert.equal(vanEen.keten.ok, false,
    'een filter mag niet bepalen of het bewijs klopt: de breuk hoort zichtbaar te blijven');
});

test('de ring loopt niet vol en snoeit de oudste', () => {
  const o = maak({ max: 5 });
  for (let i = 0; i < 30; i++) {
    doe(o.spoor, nepReq({ pad: '/api/x/' + i }), (q, r) => r.status(200).json({ ok: true }));
  }
  assert.ok(o.rij().length <= 5, 'begrensd, kreeg ' + o.rij().length);
  assert.equal(o.rij()[0].pad, '/api/x/29', 'de nieuwste staat er nog');
  assert.equal(keten.verifieer(o.rij()).gebroken.length, 0, 'snoeien breekt de keten niet');
});

test('een spoor van vóór deze voorziening gaat niet stuk', () => {
  const o = maak();
  o.db.data.handelingLog = [{ at: 'toen', wie: 'user-1', pad: '/api/oud' }];
  doe(o.spoor, nepReq(), (q, r) => r.status(200).json({ ok: true }));
  const stand = o.spoor.ketenstand();
  assert.equal(stand.gebroken.length, 0);
  assert.equal(stand.zonderKeten, 1, 'de oude regel wordt geteld, niet veroordeeld');
});

test('een journaalstoring houdt de handeling niet tegen', () => {
  const db = { data: {} };
  const spoor = maakSpoor({ db, save: () => { throw new Error('schijf vol'); } });
  const res = nepRes();
  spoor.middleware(nepReq(), res, () => res.status(200).json({ ok: true, id: 7 }));
  assert.equal(res.verzonden.id, 7, 'de gebruiker krijgt zijn antwoord, ook als het loggen faalt');
});
