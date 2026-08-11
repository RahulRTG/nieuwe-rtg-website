/* Het trainingsschema (kern/trainingsschema.js).
   Draai los: node --experimental-sqlite --test test/trainingsschema.test.js Dezelfde vorm als het medicatieschema, en om
   dezelfde reden: RTG schrijft geen trainingsschema voor.

   Wat hier wordt vastgezet:
   1. WAT ERIN GAAT IS WAT U INTIKT. Geen sets, geen opbouw, geen belastingscore,
      geen oefeningenbibliotheek -- en geen veld dat RTG zelf heeft bedacht.
   2. AFTEKENEN SCHRIJFT NAAR DE BESTAANDE BEWEEGMETING, niet naar een tweede
      beweegtotaal hier (LAT.md regel 4), en met herkomst "zelf".
   3. HERTELLEN, NIET AFTREKKEN. Wie twee keer aftekent en er een weghaalt, houdt
      anders een cijfer over dat nergens meer op slaat.
   4. Een mislukte schrijfactie staat IN HET ANTWOORD (regel 5).
   */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, sup;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-training-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
  lid = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'rtg' }) }).then(r => r.json()).then(d => d.token);
  sup = (await api('supplier/login', { username: 'rahul', password: 'Imran' }, '')).body.token;
  assert.ok(lid && sup);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een leeg schema zegt zelf waar RTG niet over gaat', async () => {
  const r = await api('training', {}, lid);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.schema, []);
  assert.deepEqual(r.body.gedaan, []);
  assert.match(r.body.grens.kop, /schrijft geen training voor/i);
  assert.ok(r.body.grens.wegen.some(w => /fysiotherapeut|huisarts/i.test(w.naam)));
  assert.match(r.body.uitleg, /rekent geen belasting/i);
});

test('wat erin gaat is wat u intikt, en er komt niets bij', async () => {
  const r = await api('training/zet', { naam: 'Rustige duurloop', wat: '40 min zone 2, eigen tempo',
    dagen: '2,4,6', duurMin: 40, vanWie: 'Coach Ali' }, lid);
  const t = r.body.schema[0];
  assert.equal(t.naam, 'Rustige duurloop');
  assert.deepEqual(t.dagen, [2, 4, 6]);
  assert.equal(t.duurMin, 40);
  assert.equal(t.vanWie, 'Coach Ali', 'van wie het schema is, want dat is meestal niet RTG');
  assert.deepEqual(Object.keys(t).sort(),
    ['dagen', 'duurMin', 'gemaakt', 'id', 'naam', 'vanWie', 'wat'],
    'geen veld dat RTG zelf heeft bedacht: geen zone, geen belasting, geen score');
});

test('een vertypte dag valt niet stilletjes weg', async () => {
  const r = await api('training/zet', { naam: 'Kracht', dagen: '1, maandag, 9', duurMin: 50 }, lid);
  const t = r.body.schema.find(x => x.naam === 'Kracht');
  assert.deepEqual(t.dagen, [1], 'alleen echte dagnummers blijven staan');
  assert.match(r.body.gewaarschuwd || '', /dag is een nummer/i);
});

test('aftekenen schrijft naar de bestaande beweegmeting, met herkomst zelf', async () => {
  const id = (await api('training', {}, lid)).body.schema.find(x => x.naam === 'Rustige duurloop').id;
  const r = await api('training/deed', { schemaId: id }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.meting.ok, true);
  assert.equal(r.body.meting.minuten, 40, 'de duur uit het schema telt mee');

  /* En dat cijfer staat echt in de metingenlaag, niet in een eigen tweede
     beweegtotaal hier. */
  const m = (await api('metingen', {}, lid)).body;
  assert.equal(m.beeld.beweging.vandaag, 40, 'de dagmeting beweging staat op 40');
  assert.deepEqual(m.beeld.beweging.herkomsten, ['zelf'],
    'op uw eigen woord: u bent degene die zegt dat u het deed');
});

test('twee trainingen op een dag tellen op, en weghalen telt opnieuw', async () => {
  await api('training/deed', { wat: 'Losse wandeling', duurMin: 20 }, lid);
  let m = (await api('metingen', {}, lid)).body;
  assert.equal(m.beeld.beweging.vandaag, 60, '40 + 20');

  const wandeling = (await api('training', {}, lid)).body.gedaan.find(g => g.wat === 'Losse wandeling');
  const r = await api('training/deed-weg', { id: wandeling.id }, lid);
  assert.equal(r.body.meting.minuten, 40, 'er wordt herteld uit wat er over is');
  m = (await api('metingen', {}, lid)).body;
  assert.equal(m.beeld.beweging.vandaag, 40);
});

test('de training van gisteren telt niet mee in het cijfer van vandaag', async () => {
  /* Via de API kan alleen voor vandaag worden afgetekend, dus dit gat is daar
     niet te zien: de vorige toets zette alles op dezelfde dag en bleef daarom
     groen toen de optelling over ALLE dagen liep. Hier krijgt de laag zijn eigen
     klok mee. */
  const maak = require('../server/kern/trainingsschema');
  const geschreven = [];
  const laag = maak({ db: { data: {} }, save: () => {},
    schoon: (s, n) => String(s || '').slice(0, n), crypto: require('crypto'),
    metingZet: (k, body) => { geschreven.push(body); return { ok: true }; } });

  const gisteren = new Date('2026-05-04T10:00:00Z');
  const vandaag = new Date('2026-05-05T10:00:00Z');
  laag.trainingDeed('k', { wat: 'Gisteren', duurMin: 90 }, gisteren);
  laag.trainingDeed('k', { wat: 'Vandaag', duurMin: 25 }, vandaag);

  assert.deepEqual(geschreven[0], { onderwerp: 'beweging', waarde: 90, op: '2026-05-04' });
  assert.deepEqual(geschreven[1], { onderwerp: 'beweging', waarde: 25, op: '2026-05-05' },
    'alleen de minuten van die dag, en op die dag geschreven');
});

test('de laatste training weghalen zet uw beweging niet op nul', async () => {
  /* Nul zou een bewering zijn die RTG niet kan doen: u kunt die dag ook zonder
     training hebben bewogen. De meting blijft staan zoals hij stond, en het
     antwoord zegt waarom. */
  const laatste = (await api('training', {}, lid)).body.gedaan[0];
  const r = await api('training/deed-weg', { id: laatste.id }, lid);
  assert.equal(r.body.meting.ok, true);
  assert.match(r.body.meting.uitleg, /niet op nul/i);
  const m = (await api('metingen', {}, lid)).body;
  assert.equal(m.beeld.beweging.vandaag, 40, 'de meting die er stond, staat er nog');
});

test('een mislukte schrijfactie staat in het antwoord en niet alleen in de logs', async () => {
  const maak = require('../server/kern/trainingsschema');
  const db = { data: {} };
  const laag = maak({ db, save: () => {}, schoon: (s, n) => String(s || '').slice(0, n),
    crypto: require('crypto'), metingZet: () => { throw new Error('boem'); } });
  const r = laag.trainingDeed('k', { wat: 'Iets', duurMin: 30 });
  assert.equal(r.meting.ok, false);
  assert.match(r.meting.uitleg, /niet bijgewerkt/i, 'het lid hoort te horen dat zijn cijfer niet klopt');

  const zonder = maak({ db: { data: {} }, save: () => {}, schoon: (s, n) => String(s || '').slice(0, n),
    crypto: require('crypto') });
  assert.equal(zonder.trainingDeed('k', { wat: 'Iets', duurMin: 30 }).meting.ok, false,
    'en een laag die er helemaal niet is, ook');
});

test('wat vandaag op schema staat, staat er zonder aansporing', async () => {
  /* Een training die op de dag van vandaag valt, want anders toetst dit een lege
     lijst -- en een lege lijst draagt vanzelf geen oordeel. */
  const vandaagNr = new Date().getUTCDay() || 7;
  await api('training/zet', { naam: 'Vandaag iets', dagen: String(vandaagNr), duurMin: 30 }, lid);

  const d = (await api('training', {}, lid)).body;
  assert.ok(d.vandaagOpSchema.some(x => x.naam === 'Vandaag iets'),
    'de training van vandaag staat erbij');

  /* Alleen de DATA scannen, niet de vaste uitleg: die zegt met opzet "RTG zegt
     niet of u te hard traint", en een scan over het hele antwoord slaat dan aan
     op de zin die de belofte doet. Dat kostte deze toets een ronde. */
  const data = JSON.stringify({ schema: d.schema, vandaagOpSchema: d.vandaagOpSchema, gedaan: d.gedaan });
  assert.ok(!/\d+\s*dag(en)?\s*(niet|geleden|op rij)/i.test(data),
    'geen "u bent al drie dagen niet geweest": dat is een verwijt met een teller');
  assert.ok(!/reeks|streak|score|belasting|te hard|te weinig/i.test(data),
    'en geen reeks en geen oordeel in de gegevens');
  const velden = new Set(d.vandaagOpSchema.flatMap(x => Object.keys(x)));
  assert.deepEqual([...velden].sort(),
    ['dagen', 'duurMin', 'gedaan', 'gemaakt', 'id', 'naam', 'vanWie', 'wat'],
    'en geen veld erbij waar een oordeel in past');

  // en de vaste teksten zeggen wel wat ze horen te zeggen
  assert.match(d.uitleg, /zegt niet of u te hard of te zacht traint/i);
});

test('een onbekend schema of logboekregel geeft 404, en niemand anders komt erbij', async () => {
  assert.equal((await api('training/deed', { schemaId: 'bestaat-niet' }, lid)).status, 404);
  assert.equal((await api('training/weg', { id: 'bestaat-niet' }, lid)).status, 404);
  assert.equal((await api('training/deed-weg', { id: 'bestaat-niet' }, lid)).status, 404);
  assert.equal((await api('training/deed', { wat: 'Iets' }, lid)).status, 400, 'zonder duur geen regel');

  assert.equal((await api('training', {}, sup)).status, 401);
  assert.equal((await api('training/zet', { naam: 'X' }, '')).status, 401);
});
