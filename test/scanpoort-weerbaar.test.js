/* DE SCANPOORT EN DE EXTERNE API-POORT -- bij twijfel niet verwerken.

   server/middleware/malwarescan.js keurt elke schrijfbody (via de upload-
   quarantaine of de scanner) en draagt de uploadnoodrem; server/middleware/
   apipoort.js is de deur voor /api/extern/ met sleutel, quotum en uitfasering.

   Wat hier niet mag sneuvelen:
   1. Zonder scanner start de middleware niet.
   2. Met de uploadquarantaine: geweigerd is 422, een storing in de quarantaine
      is 503 en het verzoek wordt NIET verwerkt -- ook als het loggen zelf faalt.
   3. De uploadnoodrem herkent een upload aan het pad, een Buffer, een data-URL
      en een ondoorgrondelijke (circulaire) payload; gewone JSON gaat door.
   4. De API-poort: niet gemonteerd is 503, een geweigerde sleutel geeft de
      status van de poort (429 met retry-after), een geldige sleutel krijgt
      versie, quotum en een sunset-kop zolang de versie nog werkt.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - malwarescan.js: `.then(() => next())` -> `.then(() => next(), () => next())` -> toets 2 zakt.
   - malwarescan.js lijktUpload(): `catch (e) { return true; }` -> `return false` -> toets 3 zakt.
   - apipoort.js: `if (!uit.ok) {` -> `if (false) {` -> toets 4 zakt.

   Draai los: node --test test/scanpoort-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakScan = require('../server/middleware/malwarescan');
const { apiPoortMiddleware } = require('../server/middleware/apipoort');

const res = () => ({ code: 200, body: null, kop: {}, status(n) { this.code = n; return this; },
  json(v) { this.body = v; return this; }, set(k, v) { this.kop[k] = v; return this; } });
const schoon = { scanBody: () => null };

test('1. zonder scanner start de middleware niet', () => {
  for (const antivirus of [undefined, {}, { scanBody: 'ja' }]) {
    assert.throws(() => maakScan({ antivirus }), /malwarescanner ontbreekt/);
  }
});

test('2. de quarantaine: geweigerd 422, storing 503 en niets verwerkt', async () => {
  const logs = [];
  const fouten = [Object.assign(new Error('EICAR'), { code: 'RTG_UPLOAD_GEWEIGERD' }), new Error('quarantaine plat'), 'kale fout'];
  for (const [i, f] of fouten.entries()) {
    let verder = 0;
    const r = res();
    const log = i === 2 ? { error() { throw new Error('log kapot'); } } : { error: (m, d) => logs.push(d) };
    await maakScan({ antivirus: schoon, log, uploadquarantaine: { keurBody: () => Promise.reject(f) } })(
      { method: 'PUT', path: '/api/x', ip: '1.2.3.4', body: 'tekst' }, r, () => verder++);
    assert.equal(verder, 0, 'het verzoek is niet verwerkt');
    assert.equal(r.code, i === 0 ? 422 : 503);
  }
  assert.deepEqual(logs, [{ pad: '/api/x', fout: 'quarantaine plat' }]);
  const geweigerdZonderTekst = res();
  await maakScan({ antivirus: schoon, uploadquarantaine: { keurBody: () => Promise.reject({ code: 'RTG_UPLOAD_GEWEIGERD' }) } })(
    { method: 'POST', path: '/api/x', body: {} }, geweigerdZonderTekst, () => {});
  assert.match(geweigerdZonderTekst.body.error, /geweigerd door de beveiliging/);

  let verder = 0;
  const gezien = [];
  await maakScan({ antivirus: schoon, uploadquarantaine: { keurBody: (b, o) => { gezien.push(o); return Promise.resolve(); } } })(
    { method: 'PATCH', path: '/api/y', ip: '9.9.9.9', body: { a: 1 } }, res(), () => verder++);
  assert.equal(verder, 1);
  assert.deepEqual(gezien, [{ bron: '9.9.9.9', naam: '/api/y' }]);
  const scan = maakScan({ antivirus: { scanBody() { throw new Error('mag niet geroepen worden'); } } });
  for (const body of [undefined, 42, null]) {
    let n = 0; scan({ method: 'POST', path: '/api/z', body }, res(), () => n++);
    assert.equal(n, 1, 'zonder body is er niets te scannen: ' + body);
  }
  let n = 0; maakScan({ antivirus: schoon })({ method: 'POST', body: {} }, res(), () => n++);
  assert.equal(n, 1, 'een verzoek zonder pad valt niet om');
  const stil = res();
  maakScan({ antivirus: { scanBody() { throw 'weg'; } }, log: { error() { throw new Error('ook weg'); } } })(   // eslint-disable-line no-throw-literal
    { method: 'POST', path: '/api/q', body: {} }, stil, () => { throw new Error('mag niet door'); });
  assert.equal(stil.code, 503, 'een falende logger maakt van een scanstoring geen doorgang');
});

test('3. de uploadnoodrem herkent uploads, ook een ondoorgrondelijke payload', () => {
  const oud = process.env.RTG_UPLOADS_UIT;
  process.env.RTG_UPLOADS_UIT = '1';
  try {
    const scan = maakScan({ antivirus: schoon });
    const rond = {}; rond.zelf = rond;
    const gevallen = [
      ['/api/member/Fotos/nieuw', { a: 1 }, 503],
      ['/api/x', Buffer.from('abc'), 503],
      ['/api/x', { avatar: 'data:image/png;base64,AAAA' }, 503],
      ['/api/x', rond, 503],
      ['/api/fotograaf', { tekst: 'gewoon' }, 200]
    ];
    for (const [path, body, code] of gevallen) {
      const r = res(); let door = 0;
      scan({ method: 'POST', path, body }, r, () => door++);
      assert.equal(code === 200 ? door : r.code, code === 200 ? 1 : 503, path);
    }
    let lees = 0; scan({ method: 'GET', path: '/api/upload' }, res(), () => lees++);
    assert.equal(lees, 1, 'lezen blijft open');
  } finally { if (oud === undefined) delete process.env.RTG_UPLOADS_UIT; else process.env.RTG_UPLOADS_UIT = oud; }
});

test('4. de API-poort: niet gemonteerd, geweigerd, en een geldige sleutel met uitfasering', () => {
  const verzoek = (p, kop) => ({ path: p, method: 'GET', get: () => kop });
  let door = 0;
  apiPoortMiddleware({})(verzoek('/api/member/x'), res(), () => door++);
  assert.equal(door, 1, 'alleen /api/extern/ gaat door deze poort');
  const r0 = res();
  apiPoortMiddleware(null)(verzoek('/api/extern/v1/x'), r0, () => door++);
  assert.equal(r0.code, 503);

  const gezien = [];
  let uit;
  const kern = { command: { apipoort: { apiSleutelOk: (k, p, m) => { gezien.push([k, p, m]); return uit; } } } };
  uit = { ok: false, status: 429, reden: 'quotum op', herstartOver: 30 };
  const r1 = res();
  apiPoortMiddleware(kern)(verzoek('/api/extern/v1/x', 'bearer sleutel-1'), r1, () => door++);
  assert.deepEqual([r1.code, r1.kop['retry-after'], r1.body.error], [429, '30', 'quotum op']);
  assert.deepEqual(gezien[0], ['sleutel-1', '/api/extern/v1/x', 'GET'], 'Bearer-voorvoegsel hoofdletterongevoelig weg');
  uit = { ok: false, status: 401, reden: 'onbekende sleutel' };
  const r2 = res();
  apiPoortMiddleware(kern)(verzoek('/api/extern/v1/x'), r2, () => door++);
  assert.equal(r2.code, 401);
  assert.equal(r2.kop['retry-after'], undefined);
  assert.equal(door, 1);

  uit = { ok: true, sleutel: 'k1', naam: 'klant', rest: 7, uitfasering: '2026-12-01' };
  const r3 = res(); const req = verzoek('/api/extern/v0/x', 'Bearer s');
  apiPoortMiddleware(kern)(req, r3, () => door++);
  assert.deepEqual(r3.kop, { 'x-rtg-api-versie': 'v1', 'x-rtg-quota-rest': '7', sunset: '2026-12-01' });
  assert.deepEqual(req.apiSleutel, { id: 'k1', naam: 'klant' });
  assert.equal(door, 2);
});
