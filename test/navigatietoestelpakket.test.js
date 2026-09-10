/* HET PAKKET VOOR HET TOESTEL -- kern/navigatie/toestelpakket.js.

   Deze laag stuurt BYTES uit RTG_DATA_DIR naar een lid. Wat hier bewezen moet
   worden is dus niet dat er een lijst uitkomt, maar de vier dingen die echt
   fout kunnen gaan:

     1. de gesloten lijst. Een lid vraagt om een van acht delen en nooit om een
        bestandsnaam. Zonder die grens staat RTG_DATA_DIR open -- daar liggen
        ook de sleutels en de database. De SQLite naast de graaf zit er met
        opzet NIET in, en dat is een toets en geen belofte.
     2. de licentiepoort gaat VOOR de bytes. Een pakket op een toestel zetten is
        verspreiden; ODbL eist dan naamsvermelding. Geen vermelding, geen
        manifest -- en ook geen bytes, want de tweede route vraagt dezelfde
        poort.
     3. een half pakket is geen pakket. Ontbreekt een deel, dan weigert het HELE
        manifest met de naam erin; zeven delen aanbieden laat het toestel zelf
        ontdekken dat de graaf niet compleet is.
     4. het controlegetal moet MEEBEWEGEN. Een som die op een cache blijft
        staan nadat het bestand veranderde, is erger dan geen som: het toestel
        denkt dan dat het de nieuwe kaart heeft.

   Draai los: node --test test/navigatietoestelpakket.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { bouwPakket } = require('./navigatie-pakket-fixture');

const NL_VAK = { lat0: 50.7, lat1: 53.72, lng0: 3.2, lng1: 7.3 };
const GEBIEDEN = [
  { code: 'nederland', naam: 'Nederland', soort: 'land', vak: NL_VAK,
    downloadAdres: 'https://example.invalid/nederland.osm.pbf' },
  { code: 'frankrijk', naam: 'Frankrijk', soort: 'land', vak: { lat0: 41, lat1: 51.2, lng0: -5.2, lng1: 9.6 },
    downloadAdres: 'https://example.invalid/frankrijk.osm.pbf' }
];
const DELEN = ['graaf.json', 'coords.f64', 'offsets.u32', 'doelen.u32',
  'kosten.f32', 'lengtes.f32', 'wegen.u32', 'vlaggen.u8'];

/* Dezelfde wereld als test/navigatiemijnkaarten.js: een verse datamap met een
   index en desgevraagd een gebouwd pakket. De modules gaan er opnieuw in omdat
   de gebiedenlaag zijn index en catalogus op een mtime onthoudt. */
/* ASYNC EN NIET SYNC, EN DAT IS GEEN SMAAK. Met `try { return fn() } finally
   { rmSync() }` ruimt de finally de datamap op zodra de promise TERUGKOMT, dus
   voordat het manifest zijn bestanden heeft gelezen -- zeven van de tien
   toetsen zakten hier op ENOENT terwijl er niets mis was met de laag. */
async function metWereld(fn, { bouw = [], licentie = 'ODbL 1.0', naamsvermelding = 'OpenStreetMap-bijdragers' } = {}) {
  const oud = process.env.RTG_DATA_DIR;
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toestelpakket-'));
  const nav = path.join(map, 'navigatie');
  fs.mkdirSync(nav, { recursive: true });
  fs.writeFileSync(path.join(nav, 'gebieden.json'), JSON.stringify({
    bron: 'fixture', licentie, naamsvermelding, gebieden: GEBIEDEN }));
  for (const code of bouw) {
    const g = GEBIEDEN.find(x => x.code === code);
    bouwPakket({ map: nav, code, lat: (g.vak.lat0 + g.vak.lat1) / 2, lng: (g.vak.lng0 + g.vak.lng1) / 2,
      plaats: g.naam, land: g.naam, licentie });
  }
  process.env.RTG_DATA_DIR = map;
  const verse = () => {
    for (const m of ['gebieden', 'gebiedsindex', 'pakket', 'toestelpakket']) {
      delete require.cache[require.resolve('../server/kern/navigatie/' + m + '.js')];
    }
  };
  verse();
  const laag = require('../server/kern/navigatie/toestelpakket.js')();
  try { return await fn({ laag, map, nav }); }
  finally {
    if (oud === undefined) delete process.env.RTG_DATA_DIR; else process.env.RTG_DATA_DIR = oud;
    verse();
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
}

test('1. het manifest noemt acht delen, met de echte grootte en de echte som', async () => {
  await metWereld(async ({ laag, nav }) => {
    const m = await laag.navKaartPakket('nederland');
    assert.equal(m.status, 200, JSON.stringify(m));
    assert.deepEqual(m.delen.map(d => d.naam), DELEN, 'alle acht, in de vorm die de motor leest');
    let som = 0;
    for (const d of m.delen) {
      const pad = path.join(nav, 'nederland-graaf', d.naam);
      const rauw = fs.readFileSync(pad);
      assert.equal(d.bytes, rauw.length, d.naam + ': de grootte komt van het bestand');
      /* Onafhankelijk nagerekend en niet uit dezelfde functie gehaald: anders
         toetst dit dat crypto met zichzelf overeenkomt. */
      assert.equal(d.som, crypto.createHash('sha256').update(rauw).digest('hex').slice(0, 32),
        d.naam + ': de som is van dit bestand');
      assert.equal(d.adres, '/api/nav/gebied/pakket/nederland/' + d.naam);
      som += rauw.length;
    }
    assert.equal(m.bytesTotaal, som, 'het totaal is de som van de delen');
    assert.ok(m.bytesTotaal > 0, 'en het is geen nul');
    assert.equal(m.versie, 1, 'de versie komt uit graaf.json');
  }, { bouw: ['nederland'] });
});

test('2. de naamsvermelding reist MEE, want een pakket verspreiden vraagt hem', async () => {
  await metWereld(async ({ laag }) => {
    const m = await laag.navKaartPakket('nederland');
    assert.equal(m.licentie, 'ODbL 1.0');
    assert.equal(m.naamsvermelding, 'OpenStreetMap-bijdragers');
  }, { bouw: ['nederland'] });
});

test('3. zonder naamsvermelding gaat er geen byte uit -- manifest EN deel weigeren', async () => {
  await metWereld(async ({ laag }) => {
    const m = await laag.navKaartPakket('nederland');
    assert.equal(m.status, 403, JSON.stringify(m));
    assert.match(m.error, /naamsvermelding/i);
    /* En de tweede route vraagt dezelfde poort. Zou alleen het manifest hem
       vragen, dan was de grendel te omzeilen door het adres zelf te typen --
       en die adressen zijn te raden. */
    const d = laag.navKaartDeel('nederland', 'coords.f64');
    assert.equal(d.ok, undefined);
    assert.equal(d.status, 403, JSON.stringify(d));
  }, { bouw: ['nederland'], naamsvermelding: '' });
});

test('4. een gebied dat wel bestaat maar niet gebouwd is, geeft 409 en niet 404', async () => {
  await metWereld(async ({ laag }) => {
    const m = await laag.navKaartPakket('frankrijk');
    assert.equal(m.status, 409, JSON.stringify(m));
    assert.match(m.error, /nog niet gebouwd/i);
    /* 404 zou zeggen "dit gebied bestaat niet", en dat is iets anders: de
       keuze van het lid blijft juist staan als verzoek. */
    const weg = await laag.navKaartPakket('atlantis');
    assert.equal(weg.status, 404, JSON.stringify(weg));
  }, { bouw: ['nederland'] });
});

test('5. de gesloten lijst: geen pad, geen SQLite, geen traversal', async () => {
  await metWereld(({ laag }) => {
    for (const naam of ['nederland.sqlite', '../nederland.sqlite', '../../db.json', '../../secret.key',
      'coords.f64/../../../etc/passwd', 'graaf.json ', 'COORDS.F64', '', null]) {
      const d = laag.navKaartDeel('nederland', naam);
      assert.equal(d.ok, undefined, JSON.stringify(naam) + ' hoort geweigerd te worden');
      assert.equal(d.status, 404, JSON.stringify(naam) + ' -> ' + JSON.stringify(d));
    }
    /* En de acht die er WEL zijn, komen door -- anders zou een lijst die alles
       weigert deze toets ook halen. */
    for (const naam of DELEN) {
      const d = laag.navKaartDeel('nederland', naam);
      assert.equal(d.ok, true, naam + ' hoort door te komen: ' + JSON.stringify(d));
      assert.ok(d.bytes > 0 && d.pad.endsWith('/' + naam));
    }
  }, { bouw: ['nederland'] });
});

test('6. een onveilige GEBIEDSCODE komt hier ook niet langs', async () => {
  await metWereld(({ laag }) => {
    for (const code of ['../nederland', 'nederland/../..', '/etc', 'NEDERLAND!']) {
      const d = laag.navKaartDeel(code, 'coords.f64');
      assert.equal(d.ok, undefined, JSON.stringify(code));
      assert.equal(d.status, 404, JSON.stringify(code) + ' -> ' + JSON.stringify(d));
    }
  }, { bouw: ['nederland'] });
});

test('7. een half pakket is geen pakket: het manifest weigert met de naam erin', async () => {
  await metWereld(async ({ laag, nav }) => {
    fs.unlinkSync(path.join(nav, 'nederland-graaf', 'kosten.f32'));
    const m = await laag.navKaartPakket('nederland');
    assert.equal(m.status, 409, JSON.stringify(m));
    assert.match(m.error, /kosten\.f32/, 'de naam staat erin: ' + m.error);
    assert.equal(m.delen, undefined, 'en er wordt geen halve lijst aangeboden');
  }, { bouw: ['nederland'] });
});

test('8. een LEEG deel telt als ontbrekend', async () => {
  await metWereld(async ({ laag, nav }) => {
    fs.writeFileSync(path.join(nav, 'nederland-graaf', 'doelen.u32'), Buffer.alloc(0));
    const m = await laag.navKaartPakket('nederland');
    assert.equal(m.status, 409, JSON.stringify(m));
    assert.match(m.error, /doelen\.u32/);
  }, { bouw: ['nederland'] });
});

test('9. het controlegetal beweegt mee met het bestand, ook binnen dezelfde seconde', async () => {
  await metWereld(async ({ laag, nav }) => {
    const eerst = (await laag.navKaartPakket('nederland')).delen.find(d => d.naam === 'coords.f64');
    const pad = path.join(nav, 'nederland-graaf', 'coords.f64');
    /* Een nieuw pakket met ANDERE inhoud van dezelfde lengte. De cache staat op
       grootte plus mtime; blijft de mtime toevallig gelijk, dan hoort de
       grootte of de mtime hem te verschieten -- vandaar dat de mtime hier
       expliciet wordt verzet, precies zoals een nieuwe bouw dat doet. */
    const rauw = fs.readFileSync(pad);
    const anders = Buffer.from(rauw);
    anders.writeDoubleLE(51.5, 0);
    fs.writeFileSync(pad, anders);
    const t = (Date.now() + 5000) / 1000;
    fs.utimesSync(pad, t, t);
    const daarna = (await laag.navKaartPakket('nederland')).delen.find(d => d.naam === 'coords.f64');
    assert.equal(daarna.bytes, eerst.bytes, 'zelfde lengte, dus de lengte vangt dit niet');
    assert.notEqual(daarna.som, eerst.som, 'en de som doet het wel');
    assert.equal(daarna.som, crypto.createHash('sha256').update(anders).digest('hex').slice(0, 32));
  }, { bouw: ['nederland'] });
});

test('10. de server BELOOFT niet wat er op het toestel staat', async () => {
  await metWereld(async ({ laag }) => {
    const m = await laag.navKaartPakket('nederland');
    assert.equal(m.opToestel, null, 'null en niet false: de server kan dit niet weten');
    assert.match(m.opToestelWaarom, /alleen het toestel/i);
    /* En wat er NIET meegaat staat er met de reden bij, want een download die
       "offline navigatie" heet terwijl de straatnamen missen, is marketing. */
    assert.ok(Array.isArray(m.nietMeegeleverd) && m.nietMeegeleverd.length >= 2);
    for (const n of m.nietMeegeleverd) assert.ok(n.wat && n.waarom, JSON.stringify(n));
    assert.ok(m.nietMeegeleverd.some(n => /straatnamen/i.test(n.wat)), JSON.stringify(m.nietMeegeleverd));
  }, { bouw: ['nederland'] });
});

/* ---------------------------------------------------------------------------
   DE TWEE ROUTES, OVER HTTP.

   Om dezelfde reden als bij test/navigatiemijnkaarten.js: de e2e meldt zich af
   op een machine zonder browser, en dan raakt geen enkele toets deze routes.
   Hier is de deur het onderwerp -- de poort, en dat de bytes die uitgaan
   werkelijk het bestand zijn.
   --------------------------------------------------------------------------- */

const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pakketroutes-'));

const post = (pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let seq = 0;
async function nieuwLid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await post('/api/auth/register', { name: 'Pakketlid ' + seq, email: 'pl' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v',
    tier: 'rtg', pasApp: 'rtg' });
  return reg.body.token;
}

test.before(async () => {
  const nav = path.join(TMP, 'navigatie');
  fs.mkdirSync(nav, { recursive: true });
  fs.writeFileSync(path.join(nav, 'gebieden.json'), JSON.stringify({
    bron: 'fixture', licentie: 'ODbL 1.0', naamsvermelding: 'OpenStreetMap-bijdragers',
    gebieden: GEBIEDEN }));
  bouwPakket({ map: nav, code: 'nederland', lat: 52.36, lng: 4.89, plaats: 'Amsterdam',
    land: 'Nederland', licentie: 'ODbL 1.0' });
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('11. beide routes zitten achter de ledeninlog, en een gast komt er niet in', async () => {
  const zonder = await post('/api/nav/gebied/pakket', { code: 'nederland' });
  assert.ok(zonder.status === 401 || zonder.status === 403, 'manifest dicht zonder sessie: ' + zonder.status);
  const kaalGet = await fetch(base + '/api/nav/gebied/pakket/nederland/coords.f64');
  assert.ok(kaalGet.status === 401 || kaalGet.status === 403, 'bytes dicht zonder sessie: ' + kaalGet.status);

  const gast = (await post('/api/login', { tier: 'guest' })).body.token;
  assert.ok(gast, 'een gastsessie');
  const gm = await post('/api/nav/gebied/pakket', { code: 'nederland' }, gast);
  assert.equal(gm.status, 403);
  const gd = await fetch(base + '/api/nav/gebied/pakket/nederland/coords.f64',
    { headers: { Authorization: 'Bearer ' + gast } });
  assert.equal(gd.status, 403, 'ook de bytes weigeren een gast');
});

test('12. over HTTP komt het manifest door, en de bytes zijn werkelijk het bestand', async () => {
  const lid = await nieuwLid();
  const m = await post('/api/nav/gebied/pakket', { code: 'nederland' }, lid);
  assert.equal(m.status, 200, JSON.stringify(m.body));
  assert.equal(m.body.delen.length, 8);
  const graaf = path.join(TMP, 'navigatie', 'nederland-graaf');
  for (const d of m.body.delen) {
    const r = await fetch(base + d.adres, { headers: { Authorization: 'Bearer ' + lid } });
    assert.equal(r.status, 200, d.naam + ' -> ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    assert.deepEqual(buf, fs.readFileSync(path.join(graaf, d.naam)), d.naam + ': byte voor byte');
    assert.equal(buf.length, d.bytes, d.naam + ': de lengte uit het manifest klopt');
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex').slice(0, 32), d.som,
      d.naam + ': de som uit het manifest klopt');
    assert.equal(r.headers.get('content-length'), String(d.bytes));
    assert.equal(r.headers.get('content-type'),
      d.naam.endsWith('.json') ? 'application/json' : 'application/octet-stream');
  }
});

test('13. een traversal in het ADRES levert geen byte op', async () => {
  const lid = await nieuwLid();
  for (const staart of ['nederland/nederland.sqlite', 'nederland/..%2f..%2fdb.json',
    'nederland/%2e%2e%2f%2e%2e%2fsecret.key', '..%2f..%2fdb.json/coords.f64']) {
    const r = await fetch(base + '/api/nav/gebied/pakket/' + staart,
      { headers: { Authorization: 'Bearer ' + lid } });
    assert.ok(r.status === 404 || r.status === 400, staart + ' -> ' + r.status);
    const type = String(r.headers.get('content-type') || '');
    assert.equal(type.includes('octet-stream'), false, staart + ' stuurt geen bytes');
  }
});

test('14. een niet gebouwd gebied geeft over HTTP 409 met de reden, en geen leeg bestand', async () => {
  const lid = await nieuwLid();
  const m = await post('/api/nav/gebied/pakket', { code: 'frankrijk' }, lid);
  assert.equal(m.status, 409, JSON.stringify(m.body));
  assert.match(String(m.body.error), /nog niet gebouwd/i);
  const r = await fetch(base + '/api/nav/gebied/pakket/frankrijk/coords.f64',
    { headers: { Authorization: 'Bearer ' + lid } });
  assert.equal(r.status, 409);
  assert.equal(Number(r.headers.get('content-length') || 0) > 0, true, 'er staat een reden in het antwoord');
});
