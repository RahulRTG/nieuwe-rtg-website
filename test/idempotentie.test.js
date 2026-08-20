/* DE IDEMPOTENTIELAAG, NAGETROKKEN. Een sleutel, een uitvoering: de herhaling
   krijgt hetzelfde antwoord en de handler draait niet nog een keer. Dit is de
   ene-plek-oplossing voor de 128 routes die de staatproef op idempotentie
   schorste; de laag is opt-in, dus elk geval hieronder toetst ook een kant
   waarop hij zich NIET mag bemoeien.

   Gemeten tegen een echte express-app met een echte teller -- geen nagemaakte
   res, want de laag leeft van res.json-onderschepping en statuscodes, en juist
   die wil je echt zien (LAT.md regel 10).

   Draai los: node --experimental-sqlite --test test/idempotentie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('../server/web'); // het eigen webframework (zie docs/de-lijn.md)
const maakIdempotentie = require('../server/middleware/idempotentie');

/* Een wegwerp-app met een teller: elke ECHTE uitvoering telt. */
async function metApp(doe) {
  const app = express();
  app.use(express.json());
  app.use(maakIdempotentie());
  let teller = 0, status = 200;
  app.post('/api/tel', (req, res) => { teller++; res.status(status).json({ teller, echo: req.body.w || null }); });
  app.post('/api/plat', (req, res) => { teller++; res.send('geen json'); });
  const server = await new Promise(z => { const s = app.listen(0, () => z(s)); });
  const basis = 'http://127.0.0.1:' + server.address().port;
  const post = async (pad, lijf, kop) => {
    const r = await fetch(basis + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(kop || {}) }, body: JSON.stringify(lijf || {}) });
    return { status: r.status, data: await r.json().catch(() => null), herhaald: r.headers.get('x-idempotentie') };
  };
  try { return await doe({ post, telling: () => teller, zetStatus: (s) => { status = s; } }); }
  finally { server.close(); }
}

test('dezelfde sleutel: een uitvoering, hetzelfde antwoord, en de kop zegt het', () => metApp(async ({ post, telling }) => {
  const een = await post('/api/tel', { idem: 'a1', w: 'eerste' });
  const twee = await post('/api/tel', { idem: 'a1', w: 'tweede' });
  assert.equal(telling(), 1, 'de handler draait een keer');
  assert.deepEqual(twee.data, een.data, 'de herhaling krijgt het EERSTE antwoord, ook al is het lijf anders');
  assert.equal(twee.herhaald, 'herhaald');
  assert.equal(een.herhaald, null, 'de eerste uitvoering draagt geen herhaald-kop');
}));

test('zonder sleutel bemoeit de laag zich nergens mee', () => metApp(async ({ post, telling }) => {
  await post('/api/tel', { w: 'x' });
  await post('/api/tel', { w: 'x' });
  assert.equal(telling(), 2, 'geen sleutel, geen herhaalbescherming: het oude gedrag');
}));

test('een andere sleutel, of dezelfde sleutel van een andere afzender, draait echt', () => metApp(async ({ post, telling }) => {
  await post('/api/tel', { idem: 'b1' });
  await post('/api/tel', { idem: 'b2' });
  assert.equal(telling(), 2, 'twee sleutels zijn twee uitvoeringen');
  await post('/api/tel', { idem: 'b1' }, { Authorization: 'Bearer iemand-anders' });
  assert.equal(telling(), 3, 'dezelfde sleutel van een andere afzender is andermans verzoek, nooit een herhaling');
}));

test('een 4xx wordt herhaald, een 5xx nooit', () => metApp(async ({ post, telling, zetStatus }) => {
  zetStatus(409);
  const een = await post('/api/tel', { idem: 'c1' });
  const twee = await post('/api/tel', { idem: 'c1' });
  assert.equal(een.status, 409);
  assert.equal(twee.status, 409);
  assert.equal(telling(), 1, 'dezelfde vraag, hetzelfde oordeel: de 409 komt uit de kas');

  zetStatus(500);
  await post('/api/tel', { idem: 'c2' });
  zetStatus(200);
  const na = await post('/api/tel', { idem: 'c2' });
  assert.equal(na.status, 200, 'een storing wordt niet vastgespijkerd: de herhaling mag opnieuw');
  assert.equal(telling(), 3);
}));

test('idempotentieSleutel werkt net als idem, en niet-tekst telt niet als sleutel', () => metApp(async ({ post, telling }) => {
  await post('/api/tel', { idempotentieSleutel: 'd1' });
  await post('/api/tel', { idempotentieSleutel: 'd1' });
  assert.equal(telling(), 1);
  await post('/api/tel', { idem: 7 });
  await post('/api/tel', { idem: 7 });
  assert.equal(telling(), 3, 'een getal is geen sleutel; wie er een wil, stuurt tekst');
}));

test('een route die niet via res.json antwoordt, blijft buiten de kas', () => metApp(async ({ post, telling }) => {
  await post('/api/plat', { idem: 'e1' });
  await post('/api/plat', { idem: 'e1' });
  assert.equal(telling(), 2, 'res.send valt buiten de belofte (de grens staat in de kop van de laag)');
}));
