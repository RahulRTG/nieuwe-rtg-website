/* De idem-poort: dezelfde opdracht twee keer sturen mag nooit twee keer werken.

   Deze toets draait op de middleware zelf, met een nagebootst verzoek/antwoord.
   Dat is met opzet: de poort is een regel over herhalingen en niet over een
   route, en zo is elke tak los aan te wijzen -- ook de takken die je met een
   echte server bijna niet kunt afdwingen (twee gelijktijdige verzoeken die
   elkaar in de vlucht tegenkomen, en het verlopen van een sleutel).

   Wat hier bewust WEL wordt getoetst en makkelijk vergeten wordt: dat een
   MISLUKT antwoord niet bewaard wordt. Dat is de regel waarmee deze laag staat
   of valt -- zou hij een fout bewaren, dan krijgt de retry waar idem-sleutels
   voor bestaan een oude fout terug en probeert het nooit meer echt. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');

const maakIdemPoort = require('../server/lib/idem-poort');

/* Een verzoek/antwoord-paar dat net genoeg van Express nabootst. */
function nepReq({ methode = 'POST', pad = '/api/concern/nieuw', body = {}, auth = 'Bearer lid-a', kop = {} } = {}) {
  const koppen = Object.assign({ authorization: auth }, kop);
  return {
    method: methode,
    path: pad,
    url: pad,
    ip: '10.0.0.1',
    body,
    get(n) { return koppen[String(n).toLowerCase()]; }
  };
}

function nepRes() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.verzonden = null;
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (lijf) => { res.verzonden = lijf; res.emit('finish'); return res; };
  return res;
}

/* Draai een verzoek door de poort heen naar een route die telt hoe vaak hij
   echt is aangeroepen. `route` mag asynchroon zijn. */
function doe(poort, req, route) {
  const res = nepRes();
  return new Promise((klaar) => {
    const next = () => {
      Promise.resolve(route(req, res)).then(() => klaar({ res, doorgelaten: true }));
    };
    const uit = poort(req, res, next);
    // de poort antwoordde zelf (herhaling of 409): dan is next nooit geroepen
    if (uit && typeof uit.then === 'function') uit.then(() => klaar({ res, doorgelaten: false }));
    else if (res.verzonden !== null) klaar({ res, doorgelaten: false });
  });
}

test('zonder sleutel verandert er niets: elk verzoek doet gewoon het werk', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, id: 'concern-' + keer }); };

  const a = await doe(poort, nepReq({ body: { naam: 'RTG' } }), route);
  const b = await doe(poort, nepReq({ body: { naam: 'RTG' } }), route);

  assert.equal(keer, 2, 'zonder sleutel hoort de route twee keer te draaien');
  assert.equal(a.res.verzonden.id, 'concern-1');
  assert.equal(b.res.verzonden.id, 'concern-2');
  assert.ok(!b.res.verzonden.herhaald, 'zonder sleutel is er niets om te herhalen');
});

test('dezelfde sleutel doet het werk EEN keer en herhaalt daarna het antwoord', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, id: 'concern-' + keer }); };
  const lijf = { naam: 'RTG', idem: 'sleutel-1' };

  const a = await doe(poort, nepReq({ body: lijf }), route);
  const b = await doe(poort, nepReq({ body: lijf }), route);

  assert.equal(keer, 1, 'de herhaling mag de route NIET opnieuw draaien');
  assert.equal(a.res.verzonden.id, 'concern-1');
  assert.equal(b.res.verzonden.id, 'concern-1', 'de herhaling geeft hetzelfde antwoord');
  assert.equal(b.res.verzonden.herhaald, true, 'en draagt het merk van de idem-laag');
  assert.ok(!a.res.verzonden.herhaald, 'het eerste antwoord is geen herhaling');
});

test('de Idempotency-Key header werkt net zo goed als de body', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, id: keer }); };
  const kop = { 'idempotency-key': 'via-de-header' };

  await doe(poort, nepReq({ body: { naam: 'RTG' }, kop }), route);
  const b = await doe(poort, nepReq({ body: { naam: 'RTG' }, kop }), route);

  assert.equal(keer, 1);
  assert.equal(b.res.verzonden.herhaald, true);
});

test('een verse sleutel doet het werk WEL opnieuw -- anders is het geen idempotentie maar een slot', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, id: 'concern-' + keer }); };

  await doe(poort, nepReq({ body: { naam: 'RTG', idem: 'k1' } }), route);
  const c = await doe(poort, nepReq({ body: { naam: 'RTG', idem: 'k2' } }), route);

  assert.equal(keer, 2, 'een NIEUWE opdracht met een verse sleutel hoort gewoon te werken');
  assert.equal(c.res.verzonden.id, 'concern-2');
});

test('dezelfde sleutel met een ANDER verzoek is een 409 en geen stille herhaling', async () => {
  const poort = maakIdemPoort();
  const route = (req, res) => res.status(200).json({ ok: true, naam: req.body.naam });

  await doe(poort, nepReq({ body: { naam: 'RTG', idem: 'k1' } }), route);
  const b = await doe(poort, nepReq({ body: { naam: 'IETS ANDERS', idem: 'k1' } }), route);

  assert.equal(b.res.statusCode, 409);
  assert.match(b.res.verzonden.error, /al gebruikt voor een ander verzoek/);
  assert.notEqual(b.res.verzonden.naam, 'RTG', 'nooit stil het oude antwoord teruggeven');
});

test('vrije tekst is geen ander verzoek: een andere notitie mag geen 409 geven', async () => {
  const poort = maakIdemPoort();
  const route = (req, res) => res.status(200).json({ ok: true, id: 1 });

  await doe(poort, nepReq({ body: { naam: 'RTG', notitie: 'eerste poging', idem: 'k1' } }), route);
  const b = await doe(poort, nepReq({ body: { naam: 'RTG', notitie: 'tweede poging', idem: 'k1' } }), route);

  assert.equal(b.res.statusCode, 200);
  assert.equal(b.res.verzonden.herhaald, true);
});

test('een MISLUKT antwoord wordt niet bewaard: de retry mag het echt opnieuw doen', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => {
    keer++;
    if (keer === 1) return res.status(500).json({ error: 'even niet' });
    res.status(200).json({ ok: true, id: 'gelukt-bij-poging-' + keer });
  };
  const lijf = { naam: 'RTG', idem: 'k1' };

  const a = await doe(poort, nepReq({ body: lijf }), route);
  const b = await doe(poort, nepReq({ body: lijf }), route);

  assert.equal(a.res.statusCode, 500);
  assert.equal(keer, 2, 'na een mislukking hoort de retry de route WEL te bereiken');
  assert.equal(b.res.verzonden.id, 'gelukt-bij-poging-2');
});

test('een 200 met ok:false telt als mislukking -- zelfde regel als de geldlaag', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => {
    keer++;
    if (keer === 1) return res.status(200).json({ ok: false, reden: 'saldo ontoereikend' });
    res.status(200).json({ ok: true, id: 2 });
  };
  const lijf = { bedrag: 5, idem: 'k1' };

  await doe(poort, nepReq({ body: lijf }), route);
  await doe(poort, nepReq({ body: lijf }), route);

  assert.equal(keer, 2, 'ok:false in een 200 mag niet bewaard worden');
});

test('twee gelijktijdige dubbeltikken: de tweede wacht en doet het werk niet nog eens', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  let laatDoor;
  const traag = new Promise(r => { laatDoor = r; });
  const route = async (req, res) => {
    keer++;
    await traag;                                  // echte I/O: hier past een tweede verzoek doorheen
    res.status(200).json({ ok: true, id: 'concern-' + keer });
  };
  const lijf = { naam: 'RTG', idem: 'k1' };

  const a = doe(poort, nepReq({ body: lijf }), route);
  const b = doe(poort, nepReq({ body: lijf }), route);
  laatDoor();
  const [ra, rb] = await Promise.all([a, b]);

  assert.equal(keer, 1, 'de tweede tik mag de route niet ook draaien');
  assert.equal(ra.res.verzonden.id, 'concern-1');
  assert.equal(rb.res.verzonden.id, 'concern-1');
  assert.equal(rb.res.verzonden.herhaald, true);
});

test('de sleutel van iemand anders geeft NOOIT jouw antwoord', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, van: req.get('authorization') }); };
  const lijf = { naam: 'RTG', idem: 'geraden-sleutel' };

  const a = await doe(poort, nepReq({ body: lijf, auth: 'Bearer lid-a' }), route);
  const b = await doe(poort, nepReq({ body: lijf, auth: 'Bearer lid-b' }), route);

  assert.equal(keer, 2, 'dezelfde sleutel van een ander is een ander verzoek');
  assert.equal(a.res.verzonden.van, 'Bearer lid-a');
  assert.equal(b.res.verzonden.van, 'Bearer lid-b', 'lid-b mag het antwoord van lid-a niet zien');
  assert.ok(!b.res.verzonden.herhaald);
});

test('dezelfde sleutel op een ANDER pad is een ander verzoek', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, pad: req.path }); };
  const lijf = { idem: 'k1' };

  await doe(poort, nepReq({ pad: '/api/concern/nieuw', body: lijf }), route);
  const b = await doe(poort, nepReq({ pad: '/api/agenda/toevoegen', body: lijf }), route);

  assert.equal(keer, 2);
  assert.equal(b.res.verzonden.pad, '/api/agenda/toevoegen');
});

test('GET blijft ongemoeid, ook met een sleutel erin', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, keer }); };

  await doe(poort, nepReq({ methode: 'GET', body: { idem: 'k1' } }), route);
  await doe(poort, nepReq({ methode: 'GET', body: { idem: 'k1' } }), route);

  assert.equal(keer, 2, 'lezen is al idempotent en hoort niet gecachet te worden');
});

test('een verlopen sleutel doet het werk opnieuw', async () => {
  let t = 1000;
  const poort = maakIdemPoort({ nu: () => t, ttl: 60000 });
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, id: keer }); };
  const lijf = { naam: 'RTG', idem: 'k1' };

  await doe(poort, nepReq({ body: lijf }), route);
  t += 59000;
  await doe(poort, nepReq({ body: lijf }), route);
  assert.equal(keer, 1, 'binnen de termijn blijft het een herhaling');

  t += 2000; // nu voorbij de ttl
  const c = await doe(poort, nepReq({ body: lijf }), route);
  assert.equal(keer, 2, 'na het verlopen mag het werk weer echt gebeuren');
  assert.equal(c.res.verzonden.id, 2);
});

test('de ring loopt niet vol: oude sleutels vallen eruit', async () => {
  const poort = maakIdemPoort({ max: 5 });
  const route = (req, res) => res.status(200).json({ ok: true });

  for (let i = 0; i < 40; i++) {
    await doe(poort, nepReq({ body: { i, idem: 'k' + i } }), route);
  }
  assert.ok(poort.omvang() <= 5, 'de ring hoort begrensd te zijn, kreeg ' + poort.omvang());
});

test('een te lange sleutel telt niet als sleutel', () => {
  const req = nepReq({ body: { idem: 'x'.repeat(5000) } });
  assert.equal(maakIdemPoort._sleutelVan(req), null);
});

test('de afdruk negeert de sleutel zelf, maar niet de inhoud', () => {
  const a = maakIdemPoort._afdrukVan({ naam: 'RTG', idem: 'k1' });
  const b = maakIdemPoort._afdrukVan({ naam: 'RTG', idem: 'k2' });
  const c = maakIdemPoort._afdrukVan({ naam: 'ANDERS', idem: 'k1' });
  assert.equal(a, b, 'een andere sleutel is geen ander verzoek');
  assert.notEqual(a, c, 'een andere naam is WEL een ander verzoek');
});
