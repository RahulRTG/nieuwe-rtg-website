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

test('dezelfde sleutel: een uitvoering, het eerste antwoord, en het staat IN het lijf', () => metApp(async ({ post, telling }) => {
  const een = await post('/api/tel', { idem: 'a1', w: 'eerste' });
  const twee = await post('/api/tel', { idem: 'a1', w: 'tweede' });
  assert.equal(telling(), 1, 'de handler draait een keer');
  /* HET EERSTE ANTWOORD, PLUS DE HUISMARKERING. Eerst stond hier alleen
     `deepEqual(twee.data, een.data)` en zat de melding uitsluitend in een KOP.
     Die las niemand: de geldkant markeert een herhaling al jaren in het LIJF
     (server/betaal.js: `Object.assign({}, bestaand, { herhaald: true })`), en
     zestien toetsen elders zakten omdat deze laag die taal niet sprak. */
  assert.deepEqual(twee.data, { ...een.data, herhaald: true },
    'de herhaling krijgt het EERSTE antwoord met herhaald erbij, ook al is het lijf anders');
  assert.equal(een.data.herhaald, undefined, 'de eerste uitvoering is geen herhaling');
  assert.equal(twee.herhaald, 'herhaald', 'de kop blijft er ook, voor wie hem wel leest');
  assert.equal(een.herhaald, null, 'de eerste uitvoering draagt geen herhaald-kop');
}));

test('EN HIJ GAAT NIET VOOR EEN SPECIALIST STAAN', async () => {
  /* De duurste les van deze laag, en hij is met de suite geleerd. De geldkant
     doet idempotentie zelf, en rijker dan een kas met eerste antwoorden ooit
     kan: /api/pakket/koop meldt `alBetaald`, /api/wbw/verreken geeft bij een
     tweede tik een 409 omdat er geen schuld meer is, en /api/pay/stuur geeft
     409 als dezelfde sleutel met een ANDER bedrag terugkomt. Die antwoorden
     hangen af van de toestand NA de eerste aanroep en kunnen dus onmogelijk in
     een bewaard eerste antwoord zitten.

     EEN LIJST IS GEVAARLIJK GEREEDSCHAP (LAT.md regel 4), dus hij wordt hier
     tegen de BRONCODE gehouden en niet op zijn woord geloofd: elke route die
     zelf `idem` uit het lijf haalt, moet gedekt zijn -- en elke regel in de
     lijst moet op minstens een echte route slaan. Vergeet iemand het bij een
     nieuwe geldroute, dan zakt dit voordat de kas een specialist overstemt. */
  const fs = require('fs');
  const path = require('path');
  const { EIGEN, doetHetZelf } = require('../server/middleware/idempotentie');

  const wortel = path.join(__dirname, '..', 'server', 'routes');
  const bestanden = [];
  (function loop(map) {
    for (const n of fs.readdirSync(map, { withFileTypes: true })) {
      const vol = path.join(map, n.name);
      if (n.isDirectory()) loop(vol);
      else if (n.name.endsWith('.js')) bestanden.push(vol);
    }
  })(wortel);

  /* Per bestand: elke `app.post('<pad>'` onthouden, en elke plek waar de
     handler zelf een idem-sleutel uit het lijf leest toerekenen aan de
     DICHTSTBIJZIJNDE route erboven. Grof maar eerlijk: een misser levert een
     extra eis op, geen ontbrekende. */
  const zelfdoeners = new Set();
  for (const b of bestanden) {
    const tekst = fs.readFileSync(b, 'utf8');
    const routes = [...tekst.matchAll(/app\.post\(\s*'([^']+)'/g)].map(m => ({ i: m.index, pad: m[1] }));
    if (!routes.length) continue;
    for (const m of tekst.matchAll(/\b(?:req\.body|b)\.idem\b|\bidempotentieSleutel:\s*(?:req\.body|b)\./g)) {
      let bij = null;
      for (const r of routes) { if (r.i < m.index) bij = r; else break; }
      if (bij && bij.pad.startsWith('/api/')) zelfdoeners.add(bij.pad);
    }
  }

  assert.ok(zelfdoeners.size >= 10, 'de scan hoort de geldroutes te vinden; gevonden: ' + zelfdoeners.size);
  const ongedekt = [...zelfdoeners].filter(p => !doetHetZelf(p)).sort();
  assert.deepEqual(ongedekt, [],
    'deze routes halen ZELF een idem-sleutel uit het lijf, maar de centrale laag gaat er nog voor ' +
    'staan en overstemt hun eigen antwoord. Zet ze in EIGEN (server/middleware/idempotentie.js): ' +
    ongedekt.join(', '));

  const leeg = EIGEN.filter(p => ![...zelfdoeners].some(z => z.startsWith(p)));
  assert.deepEqual(leeg, [],
    'deze regels in EIGEN slaan op geen enkele route die zelf een idem-sleutel leest; een lijst die ' +
    'stil veroudert zet de centrale bescherming uit zonder dat er iets voor terugkomt: ' + leeg.join(', '));
});

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

test('alleen een geslaagd antwoord wordt onthouden: een 4xx en een 5xx draaien bij herhaling opnieuw', () => metApp(async ({ post, telling, zetStatus }) => {
  /* Besluit van 4 oktober 2026: deze laag volgt lib/idem-poort.js en
     lib/dubbeltik.js. Een 409 hangt af van de toestand; wie die toestand
     herstelt en het opnieuw probeert met dezelfde sleutel, hoort de route te
     bereiken en niet een oude weigering uit de kas. */
  zetStatus(409);
  const een = await post('/api/tel', { idem: 'c1' });
  assert.equal(een.status, 409);
  zetStatus(200);
  const twee = await post('/api/tel', { idem: 'c1' });
  assert.equal(twee.status, 200, 'de toestand is hersteld: de herhaling bereikt de route');
  assert.equal(telling(), 2);
  const drie = await post('/api/tel', { idem: 'c1' });
  assert.equal(drie.status, 200);
  assert.equal(telling(), 2, 'en het geslaagde antwoord wordt WEL onthouden');

  zetStatus(500);
  await post('/api/tel', { idem: 'c2' });
  zetStatus(200);
  const na = await post('/api/tel', { idem: 'c2' });
  assert.equal(na.status, 200, 'een storing wordt niet vastgespijkerd: de herhaling mag opnieuw');
  assert.equal(telling(), 4);
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

test('een 200 met ok:false is geen succes en wordt dus niet onthouden', () => metApp(async ({ post, telling }) => {
  /* De route /api/tel antwoordt altijd met een object zonder `ok`; dit geval
     zet hem via een eigen app op `ok: false` -- de vorm waarin veel routes in
     dit huis een weigering met status 200 geven. */
  const express2 = require('../server/web');
  const app = express2();
  app.use(express2.json());
  app.use(maakIdempotentie());
  let n = 0;
  app.post('/api/weiger', (req, res) => { n++; res.json(n === 1 ? { ok: false, error: 'nog niet' } : { ok: true, n }); });
  const server = await new Promise(z => { const s = app.listen(0, () => z(s)); });
  try {
    const url = 'http://127.0.0.1:' + server.address().port + '/api/weiger';
    const stuur = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idem: 'w1' }) }).then(r => r.json());
    assert.equal((await stuur()).ok, false);
    assert.equal((await stuur()).ok, true, 'de herhaling bereikt de route opnieuw');
    assert.equal(n, 2);
  } finally { server.close(); }
  assert.equal(telling(), 0);
}));

/* DE DRIE LAGEN SAMEN, in de volgorde waarin het huis ze monteert
   (opzet/lijfpoort.js: idem-poort; opzet/poortwachters.js: dubbeltik en dan
   deze laag). De val die er zat: een POST met `idem` in het lijf kreeg een 409,
   de toestand werd hersteld, en de herhaling kreeg 24 uur lang die oude 409
   terug zonder dat de route draaide. Na het besluit van 4 oktober 2026 volgen
   alle drie dezelfde regel: alleen een succes wordt onthouden. */
test('de drie lagen samen: na een herstelde toestand bereikt de herhaling de route', async () => {
  const express3 = require('../server/web');
  const { maakDubbeltik } = require('../server/lib/dubbeltik');
  const app = express3();
  app.use(express3.json());
  app.use(require('../server/lib/idem-poort')());
  app.use(maakDubbeltik({}).middleware());
  app.use(maakIdempotentie());
  let saldo = 0, n = 0;
  app.post('/api/proef/koop', (req, res) => { n++; if (saldo < 10) return res.status(409).json({ error: 'te weinig saldo' }); res.json({ ok: true, n }); });
  const server = await new Promise(z => { const s = app.listen(0, () => z(s)); });
  try {
    const url = 'http://127.0.0.1:' + server.address().port + '/api/proef/koop';
    const koop = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idem: 'koop-abcdef1' }) });
    assert.equal((await koop()).status, 409);
    saldo = 100;
    const retry = await koop();
    assert.equal(retry.status, 200, 'de oude 409 komt niet meer uit een kas');
    assert.equal(n, 2);
    const nogmaals = await koop();
    assert.equal(nogmaals.status, 200);
    assert.equal(n, 2, 'het succes is onthouden: geen derde uitvoering');
  } finally { server.close(); }
});
