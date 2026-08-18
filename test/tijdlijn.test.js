/* De tijdlijn (kern/tijdlijn.js). Hij bezit niets: elke regel komt uit een laag
   die het lid al had.

   Wat hier wordt vastgezet:
   1. GEEN VERBANDEN EN GEEN SCORE. Dingen naast elkaar zetten is iets anders dan
      zeggen wat ze betekenen; dat laatste is een medische uitspraak.
   2. ALLEEN WAT GEWEEST IS. Een tijdlijn die de toekomst meeneemt, is een agenda
      die zich voordoet als geschiedenis.
   3. ELKE REGEL DRAAGT ZIJN HERKOMST. Het verschil tussen zelf ingevuld en door
      een behandelaar vastgelegd is bij terugkijken het hele verhaal.
   4. EEN KAPOTTE LAAG WORDT GEMELD. In een tijdlijn leest een gat als "toen
      gebeurde er niets", en dat is het ergste wat een gat kan betekenen.
   Draai los: node --test test/tijdlijn.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, sup;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tijdlijn-'));
const dagVan = d => new Date(d).toISOString().slice(0, 10);
const overDagen = n => dagVan(new Date(Date.now() + n * 86400000));

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

test('een lege tijdlijn is leeg, en zegt zelf dat hij niets afleidt', async () => {
  const r = await api('tijdlijn', {}, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.leeg, true);
  assert.deepEqual(r.body.maanden, []);
  assert.match(r.body.uitleg, /legt zelf niets vast/i);
  assert.match(r.body.uitleg, /geen verbanden/i);
  assert.deepEqual(r.body.storingen, []);
});

test('een doel verschijnt met zijn begindatum, uit de doelenlaag', async () => {
  await api('doelen/maak', { titel: '10 kilometer hardlopen', reden: 'ik wil het kunnen',
    eenheid: 'km', nulmeting: 2, streef: 10, streefOp: overDagen(60) }, lid);
  const d = (await api('tijdlijn', {}, lid)).body;
  assert.equal(d.leeg, false);
  const regels = d.maanden.flatMap(m => m.regels);
  const doel = regels.find(r => /10 kilometer/.test(r.wat));
  assert.ok(doel, 'het doel staat op de tijdlijn');
  assert.equal(doel.soort, 'doel');
  assert.equal(doel.naam, 'Doelen', 'met de laag waar het vandaan komt');
  assert.equal(doel.naar, '/apps/doelen.html', 'en de weg ernaartoe');
  assert.equal(doel.herkomst, 'zelf');
});

test('de regels staan op maand, nieuwste eerst', async () => {
  const d = (await api('tijdlijn', {}, lid)).body;
  assert.ok(d.maanden.length >= 1);
  assert.match(d.maanden[0].label, /[a-z]+ \d{4}/, 'een leesbare maandkop: ' + d.maanden[0].label);
  const sleutels = d.maanden.map(m => m.maand);
  assert.deepEqual(sleutels, [...sleutels].sort().reverse(), 'nieuwste maand bovenaan');
});

test('wat nog moet komen staat er NIET in', async () => {
  /* Een tijdlijn die de toekomst meeneemt is een agenda die zich voordoet als
     geschiedenis. Dit wordt op de laag zelf nagerekend, want via de API is er
     geen afspraak in het verleden te maken. */
  const maak = require('../server/kern/tijdlijn');
  const nu = new Date('2026-05-10T12:00:00Z');
  const laag = maak({ kern: {
    careMijn: () => ({ boekingen: [
      { datum: '2026-05-01', behandelingNaam: 'Consult', aanbiederNaam: 'Kliniek' },
      { datum: '2026-05-20', behandelingNaam: 'Nog te gaan', aanbiederNaam: 'Kliniek' }
    ] }),
    verzorgingLeden: { mijn: () => ({ afspraken: [] }) },
    doelenVan: () => ({ doelen: [] }),
    toestellenVan: () => ({ toestellen: [] }),
    metingenVan: () => ({ onderwerpen: {} }),
    metingenHistorie: () => []
  } });
  const d = laag.tijdlijnVoor('k', 'CODE', nu);
  const watten = d.maanden.flatMap(m => m.regels).map(r => r.wat);
  assert.deepEqual(watten, ['Consult'], 'alleen wat geweest is');
});

test('wat een behandelaar vastlegde staat erin, met wie het deed', async () => {
  const maak = require('../server/kern/tijdlijn');
  const laag = maak({ kern: {
    careMijn: () => ({ boekingen: [] }),
    verzorgingLeden: { mijn: () => ({ afspraken: [] }) },
    doelenVan: () => ({ doelen: [] }),
    toestellenVan: () => ({ toestellen: [] }),
    metingenVan: () => ({ onderwerpen: { gewicht: { label: 'Gewicht', eenheid: 'kg' } } }),
    metingenHistorie: (key, o) => {
      assert.equal(o.bron, 'behandelaar', 'de tijdlijn vraagt om precies die bron');
      return [{ onderwerp: 'gewicht', op: '2026-04-02', waarde: 81, bron: 'behandelaar', door: 'Kliniek Noord' }];
    }
  } });
  const r = laag.tijdlijnVoor('k', 'CODE', new Date('2026-05-10T12:00:00Z')).maanden[0].regels[0];
  assert.equal(r.wat, 'Gewicht');
  assert.match(r.waar, /81 kg/);
  assert.match(r.waar, /Kliniek Noord/, 'met wie het vastlegde');
  assert.equal(r.herkomst, 'behandelaar',
    'en de herkomst staat erbij: dat verschil is bij terugkijken het hele verhaal');
});

test('er staat nergens een verband of een score', async () => {
  const d = (await api('tijdlijn', {}, lid)).body;
  const data = JSON.stringify(d.maanden);
  assert.ok(!/doordat|waardoor|omdat|sinds .* slechter|verband|correlat/i.test(data),
    'geen verbanden: dat is een medische uitspraak');
  assert.ok(!/score|punten|cijfer|trend|percentiel/i.test(data), 'en geen score over de tijd');
  assert.deepEqual(Object.keys(d).sort(),
    ['aantal', 'leeg', 'maanden', 'ok', 'storingen', 'uitleg', 'vandaag'],
    'en geen veld erbij waar een oordeel in past');
});

test('een kapotte laag wordt gemeld en niet als leegte getoond', async () => {
  const maak = require('../server/kern/tijdlijn');
  const d = maak({ kern: { careMijn: () => { throw new Error('boem'); } } }).tijdlijnVoor('k', 'CODE');
  assert.ok(d.storingen.some(s => /Zorg/.test(s) && /fout/i.test(s)));
  assert.ok(d.storingen.some(s => /Doelen/.test(s) && /niet aangesloten/i.test(s)));
  assert.equal(d.leeg, true, 'en er wordt niets verzonnen om het gat te vullen');
});

test('niemand anders komt bij uw tijdlijn', async () => {
  assert.equal((await api('tijdlijn', {}, sup)).status, 401);
  assert.equal((await api('tijdlijn', {}, '')).status, 401);
});
