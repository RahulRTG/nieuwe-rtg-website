/* ============================================================================
   DE DUBBELTIK EN DE COMPRESSIE, IN DE ECHTE VOLGORDE.

   DIT BESTAAT OM EEN FOUT DIE DE TOETSEN NIET ZAGEN. server/lib/dubbeltik.js
   heeft dertien toetsen die allemaal groen stonden, en de laag deed het in de
   praktijk toch maar half: in de idemproef bleven negentien routes onbeschermd,
   en dat waren precies de routes met een GROOT antwoord.

   De oorzaak zat niet in de dubbeltik maar in zijn BUURMAN. jsonGzip() vervangt
   res.json ook, en bij een antwoord boven de kilobyte stuurt hij het via
   res.send in plaats van via de res.json waar de dubbeltik aan hing. De
   dubbeltik zag dat antwoord dus nooit, bewaarde niets, en de herhaling deed het
   werk gewoon opnieuw. Onzichtbaar, want:

     - kleine antwoorden gingen wel goed (onder de kilobyte comprimeert hij niet);
     - met curl ging het altijd goed (die vraagt standaard geen compressie);
     - en er kwam geen enkele foutmelding, want er ging niets kapot.

   Wat de toetsen misten was dus niet een geval maar een SAMENSTELLING. Deze
   toets zet de twee lagen daarom in dezelfde volgorde als server/opzet/
   poortwachters.js en stuurt een verzoek zoals een browser dat stuurt: met
   accept-encoding, en met een antwoord van boven de kilobyte.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de dubbeltik VOOR jsonGzip mounten (de oude, foute volgorde)
     -> "een groot antwoord wordt ook herhaald" ZAKT (RAAK)
   - de melding bij een gemist antwoord weggehaald
     -> "een gemist antwoord wordt hardop gemeld" ZAKT (RAAK)

   Los: node --test test/dubbeltikgzip.test.js
   ========================================================================== */
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const zlib = require('node:zlib');
const { maakDubbeltik } = require('../server/lib/dubbeltik');
const { jsonGzip } = require('../server/middleware/compressie');

/* Een minimale Express-nabootsing: genoeg voor deze twee lagen. res.send moet
   erin, want dat is precies de weg die jsonGzip neemt bij een groot antwoord. */
function maakServer(lagen, handler) {
  const srv = http.createServer((req, res) => {
    const brokken = [];
    req.on('data', c => brokken.push(c));
    req.on('end', () => {
      try { req.body = JSON.parse(Buffer.concat(brokken).toString() || '{}'); } catch (e) { req.body = {}; }
      req.path = req.url;
      req.ip = '127.0.0.1';
      req.get = (naam) => req.headers[String(naam).toLowerCase()];
      res.set = (n, w) => { res.setHeader(n, w); return res; };
      res.setHeader2 = res.setHeader.bind(res);
      res.status = (c) => { res.statusCode = c; return res; };
      res.send = (lijf) => { res.end(Buffer.isBuffer(lijf) ? lijf : String(lijf)); return res; };
      res.json = (data) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(data)); return res; };
      let i = 0;
      const volgende = () => { const laag = lagen[i++]; if (laag) laag(req, res, volgende); else handler(req, res); };
      volgende();
    });
  });
  return new Promise(k => srv.listen(0, '127.0.0.1', () => k({ srv, poort: srv.address().port })));
}

async function post(poort, pad, lijf, koppen) {
  const r = await fetch('http://127.0.0.1:' + poort + pad, {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json', 'accept-encoding': 'gzip' }, koppen || {}),
    body: JSON.stringify(lijf)
  });
  const rauw = Buffer.from(await r.arrayBuffer());
  const codering = r.headers.get('content-encoding');
  /* fetch pakt gzip zelf uit; als de kop er toch nog staat is het lijf al
     leesbaar. Beide gevallen netjes afhandelen, want het gaat hier om de INHOUD
     en niet om wie er uitpakt. */
  let tekst = rauw.toString('utf8');
  if (codering === 'gzip' && rauw[0] === 0x1f) tekst = zlib.gunzipSync(rauw).toString('utf8');
  let data = null; try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
  return { status: r.status, data, herhaaldKop: r.headers.get('x-rtg-herhaald'), codering };
}

/* Een antwoord van ruim boven de kilobyte -- dat is de grens waarboven
   jsonGzip het overneemt. */
function grootAntwoord(nummer) {
  return { nummer, regels: Array.from({ length: 60 }, (_, i) => 'regel ' + i + ' met genoeg tekst om over de kilobyte te komen') };
}

test('een GROOT antwoord wordt ook herhaald -- de dubbeltik staat na de compressie', async () => {
  let gedaan = 0;
  const dubbeltik = maakDubbeltik();
  /* De echte volgorde uit server/opzet/poortwachters.js: eerst jsonGzip, dan
     de dubbeltik. Wie het laatst om res.json heen gaat, ziet het antwoord het
     eerst. */
  const { srv, poort } = await maakServer([jsonGzip(), dubbeltik.middleware()], (req, res) => {
    gedaan++;
    res.status(200).json(grootAntwoord(gedaan));
  });
  try {
    const a = await post(poort, '/api/groot', { idem: 'groot-sleutel-1' });
    const b = await post(poort, '/api/groot', { idem: 'groot-sleutel-1' });
    assert.ok(JSON.stringify(a.data).length > 1024, 'de proef is alleen zinnig boven de kilobyte');
    assert.strictEqual(gedaan, 1, 'de herhaling heeft de route niet bereikt');
    assert.strictEqual(b.data.nummer, a.data.nummer);
    assert.strictEqual(b.data.herhaald, true);
    assert.strictEqual(b.herhaaldKop, '1');
  } finally { srv.close(); }
});

test('en een klein antwoord blijft gewoon werken', async () => {
  let gedaan = 0;
  const dubbeltik = maakDubbeltik();
  const { srv, poort } = await maakServer([jsonGzip(), dubbeltik.middleware()], (req, res) => {
    gedaan++; res.status(200).json({ nummer: gedaan });
  });
  try {
    await post(poort, '/api/klein', { idem: 'klein-sleutel-1' });
    const b = await post(poort, '/api/klein', { idem: 'klein-sleutel-1' });
    assert.strictEqual(gedaan, 1);
    assert.strictEqual(b.data.herhaald, true);
  } finally { srv.close(); }
});

/* DE TWEEDE HELFT VAN DE REPARATIE. Volgorde valt te herstellen; dat iemand
   later opnieuw een wikkel achter de dubbeltik hangt, valt niet te voorkomen.
   Wat wel kan: dan niet stil afhaken maar het zeggen. */
test('een gemist antwoord wordt hardop gemeld, en maar een keer per pad', async () => {
  const meldingen = [];
  const dubbeltik = maakDubbeltik({ log: { warn: (m) => meldingen.push(m) } });
  // de FOUTE volgorde: de dubbeltik eerst, de compressie erna -- zoals het was
  const { srv, poort } = await maakServer([dubbeltik.middleware(), jsonGzip()], (req, res) => {
    res.status(200).json(grootAntwoord(1));
  });
  try {
    await post(poort, '/api/gemist', { idem: 'gemist-sleutel-1' });
    await post(poort, '/api/gemist', { idem: 'gemist-sleutel-2' });
    assert.strictEqual(meldingen.length, 1, 'een storm helpt niemand: een melding per pad');
    assert.match(meldingen[0], /NIET tegen dubbeltik beschermd/);
    assert.match(meldingen[0], /\/api\/gemist/);
    assert.strictEqual(dubbeltik.staat().gemist, 1);
  } finally { srv.close(); }
});

test('zonder compressie-verzoek verandert er niets aan het gedrag', async () => {
  let gedaan = 0;
  const dubbeltik = maakDubbeltik();
  const { srv, poort } = await maakServer([jsonGzip(), dubbeltik.middleware()], (req, res) => {
    gedaan++; res.status(200).json(grootAntwoord(gedaan));
  });
  try {
    await post(poort, '/api/geen-gzip', { idem: 'nogzip-sleutel-1' }, { 'accept-encoding': 'identity' });
    const b = await post(poort, '/api/geen-gzip', { idem: 'nogzip-sleutel-1' }, { 'accept-encoding': 'identity' });
    assert.strictEqual(gedaan, 1);
    assert.strictEqual(b.data.herhaald, true);
  } finally { srv.close(); }
});
