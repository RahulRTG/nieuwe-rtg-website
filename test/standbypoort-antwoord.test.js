/* ============================================================================
   DE TWEEDE BLIK VAN DE STAND-BYPOORT, BIJ HET ANTWOORD -- regressie voor N11
   uit de V1-audit.

   DE FOUT: server/opzet/standbypoort.js keek alleen bij de INGANG naar
   db.writable. Werd de server afgezet terwijl een verzoek al voorbij de poort
   was, dan deed dat verzoek zijn werk, bewaar() keerde stil terug en het
   antwoord was 200.

   DE FIX: server/opzet/standbypoort-antwoord.js. Schreef het proces bij de
   ingang nog en bij het antwoord niet meer, dan wordt een succesantwoord een
   503 met Retry-After.

   Dit bestand is het DETERMINISTISCHE deel: db.writable slaat om tussen de
   poort en het antwoord, zonder klok of tweede proces. Twee lagen:
   1. een nep-res die de ECHTE verrijk() (server/web/verrijk.js) krijgt, zodat
      json, send en redirect lopen zoals in de app;
   2. een echte web()-app op node:http, voor sendFile (een pipe) en de
      compressielaag: de haak hoort af te gaan op het punt waar die
      werkelijk uitkomen.
   De race tegen een echte server staat in test/standbypoort-race.test.js.

   Draai los: node --test test/standbypoort-antwoord.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { standbyPoort } = require('../server/opzet/standbypoort');
const { verrijk } = require('../server/web/verrijk');

/* Een res met precies de methoden waar verrijk() en de poort op leunen. Hij
   houdt bij hoe vaak end() werkelijk is aangeroepen: een vervanging die het
   oude lijf er alsnog achteraan stuurt, moet zakken. Met `bufferend` doet
   write() wat de PostgreSQL-grens (server/db/postgres-verzoeken.js) bij een
   muterend verzoek doet: het stuk wacht tot de commit, en headersSent blijft
   false. */
function nepRes({ bufferend = false } = {}) {
  const koppen = new Map();
  const res = {
    statusCode: 200, headersSent: false, stukken: [], einden: 0,
    setHeader(k, v) { if (this.headersSent) throw new Error('koppen al weg'); koppen.set(String(k).toLowerCase(), v); return this; },
    getHeader(k) { return koppen.get(String(k).toLowerCase()); },
    removeHeader(k) { if (this.headersSent) throw new Error('koppen al weg'); koppen.delete(String(k).toLowerCase()); },
    getHeaderNames() { return [...koppen.keys()]; },
    write(stuk) { if (!bufferend) this.headersSent = true; this.stukken.push(Buffer.from(stuk)); return true; },
    end(stuk) { if (stuk != null) this.stukken.push(Buffer.from(stuk)); this.headersSent = true; this.einden++; return this; },
    on() { return this; }, once() { return this; }
  };
  res.lijf = () => Buffer.concat(res.stukken).toString('utf8');
  return res;
}

/* Een verzoek door verrijk() en de poort halen; `werk` speelt de route. */
function doorPoort({ methode = 'POST', pad = '/api/iets', writable = true, bufferend } = {}, werk) {
  const db = { writable };
  const req = { method: methode, url: pad, headers: {}, socket: { remoteAddress: '127.0.0.1' } };
  const res = nepRes({ bufferend });
  verrijk(req, res, {});
  let doorgelaten = false;
  standbyPoort(db)(req, res, () => { doorgelaten = true; werk(res, db); });
  return { res, db, doorgelaten };
}

const isVervangen = (res) => {
  assert.equal(res.statusCode, 503, 'een succes na de afzetting wordt een 503 (kreeg ' + res.statusCode + ')');
  assert.equal(res.einden, 1, 'precies een keer end(): het oude lijf gaat er niet achteraan');
  const lijf = JSON.parse(res.lijf());
  assert.equal(lijf.code, 'STANDBY_TIJDENS_VERZOEK');
  assert.match(lijf.error, /stand-by/);
  assert.match(lijf.error, /niet vast/, 'de tekst zegt eerlijk dat het onzeker is, niet dat het mislukte');
  assert.equal(res.getHeader('Retry-After'), '2');
  assert.match(String(res.getHeader('Content-Type')), /application\/json/);
  assert.equal(res.getHeader('Cache-Control'), 'no-store', 'een 503 over een onzekere stand hoort niet in een cache');
};

test('json: schrijft bij de ingang, afgezet voor het antwoord -> 503 in plaats van 200', () => {
  const { res } = doorPoort({}, (r, db) => { db.writable = false; r.status(200).json({ ok: true, merk: 'SUCCESLIJF' }); });
  isVervangen(res);
  assert.doesNotMatch(res.lijf(), /SUCCESLIJF/, 'van het succeslijf blijft niets over');
});

test('controle: blijft hij schrijven, dan gaat het succes ongemoeid door', () => {
  const { res } = doorPoort({}, (r) => { r.json({ ok: true }); });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.lijf()), { ok: true });
});

test('send en redirect lopen via dezelfde haak, en de Location verdwijnt', () => {
  const a = doorPoort({}, (r, db) => { db.writable = false; r.send('<p>gelukt</p>'); });
  isVervangen(a.res);
  const b = doorPoort({}, (r, db) => { db.writable = false; r.redirect('/klaar'); });
  isVervangen(b.res);
  assert.equal(b.res.getHeader('Location'), undefined, 'een 503 stuurt niemand door naar "klaar"');
  const c = doorPoort({}, (r, db) => { db.writable = false; r.end(); });
  isVervangen(c.res);
});

/* Letterlijk genoemd en NIET uit de module gelezen: een lijst die de toets van
   de code leent, krimpt mee als iemand er een kop uit haalt. Een achtergebleven
   Content-Disposition maakt van de 503 in een browser een download van de
   foutmelding; een Content-Range of Transfer-Encoding beschrijft een lijf dat
   er niet meer is. */
const OUDE_KOPPEN = {
  'Content-Encoding': 'gzip', 'Content-Length': '999', 'Content-Range': 'bytes 0-998/5000',
  'Content-Disposition': 'attachment; filename="bon.pdf"', 'Content-Language': 'nl',
  'Content-Location': '/api/iets/1', 'ETag': '"x"', 'Last-Modified': 'Tue, 06 Oct 2026 05:00:00 GMT',
  'Location': '/klaar', 'Set-Cookie': 'rtg=nieuw', 'Transfer-Encoding': 'chunked', 'Accept-Ranges': 'bytes'
};

test('koppen over het oude lijf gaan weg: alle twaalf', () => {
  const { res } = doorPoort({}, (r, db) => {
    r.set(OUDE_KOPPEN);
    for (const k of Object.keys(OUDE_KOPPEN)) assert.equal(r.getHeader(k), OUDE_KOPPEN[k], 'vooraf gezet: ' + k);
    db.writable = false;
    r.send(zlib.gzipSync(JSON.stringify({ ok: true })));
  });
  isVervangen(res);
  for (const k of Object.keys(OUDE_KOPPEN))
    assert.equal(res.getHeader(k), undefined, k + ' hoort niet bij het 503-lijf');
});

test('een eigen statustekst van het succes gaat mee weg', () => {
  const { res } = doorPoort({}, (r, db) => { r.statusMessage = 'Gelukt'; db.writable = false; r.json({ ok: true }); });
  isVervangen(res);
  assert.equal(res.statusMessage, 'Service Unavailable', 'geen "503 Gelukt" op de lijn');
});

/* Het omzetten van de koppen gooit alleen als ze al weg zijn, en moetWeg sluit
   dat uit. Gebeurt het toch, dan hoort het verzoek niet te HANGEN: de vlag die
   latere schrijfacties slikt, mag pas om als het eigen lijf echt vertrekt. */
test('lukt het vervangen niet, dan gaat het oorspronkelijke antwoord door en hangt er niets', () => {
  const gooi = () => { throw Object.assign(new Error('koppen al weg'), { code: 'ERR_HTTP_HEADERS_SENT' }); };
  // Bij het weghalen van de oude koppen, en bij het zetten van de nieuwe (dan is de status al 503).
  for (const methode of ['removeHeader', 'setHeader']) {
    const { res } = doorPoort({}, (r, db) => {
      r.statusMessage = 'Gelukt';
      r[methode] = gooi;
      db.writable = false;
      r.write('eerste;'); r.end('slot');
    });
    assert.equal(res.einden, 1, methode + ': end() is aangekomen, het verzoek hangt niet tot de time-out');
    assert.equal(res.statusCode, 200, methode + ': de status van het oorspronkelijke antwoord staat terug');
    assert.equal(res.statusMessage, 'Gelukt', methode + ': en zijn statustekst ook');
    assert.equal(res.lijf(), 'eerste;slot', methode);
  }
});

test('een fout blijft staan: alleen een SUCCES wordt vervangen', () => {
  const { res } = doorPoort({}, (r, db) => { db.writable = false; r.status(400).json({ error: 'Kies vier woorden.' }); });
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.lijf()).error, 'Kies vier woorden.');
});

test('een stroom die bij de afzetting nog niet begonnen was, wordt een 503 en de rest wordt geslikt', () => {
  const { res } = doorPoort({}, (r, db) => {
    db.writable = false;
    r.write('eerste stuk;'); r.write('tweede stuk;'); r.end('slot');
  });
  isVervangen(res);
  assert.doesNotMatch(res.lijf(), /stuk|slot/);
});

test('rest: een stroom die al schreef, of koppen die al weg zijn, blijven ongemoeid', () => {
  const a = doorPoort({}, (r, db) => { r.write('al onderweg;'); db.writable = false; r.end('slot'); });
  assert.equal(a.res.statusCode, 200, 'een begonnen stroom is niet meer terug te draaien');
  assert.equal(a.res.lijf(), 'al onderweg;slot');
  const b = doorPoort({}, (r, db) => { r.headersSent = true; db.writable = false; r.end('{}'); });
  assert.equal(b.res.statusCode, 200);
  /* Onder de PostgreSQL-grens wacht een geschreven stuk tot de commit en staat
     headersSent nog op false. Vervangen zou daar ons lijf ACHTER het al
     gebufferde stuk plakken: een 503 met een half succeslijf ervoor. */
  const c = doorPoort({ bufferend: true }, (r, db) => { r.write('al onderweg;'); db.writable = false; r.end('slot'); });
  assert.equal(c.res.statusCode, 200, 'een gebufferde stroom is ook al begonnen');
  assert.equal(c.res.lijf(), 'al onderweg;slot');
});

test('lezen en de clusterroute krijgen geen haak: de demote zelf zegt 200', () => {
  const a = doorPoort({ methode: 'GET' }, (r, db) => { db.writable = false; r.json({ ok: true }); });
  assert.equal(a.res.statusCode, 200);
  const b = doorPoort({ pad: '/api/cluster/demote' }, (r, db) => { db.writable = false; r.json({ ok: true, active: false }); });
  assert.equal(b.res.statusCode, 200, 'zonder deze uitzondering kan de poortwachter niet zien dat de afzetting lukte');
});

test('de ingang zelf blijft weigeren zoals voorheen', () => {
  const { res, doorgelaten } = doorPoort({ writable: false }, () => {});
  assert.equal(doorgelaten, false);
  assert.equal(res.statusCode, 503);
  assert.match(JSON.parse(res.lijf()).error, /stand-by en neemt nu geen wijzigingen aan/);
});

/* ---------- 2. dezelfde haak in de echte schil, op node:http ---------- */
test('in de echte web()-app: json, gecomprimeerd, redirect en sendFile (een pipe) worden alle vier een 503', async () => {
  const web = require('../server/web');
  const { jsonGzip } = require('../server/middleware/compressie');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-n11-'));
  const bestand = path.join(dir, 'groot.txt');
  fs.writeFileSync(bestand, 'x'.repeat(256 * 1024)); // meer dan een stuk van de leesstroom
  const db = { writable: true };
  const app = web();
  app.use(standbyPoort(db));
  app.use(jsonGzip());
  const afzetten = (fn) => (req, res) => { db.writable = false; fn(req, res); };
  app.post('/json', afzetten((req, res) => res.json({ ok: true })));
  app.post('/groot', afzetten((req, res) => res.json({ ok: true, vulsel: 'y'.repeat(4096) })));
  app.post('/weg', afzetten((req, res) => res.redirect('/klaar')));
  app.post('/bestand', afzetten((req, res) => res.sendFile(bestand)));
  app.get('/lezen', afzetten((req, res) => res.json({ ok: true })));
  const srv = app.listen(0, '127.0.0.1');
  await new Promise(r => srv.once('listening', r));
  const basis = 'http://127.0.0.1:' + srv.address().port;
  try {
    for (const [pad, kop] of [['/json'], ['/groot', { 'Accept-Encoding': 'gzip' }], ['/weg'], ['/bestand']]) {
      db.writable = true;
      const r = await fetch(basis + pad, { method: 'POST', headers: kop || {}, redirect: 'manual' });
      const tekst = await r.text();
      assert.equal(r.status, 503, pad + ': verwacht 503, kreeg ' + r.status + ' ' + tekst.slice(0, 80));
      assert.equal(r.headers.get('retry-after'), '2', pad);
      assert.equal(r.headers.get('content-encoding'), null, pad + ': geen verpakking om een onverpakt lijf');
      assert.equal(r.headers.get('location'), null, pad);
      assert.equal(JSON.parse(tekst).code, 'STANDBY_TIJDENS_VERZOEK', pad);
    }
    db.writable = true;
    const lezen = await fetch(basis + '/lezen');
    assert.equal(lezen.status, 200, 'een GET krijgt geen haak');
  } finally {
    await new Promise(r => srv.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* Een vervangen sendFile: de leesstroom koppelt bij 'finish' los van res,
   maar sloot zich niet, en zijn bestandsdescriptor bleef open (de herkeuring
   mat 26 open na 30 verzoeken). Het bestand is groot genoeg om niet vanzelf
   uitgelezen te zijn voordat de 503 vertrekt. */
test('een vervangen sendFile sluit zijn leesstroom', async () => {
  const web = require('../server/web');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-n11-bron-'));
  const bestand = path.join(dir, 'groot.bin');
  fs.writeFileSync(bestand, Buffer.alloc(8 * 1024 * 1024, 7));
  const db = { writable: true };
  const app = web();
  app.use(standbyPoort(db));
  app.post('/bestand', (req, res) => { db.writable = false; res.sendFile(bestand); });
  const stromen = [];
  const echt = fs.createReadStream;
  fs.createReadStream = function (...a) { const s = echt.apply(this, a); if (a[0] === bestand) stromen.push(s); return s; };
  const srv = app.listen(0, '127.0.0.1');
  await new Promise(r => srv.once('listening', r));
  try {
    const r = await fetch('http://127.0.0.1:' + srv.address().port + '/bestand', { method: 'POST' });
    assert.equal(r.status, 503);
    assert.equal(JSON.parse(await r.text()).code, 'STANDBY_TIJDENS_VERZOEK');
    assert.equal(stromen.length, 1, 'de route opende het bestand');
    const dicht = await new Promise((klaar) => {
      if (stromen[0].closed) return klaar(true);
      const t = setTimeout(() => klaar(false), 2000);
      stromen[0].once('close', () => { clearTimeout(t); klaar(true); });
    });
    assert.equal(dicht, true, 'de leesstroom blijft open: een bestandsdescriptor per vervangen sendFile');
  } finally {
    fs.createReadStream = echt;
    await new Promise(r => srv.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------- 3. boven de PostgreSQL-grens ----------
   Daar betekent db.writable minder: de antwoordcommit in
   server/db/postgres-verzoeken.js kijkt niet naar db.writable, en een save()
   van voor de afzetting zou gewoon worden gecommit. De haak hangt erboven en
   maakt er een 503 van; dan hoort die grens NIETS te committen (een 503 is
   geen succes). Met een nepmotor die telt, zoals test/postgres-requestcommit. */
test('boven de PostgreSQL-grens: een 503 na de afzetting commit niets, zonder afzetting een keer', async () => {
  const web = require('../server/web');
  const state = require('../server/db/state');
  const context = require('../server/db/verzoekcontext');
  const maakGrens = require('../server/db/postgres-verzoeken');
  let commits = 0;
  const motor = {
    async commitVerzoek(data, wijzigingen) {
      commits++;
      for (const w of wijzigingen) data[w.sleutel] = JSON.parse(w.waardeJson);
      return { geschreven: wijzigingen.length };
    },
    pool: { query: async () => ({ rows: [] }) }, laadAlles: async () => state.getRuweData(),
    openstaandeWijzigingen: () => []
  };
  const grens = maakGrens({ store: 'postgres', db: state.db, state, motor: () => motor,
    slot: fn => fn(), basisKlaar: () => true });
  grens.gestart();
  const db = { writable: true };
  const app = web();
  app.use(grens.middleware());     // eerst de grens, zoals in server/opzet/verzoekketen.js
  app.use(standbyPoort(db));
  app.post('/api/proef', (req, res) => {
    state.db.data.bewijs.push({ id: 'een' }); context.noteerSave();
    if (req.query.afzetten) db.writable = false;
    res.json({ ok: true });
  });
  const srv = app.listen(0, '127.0.0.1');
  await new Promise(r => srv.once('listening', r));
  const basis = 'http://127.0.0.1:' + srv.address().port;
  try {
    state.setRuweData({ bewijs: [] });
    const a = await fetch(basis + '/api/proef?afzetten=1', { method: 'POST' });
    assert.equal(a.status, 503, 'na de afzetting geen 200');
    assert.equal((await a.json()).code, 'STANDBY_TIJDENS_VERZOEK');
    assert.equal(commits, 0, 'een 503 hoort de PostgreSQL-grens niet te laten committen');
    assert.deepEqual(state.getRuweData().bewijs, []);

    db.writable = true;
    const b = await fetch(basis + '/api/proef', { method: 'POST' });
    assert.equal(b.status, 200, 'controle: zonder afzetting gewoon 200');
    assert.equal(commits, 1);
    assert.deepEqual(state.getRuweData().bewijs, [{ id: 'een' }]);
  } finally {
    grens.stop();
    await new Promise(r => srv.close(r));
  }
});

/* ---------- 4. de herhaling na de 503: de idempotentielagen ----------
   De 503 vraagt om een nieuwe poging met dezelfde sleutel. De drie lagen die
   een antwoord onthouden (server/lib/idem-poort.js, server/lib/dubbeltik.js,
   server/middleware/idempotentie.js) deden dat al in res.json, VOOR de haak er
   een 503 van maakte, en gaven die herhaling dan 200 herhaald:true terwijl de
   route niet opnieuw draaide. Sinds de herkeuring onthouden ze de status die
   werkelijk vertrok (server/lib/eindstatus.js).

   Per laag apart, zodat een terugval in EEN laag een eigen toets laat zakken,
   en daarna de hele keten in de volgorde van server/opzet/: stand-bypoort,
   idem-poort, compressie, dubbeltik, idempotentie. */
const maakIdemPoort = require('../server/lib/idem-poort');
const { maakDubbeltik } = require('../server/lib/dubbeltik');
const maakIdempotentie = require('../server/middleware/idempotentie');
const wacht = (ms) => new Promise(r => setTimeout(r, ms));
const stilleDubbeltik = () => maakDubbeltik({ log: { warn() {} } }).middleware();

async function ketenApp(lagen, { eigenHttp = false } = {}) {
  const web = require('../server/web');
  const db = { writable: true };
  const stand = { afzetten: false, keer: 0, rem: null, groot: false };
  const app = web();
  app.use(standbyPoort(db));
  app.use(web.json());
  for (const laag of lagen) app.use(laag);
  const route = async (req, res) => {
    stand.keer++;
    if (stand.rem) await stand.rem;
    if (stand.afzetten) db.writable = false;
    res.json({ ok: true, keer: stand.keer, vulsel: stand.groot ? 'v'.repeat(4096) : '' });
  };
  app.post('/api/proef/herhaal', route);
  app.post('/api/gewoonten/maak', route);   // verklaard in server/lib/idemsleutels-basis.js: zelfde verzoek
  const vorige = process.env.RTG_EIGEN_HTTP;
  if (eigenHttp) process.env.RTG_EIGEN_HTTP = '1';
  const srv = app.listen(0, '127.0.0.1');
  if (eigenHttp) { if (vorige === undefined) delete process.env.RTG_EIGEN_HTTP; else process.env.RTG_EIGEN_HTTP = vorige; }
  await new Promise(r => srv.once('listening', r));
  const basis = 'http://127.0.0.1:' + srv.address().port;
  const stuur = async (pad, { kop = {}, lijf = {} } = {}, signaal) => {
    const r = await fetch(basis + pad, { method: 'POST', signal: signaal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer lid-a', ...kop }, body: JSON.stringify(lijf) });
    return { status: r.status, lijf: await r.json() };
  };
  const sluit = () => new Promise(r => { if (srv.closeAllConnections) srv.closeAllConnections(); srv.close(r); });
  return { db, stand, stuur, sluit };
}

/* De kern van de bevinding, voor een pad en een sleutelvorm: eerst de 503,
   dan opnieuw leider, dan dezelfde poging. Die hoort de route te laten draaien.
   Een derde poging daarna laat zien dat de laag gewoon blijft beschermen:
   anders zou "nooit meer onthouden" deze toets ook halen. */
async function naDe503(app, pad, vorm, naam) {
  app.stand.afzetten = true; app.db.writable = true;
  const keer = app.stand.keer;
  const a = await app.stuur(pad, vorm);
  assert.equal(a.status, 503, naam + ': de eerste poging wordt een 503');
  assert.equal(a.lijf.code, 'STANDBY_TIJDENS_VERZOEK', naam);
  app.stand.afzetten = false; app.db.writable = true;   // opnieuw leider
  const b = await app.stuur(pad, vorm);
  assert.equal(b.status, 200, naam);
  assert.notEqual(b.lijf.herhaald, true,
    naam + ': de herhaling na een 503 kreeg een bewaarde 200 (' + JSON.stringify(b.lijf).slice(0, 80) + ')');
  assert.equal(app.stand.keer, keer + 2, naam + ': de route hoort opnieuw te draaien');
  const c = await app.stuur(pad, vorm);
  assert.equal(c.lijf.herhaald, true, naam + ': controle, daarna onthoudt de laag gewoon weer');
  assert.equal(app.stand.keer, keer + 2, naam + ': en draait de route niet nog een keer');
}

test('idem-poort: na de 503 doet dezelfde sleutel het werk opnieuw (kop en verklaarde sleutel)', async () => {
  const app = await ketenApp([maakIdemPoort()]);
  try {
    await naDe503(app, '/api/proef/herhaal', { kop: { 'Idempotency-Key': 'n11-idem-kop' } }, 'kop Idempotency-Key');
    // Geen sleutel van de client: de poort leidt er zelf een af uit de verklaring van de route.
    await naDe503(app, '/api/gewoonten/maak', { lijf: { naam: 'lopen' } }, 'verklaarde sleutel');
  } finally { await app.sluit(); }
});

test('dubbeltik: na de 503 doet dezelfde sleutel het werk opnieuw (lijf idem en de kop)', async () => {
  const app = await ketenApp([stilleDubbeltik()]);
  try {
    await naDe503(app, '/api/proef/herhaal', { lijf: { idem: 'n11-dubbel-lijf' } }, 'lijf idem');
    await naDe503(app, '/api/proef/herhaal', { kop: { 'Idempotency-Key': 'n11-dubbel-kop' } }, 'kop Idempotency-Key');
  } finally { await app.sluit(); }
});

test('idempotentie: na de 503 doet dezelfde sleutel het werk opnieuw (idempotentieSleutel en idem)', async () => {
  const app = await ketenApp([maakIdempotentie()]);
  try {
    await naDe503(app, '/api/proef/herhaal', { lijf: { idempotentieSleutel: 'n11-idempo-lijf' } }, 'lijf idempotentieSleutel');
    await naDe503(app, '/api/proef/herhaal', { lijf: { idem: 'n11-idempo-idem' } }, 'lijf idem');
  } finally { await app.sluit(); }
});

test('de hele keten in volgorde, ook een gecomprimeerd antwoord dat pas later eindigt', async () => {
  const { jsonGzip } = require('../server/middleware/compressie');
  const app = await ketenApp([maakIdemPoort(), jsonGzip(), stilleDubbeltik(), maakIdempotentie()]);
  try {
    await naDe503(app, '/api/proef/herhaal', { kop: { 'Idempotency-Key': 'n11-keten-kop' } }, 'keten, kop');
    await naDe503(app, '/api/proef/herhaal', { lijf: { idem: 'n11-keten-idem' } }, 'keten, lijf idem');
    await naDe503(app, '/api/proef/herhaal', { lijf: { idempotentieSleutel: 'n11-keten-sleutel' } }, 'keten, idempotentieSleutel');
    await naDe503(app, '/api/gewoonten/maak', { lijf: { naam: 'zwemmen' } }, 'keten, verklaard');
    /* Boven de kilobyte en met Accept-Encoding comprimeert de compressielaag
       ASYNCHROON: res.end komt pas na de zlib-ronde, als de lagen hun res.json
       al lang hebben gehad. */
    app.stand.groot = true;
    await naDe503(app, '/api/proef/herhaal', { kop: { 'Accept-Encoding': 'gzip' }, lijf: { idem: 'n11-keten-groot' } },
      'keten, gecomprimeerd');
  } finally { await app.sluit(); }
});

/* Wie TEGELIJK met dezelfde sleutel binnenkomt, wacht in de idem-poort en de
   dubbeltik op de uitslag van de eerste. Werd die een 503, dan hoort de wachter
   geen 200 herhaald:true te krijgen maar het zelf te doen: hier valt hij dan
   op dezelfde afzetting en krijgt hij zijn eigen 503. */
for (const [naam, laag, vorm] of [
  ['idem-poort', () => maakIdemPoort(), { kop: { 'Idempotency-Key': 'n11-wacht-kop' } }],
  ['dubbeltik', stilleDubbeltik, { lijf: { idem: 'n11-wacht-lijf' } }]
]) {
  test(naam + ': een wachter achter een eerste die een 503 werd, krijgt geen bewaarde 200', async () => {
    const app = await ketenApp([laag()]);
    try {
      let los;
      app.stand.rem = new Promise(r => { los = r; });
      const eerste = app.stuur('/api/proef/herhaal', vorm);
      await wacht(50);
      const tweede = app.stuur('/api/proef/herhaal', vorm);
      await wacht(50);
      assert.equal(app.stand.keer, 1, 'de tweede wacht op de eerste in plaats van ernaast te draaien');
      app.stand.afzetten = true;
      los();
      const [a, b] = await Promise.all([eerste, tweede]);
      assert.equal(a.status, 503);
      assert.notEqual(b.lijf.herhaald, true, 'de wachter kreeg de 200 die nooit vertrok: ' + JSON.stringify(b.lijf).slice(0, 80));
      /* De dragende regel. Kreeg de wachter het antwoord van de eerste, dan
         maakte zijn eigen haak daar hier toevallig ook een 503 van (de afzetting
         stond nog); dat het werk opnieuw gebeurde, ziet alleen de teller. */
      assert.equal(app.stand.keer, 2, 'de wachter deed het werk zelf in plaats van het antwoord van de eerste te krijgen');
      assert.equal(b.status, 503, 'en viel daarbij op dezelfde afzetting');
    } finally { app.stand.rem = null; await app.sluit(); }
  });
}

/* WAAROM NIET OP 'finish' ALLEEN. Een klant die het opgeeft (een load
   balancer die afbreekt en het straks opnieuw probeert) sluit de verbinding,
   en node:http geeft daarna geen 'finish' meer. De route maakt zijn werk af,
   en dat antwoord hoort onthouden te worden: de nieuwe poging met dezelfde
   sleutel krijgt het dan terug in plaats van het werk een tweede keer te doen.
   Zo deed de idem-poort het al, en dat mag de reparatie niet slopen. */
test('idem-poort: een antwoord na een afgebroken verbinding wordt nog steeds onthouden', async () => {
  const app = await ketenApp([maakIdemPoort()]);
  try {
    let los;
    app.stand.rem = new Promise(r => { los = r; });
    const vorm = { kop: { 'Idempotency-Key': 'n11-afgebroken' } };
    const ac = new AbortController();
    const eerste = app.stuur('/api/proef/herhaal', vorm, ac.signal).catch(e => ({ afgebroken: e.name }));
    await wacht(50);
    ac.abort();
    assert.ok((await eerste).afgebroken, 'de klant gaf het op');
    await wacht(50);
    los();
    await wacht(100);   // de route maakt zijn werk af, zonder iemand aan de lijn
    app.stand.rem = null;
    const b = await app.stuur('/api/proef/herhaal', vorm);
    assert.equal(b.status, 200);
    assert.equal(b.lijf.herhaald, true, 'de nieuwe poging krijgt het antwoord dat de route al gaf');
    assert.equal(app.stand.keer, 1, 'en het werk gebeurt geen tweede keer');
  } finally { app.stand.rem = null; await app.sluit(); }
});

/* In PostgreSQL-modus wacht server/lib/eindstatus.js NIET op res.end: daar
   stelt de verzoekgrens het eind uit tot na de commit, en direct na de
   aanroep van res.end staat er dan nog een 200 terwijl de commit nog moet
   komen. Daar onthouden de lagen via haakNaCommit, en bij een mislukte commit
   dus niets. */
test('boven de PostgreSQL-grens: een mislukte commit laat geen onthouden 200 achter', async () => {
  const web = require('../server/web');
  const state = require('../server/db/state');
  const context = require('../server/db/verzoekcontext');
  const maakGrens = require('../server/db/postgres-verzoeken');
  let faal = true;
  const motor = {
    async commitVerzoek(data, wijzigingen) {
      if (faal) throw new Error('verbinding viel voor de COMMIT weg');
      for (const w of wijzigingen) data[w.sleutel] = JSON.parse(w.waardeJson);
      return { geschreven: wijzigingen.length };
    },
    pool: { query: async () => ({ rows: [] }) }, laadAlles: async () => state.getRuweData(),
    openstaandeWijzigingen: () => []
  };
  const grens = maakGrens({ store: 'postgres', db: state.db, state, motor: () => motor,
    slot: fn => fn(), basisKlaar: () => true });
  grens.gestart();
  const db = { writable: true };
  const app = web();
  app.use(grens.middleware());
  app.use(standbyPoort(db));
  app.use(web.json());
  for (const laag of [maakIdemPoort(), stilleDubbeltik(), maakIdempotentie()]) app.use(laag);
  let keer = 0;
  app.post('/api/proef/herhaal', (req, res) => {
    keer++;
    state.db.data.bewijs.push({ id: 'keer-' + keer }); context.noteerSave();
    res.json({ ok: true, keer });
  });
  const srv = app.listen(0, '127.0.0.1');
  await new Promise(r => srv.once('listening', r));
  const basis = 'http://127.0.0.1:' + srv.address().port;
  const stuur = async (vorm) => {
    const r = await fetch(basis + '/api/proef/herhaal', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer lid-a', ...(vorm.kop || {}) },
      body: JSON.stringify(vorm.lijf || {}) });
    return { status: r.status, lijf: await r.json() };
  };
  try {
    for (const vorm of [{ kop: { 'Idempotency-Key': 'n11-pg-kop' } }, { lijf: { idempotentieSleutel: 'n11-pg-lijf' } }]) {
      state.setRuweData({ bewijs: [] });
      faal = true;
      const voor = keer;
      const a = await stuur(vorm);
      assert.equal(a.status, 503, 'de commit mislukte');
      faal = false;
      await grens.herstelNu();
      const b = await stuur(vorm);
      assert.equal(b.status, 200);
      assert.notEqual(b.lijf.herhaald, true, 'een 200 die nooit is gecommit, werd onthouden: ' + JSON.stringify(b.lijf));
      assert.equal(keer, voor + 2, 'de route draaide opnieuw');
      assert.equal(state.getRuweData().bewijs.length, 1, 'en nu staat het er een keer');
    }
  } finally {
    grens.stop();
    await new Promise(r => srv.close(r));
  }
});

/* De eigen HTTP-motor (server/lib/http1-res.js, RTG_EIGEN_HTTP=1) geeft
   'finish' BINNEN zijn end. De dubbeltik ruimt op 'finish' een rij op die nog
   niet bewaard is; komt die eerst, dan is er daarna niets meer te herhalen.
   De dubbeltik staat hier ALLEEN: met de andere twee erbij vangen die de
   herhaling op en ziet niemand dat de dubbeltik zijn rij kwijt is. */
test('op de eigen HTTP-motor: dezelfde uitkomst, en de dubbeltik blijft daarna beschermen', async () => {
  const app = await ketenApp([stilleDubbeltik()], { eigenHttp: true });
  try {
    await naDe503(app, '/api/proef/herhaal', { lijf: { idem: 'n11-eigen-idem' } }, 'eigen motor, lijf idem');
    await naDe503(app, '/api/proef/herhaal', { kop: { 'Idempotency-Key': 'n11-eigen-kop' } }, 'eigen motor, kop');
  } finally { await app.sluit(); }
});
