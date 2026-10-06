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

test('koppen over het oude lijf gaan weg: verpakking, lengte, cookie', () => {
  const { res } = doorPoort({}, (r, db) => {
    r.set('Content-Encoding', 'gzip').set('Content-Length', '999').set('Set-Cookie', 'rtg=nieuw').set('ETag', '"x"');
    db.writable = false;
    r.send(zlib.gzipSync(JSON.stringify({ ok: true })));
  });
  isVervangen(res);
  for (const k of ['content-encoding', 'content-length', 'set-cookie', 'etag'])
    assert.equal(res.getHeader(k), undefined, k + ' hoort niet bij het 503-lijf');
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
