/* ============================================================================
   DE DUBBELTIK (server/lib/dubbeltik.js): een herhaald schrijfverzoek doet het
   werk één keer.

   WAT HIER BEWEZEN MOET WORDEN is niet dat er iets uit de kast komt, maar dat
   de kast de juiste dingen NIET doet: geen antwoord van iemand anders
   teruggeven, geen mislukte poging vasthouden, en geen twee verzoeken zonder
   sleutel samenvouwen. Elke toets telt daarom hoe vaak het WERK is gedaan --
   niet hoe het antwoord eruitziet.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de in-vlucht-wacht overgeslagen (tweede verzoek gewoon doorgelaten)
     -> "twee gelijktijdige verzoeken doen het werk één keer" ZAKT (RAAK)
   - de wie-hash uit de sleutel gehaald
     -> "een andere gebruiker krijgt nooit andermans antwoord" ZAKT (RAAK)
   - ook niet-2xx bewaren
     -> "een mislukte poging mag opnieuw" ZAKT (RAAK)
   - de afdruk niet vergelijken (elk lijf onder dezelfde sleutel als herhaling)
     -> "een ander lijf onder dezelfde sleutel wordt doorgelaten" ZAKT (RAAK)

   Los: node --test test/dubbeltik.test.js
   ========================================================================== */
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { maakDubbeltik, canoniek, sleutelUit } = require('../server/lib/dubbeltik');

/* Een piepklein Express-achtig serviertje: genoeg voor deze middleware, en
   zonder de hele app op te tuigen. res.json en res.status doen wat Express
   doet, want daar hangt de laag aan. */
function maakServer(handler, dubbeltik) {
  const mw = dubbeltik.middleware();
  const srv = http.createServer((req, res) => {
    const brokken = [];
    req.on('data', c => brokken.push(c));
    req.on('end', () => {
      let lijf = {};
      try { lijf = JSON.parse(Buffer.concat(brokken).toString() || '{}'); } catch (e) {}
      req.body = lijf;
      req.path = req.url;
      req.ip = '127.0.0.1';
      req.get = (naam) => req.headers[String(naam).toLowerCase()];
      res.set = (naam, waarde) => { res.setHeader(naam, waarde); return res; };
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (data) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(data)); return res; };
      mw(req, res, () => handler(req, res));
    });
  });
  return new Promise(klaar => srv.listen(0, '127.0.0.1', () => klaar({ srv, poort: srv.address().port })));
}

async function post(poort, pad, lijf, koppen) {
  const r = await fetch('http://127.0.0.1:' + poort + pad, {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, koppen || {}),
    body: JSON.stringify(lijf)
  });
  const tekst = await r.text();
  let data = null;
  try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
  return { status: r.status, data, herhaaldKop: r.headers.get('x-rtg-herhaald') };
}

/* Het "werk": een teller die zegt hoe vaak de route echt is uitgevoerd. Dat is
   de enige meting die ertoe doet -- twee gelijke antwoorden bewijzen niets als
   het werk twee keer is gedaan. */
function teller() {
  const staat = { gedaan: 0 };
  return {
    staat,
    handler: (req, res) => { staat.gedaan++; res.status(200).json({ id: 'nr-' + staat.gedaan }); }
  };
}

test('zonder sleutel verandert er niets: twee verzoeken doen twee keer het werk', async () => {
  const t = teller();
  const { srv, poort } = await maakServer(t.handler, maakDubbeltik());
  try {
    await post(poort, '/api/notitie', { tekst: 'hallo' });
    await post(poort, '/api/notitie', { tekst: 'hallo' });
    assert.strictEqual(t.staat.gedaan, 2, 'twee keer hetzelfde toevoegen MAG twee notities zijn');
  } finally { srv.close(); }
});

test('met dezelfde sleutel gebeurt het werk één keer, en het antwoord is gelijk', async () => {
  const t = teller();
  const { srv, poort } = await maakServer(t.handler, maakDubbeltik());
  try {
    const a = await post(poort, '/api/notitie', { tekst: 'hallo', idem: 'sleutel-123' });
    const b = await post(poort, '/api/notitie', { tekst: 'hallo', idem: 'sleutel-123' });
    assert.strictEqual(t.staat.gedaan, 1, 'de herhaling heeft de route niet bereikt');
    assert.strictEqual(b.data.id, a.data.id, 'en krijgt hetzelfde antwoord');
    assert.strictEqual(b.data.herhaald, true, 'met het merk dat de server het zelf zag');
    assert.strictEqual(b.herhaaldKop, '1');
    assert.strictEqual(a.data.herhaald, undefined, 'het eerste antwoord draagt dat merk niet');
  } finally { srv.close(); }
});

test('de kop Idempotency-Key doet hetzelfde als het veld in het lijf', async () => {
  const t = teller();
  const { srv, poort } = await maakServer(t.handler, maakDubbeltik());
  try {
    await post(poort, '/api/notitie', { tekst: 'x' }, { 'idempotency-key': 'kop-sleutel-1' });
    const b = await post(poort, '/api/notitie', { tekst: 'x' }, { 'idempotency-key': 'kop-sleutel-1' });
    assert.strictEqual(t.staat.gedaan, 1);
    assert.strictEqual(b.data.herhaald, true);
  } finally { srv.close(); }
});

test('een andere gebruiker krijgt nooit andermans antwoord, ook niet bij dezelfde sleutel', async () => {
  const t = teller();
  const { srv, poort } = await maakServer(t.handler, maakDubbeltik());
  try {
    const a = await post(poort, '/api/notitie', { tekst: 'x', idem: 'gedeeld-1' }, { authorization: 'Bearer aaa' });
    const b = await post(poort, '/api/notitie', { tekst: 'x', idem: 'gedeeld-1' }, { authorization: 'Bearer bbb' });
    assert.strictEqual(t.staat.gedaan, 2, 'de tweede gebruiker hoort gewoon bediend te worden');
    assert.notStrictEqual(b.data.id, a.data.id, 'en krijgt zijn eigen antwoord, niet dat van de eerste');
  } finally { srv.close(); }
});

test('dezelfde sleutel op een ANDER pad is een ander verzoek', async () => {
  const t = teller();
  const { srv, poort } = await maakServer(t.handler, maakDubbeltik());
  try {
    await post(poort, '/api/een', { idem: 'zelfde-sleutel' });
    await post(poort, '/api/twee', { idem: 'zelfde-sleutel' });
    assert.strictEqual(t.staat.gedaan, 2);
  } finally { srv.close(); }
});

test('een ander lijf onder dezelfde sleutel wordt doorgelaten, niet geweigerd', async () => {
  /* Deze laag weet niet WELKE velden een verzoek bepalen -- een geldroute mag
     een andere omschrijving bij dezelfde betaling krijgen. Doorlaten betekent
     hier: precies wat er zonder deze laag ook gebeurt. De strengere afdruk
     blijft bij server/lib/idem.js. */
  const t = teller();
  const { srv, poort } = await maakServer(t.handler, maakDubbeltik());
  try {
    const a = await post(poort, '/api/notitie', { tekst: 'eerst', idem: 'sleutel-abc' });
    const b = await post(poort, '/api/notitie', { tekst: 'anders', idem: 'sleutel-abc' });
    assert.strictEqual(t.staat.gedaan, 2, 'een ander verzoek is geen herhaling');
    assert.notStrictEqual(b.data.id, a.data.id);
    assert.strictEqual(b.status, 200, 'en het is geen 409 -- dat oordeel is niet aan deze laag');
  } finally { srv.close(); }
});

test('een mislukte poging mag opnieuw', async () => {
  const staat = { gedaan: 0 };
  const handler = (req, res) => {
    staat.gedaan++;
    if (staat.gedaan === 1) return res.status(500).json({ error: 'even niet' });
    res.status(200).json({ id: 'gelukt-' + staat.gedaan });
  };
  const { srv, poort } = await maakServer(handler, maakDubbeltik());
  try {
    const a = await post(poort, '/api/notitie', { idem: 'sleutel-mis' });
    assert.strictEqual(a.status, 500);
    const b = await post(poort, '/api/notitie', { idem: 'sleutel-mis' });
    assert.strictEqual(b.status, 200, 'een tweede poging na een fout hoort gewoon te lopen');
    assert.strictEqual(staat.gedaan, 2);
  } finally { srv.close(); }
});

test('twee GELIJKTIJDIGE verzoeken met dezelfde sleutel doen het werk één keer', async () => {
  /* Dit is het geval waar een dubbeltik uit bestaat, en het geval dat een
     kast-na-afloop niet vangt: tussen "kijken of de sleutel bestaat" en "het
     antwoord opslaan" staat het hele werk. Zonder de in-vlucht-wacht passen
     allebei erdoorheen. */
  const staat = { gedaan: 0 };
  const handler = async (req, res) => {
    staat.gedaan++;
    const mijn = staat.gedaan;
    await new Promise(r => setTimeout(r, 120));      // echt werk duurt even
    res.status(200).json({ id: 'nr-' + mijn });
  };
  const { srv, poort } = await maakServer(handler, maakDubbeltik());
  try {
    const [a, b] = await Promise.all([
      post(poort, '/api/traag', { idem: 'sleutel-gelijktijdig' }),
      post(poort, '/api/traag', { idem: 'sleutel-gelijktijdig' })
    ]);
    assert.strictEqual(staat.gedaan, 1, 'de tweede heeft gewacht in plaats van het werk over te doen');
    assert.strictEqual(a.data.id, b.data.id);
    assert.ok(a.data.herhaald === true || b.data.herhaald === true, 'een van de twee is als herhaling gemerkt');
  } finally { srv.close(); }
});

test('als het eerste verzoek faalt, mag de wachter het alsnog proberen', async () => {
  const staat = { gedaan: 0 };
  const handler = async (req, res) => {
    staat.gedaan++;
    const mijn = staat.gedaan;
    await new Promise(r => setTimeout(r, 100));
    if (mijn === 1) return res.status(503).json({ error: 'druk' });
    res.status(200).json({ id: 'nr-' + mijn });
  };
  const { srv, poort } = await maakServer(handler, maakDubbeltik());
  try {
    const [a, b] = await Promise.all([
      post(poort, '/api/traag', { idem: 'sleutel-faalt-eerst' }),
      post(poort, '/api/traag', { idem: 'sleutel-faalt-eerst' })
    ]);
    assert.strictEqual(a.status, 503);
    assert.strictEqual(b.status, 200, 'de wachter hoort niet mee te vallen met een fout die niet van hem was');
    assert.strictEqual(staat.gedaan, 2);
  } finally { srv.close(); }
});

test('GET blijft ongemoeid', async () => {
  const t = teller();
  const dubbeltik = maakDubbeltik();
  const { srv, poort } = await maakServer(t.handler, dubbeltik);
  try {
    await fetch('http://127.0.0.1:' + poort + '/api/lees?idem=sleutel-get');
    assert.strictEqual(dubbeltik.staat().gezien, 0, 'een leesverzoek komt deze laag niet eens binnen');
  } finally { srv.close(); }
});

test('de kast loopt niet vol en houdt niets langer vast dan de termijn', async () => {
  let tijd = 1000;
  const dubbeltik = maakDubbeltik({ ttlMs: 500, max: 3, nu: () => tijd });
  const t = teller();
  const { srv, poort } = await maakServer(t.handler, dubbeltik);
  try {
    for (let i = 0; i < 5; i++) await post(poort, '/api/notitie', { idem: 'sleutel-vol-' + i });
    assert.ok(dubbeltik.staat().inKast <= 3, 'boven de grens valt de oudste eraf: ' + dubbeltik.staat().inKast);
    tijd += 5000;
    dubbeltik.veeg();
    assert.strictEqual(dubbeltik.staat().inKast, 0, 'na de termijn is de kast leeg');
    /* En dan is het geen herhaling meer, maar een nieuw verzoek -- dat hoort
       ook zo: een sleutel van gisteren mag geen antwoord van gisteren geven. */
    const na = await post(poort, '/api/notitie', { idem: 'sleutel-vol-4' });
    assert.strictEqual(na.data.herhaald, undefined);
  } finally { srv.close(); }
});

test('een te korte sleutel telt niet als sleutel', () => {
  const req = { body: { idem: 'ab' }, get: () => null };
  assert.strictEqual(sleutelUit(req), null, 'twee tekens is een botsing die staat te wachten');
  assert.strictEqual(sleutelUit({ body: { idem: 'lang-genoeg' }, get: () => null }), 'lang-genoeg');
});

test('de afdruk kijkt naar het verzoek en niet naar de sleutel zelf', () => {
  assert.strictEqual(canoniek({ a: 1, idem: 'x' }), canoniek({ a: 1, idem: 'y' }),
    'anders zou elke afdruk per definitie kloppen');
  assert.notStrictEqual(canoniek({ a: 1 }), canoniek({ a: 2 }));
  assert.strictEqual(canoniek({ a: 1, b: 2 }), canoniek({ b: 2, a: 1 }), 'sleutelvolgorde is geen betekenis');
});
