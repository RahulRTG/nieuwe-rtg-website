/* Het gedachtenboek (kern/gedachten.js).

   De belofte is dat dit GEEN materiaal is, en die wordt hier op drie manieren
   vastgezet: er is geen deur die de tekst ergens anders heen stuurt, niemand
   anders kan erbij, en weggooien is echt weggooien.

   En het punt waar dit bewust anders is dan de dagcheck-in: de crisisregel
   BEWAART hier. Wie op zijn zwaarste moment iets opschrijft en zijn woorden ziet
   verdwijnen, wordt gestraft voor eerlijkheid -- en raakt kwijt wat hij net moest
   opschrijven. De weg naar hulp komt ERNAAST te staan.
   Draai los: node --test test/gedachten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, lid2, sup;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ged-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
  const login = tier => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier }) }).then(r => r.json()).then(d => d.token);
  lid = await login('rtg');
  lid2 = await login('business');
  sup = (await api('supplier/login', { username: 'rahul', password: 'Imran' }, '')).body.token;
  assert.ok(lid && lid2 && sup);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een leeg boek zegt zelf dat er niemand meeleest', async () => {
  const r = await api('gedachten', {}, lid);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.notities, []);
  assert.match(r.body.uitleg, /geen model mee/i);
  assert.match(r.body.elders, /dagcheck-in/i,
    'en waar de notitie bij een check-in dan wel staat, zodat twee schrijfplekken niet verwarren');
});

test('opschrijven, teruglezen en weggooien', async () => {
  await api('gedachten/zet', { tekst: 'Vandaag was lang maar het ging.' }, lid);
  await api('gedachten/zet', { tekst: 'Morgen de kapper.' }, lid);
  const d = (await api('gedachten', {}, lid)).body;
  assert.equal(d.notities.length, 2);
  assert.equal(d.notities[0].tekst, 'Morgen de kapper.', 'nieuwste bovenaan');
  assert.ok(d.notities[0].op && d.notities[0].at);

  const id = d.notities[0].id;
  const na = (await api('gedachten/weg', { id }, lid)).body;
  assert.equal(na.notities.length, 1);
  assert.equal((await api('gedachten/weg', { id }, lid)).status, 404, 'en wat weg is, is weg');
  assert.equal((await api('gedachten/zet', { tekst: '   ' }, lid)).status, 400, 'leeg bewaren doet niets');
});

test('de crisisregel BEWAART hier, en zet de hulp ernaast', async () => {
  const r = await api('gedachten/zet', { tekst: 'ik wil niet meer leven, ik weet het niet meer' }, lid);
  assert.equal(r.status, 200);
  assert.ok(r.body.notities.some(n => /niet meer leven/.test(n.tekst)),
    'de notitie is bewaard: woorden laten verdwijnen straft eerlijk zijn');
  assert.match(JSON.stringify(r.body.hulp), /0800-0113/, 'en de weg naar hulp staat ernaast');
  assert.match(r.body.hulpUitleg, /bewaard/i, 'met de mededeling dat er niets is weggegooid');
  assert.match(r.body.hulpUitleg, /leest hem niet/i,
    'en dat dit geen oordeel over de tekst is maar een woordenlijst');

  /* En het blijft staan bij een volgende keer lezen: de hulpkaart is geen reden
     om de notitie alsnog te laten verdwijnen. */
  assert.ok((await api('gedachten', {}, lid)).body.notities.some(n => /niet meer leven/.test(n.tekst)));

  // opruimen zodat de rest van de toetsen een gewoon boek ziet
  const id = (await api('gedachten', {}, lid)).body.notities.find(n => /niet meer leven/.test(n.tekst)).id;
  await api('gedachten/weg', { id }, lid);
});

test('er is geen deur die deze tekst ergens anders heen stuurt', async () => {
  /* De harde bewering van dit onderdeel. Hij wordt op twee manieren nagekeken:
     de routes die niet bestaan, en de bron zelf -- want een route erbij is
     makkelijker toegevoegd dan deze toets is aangepast. */
  for (const pad of ['gedachten/vat-samen', 'gedachten/deel', 'gedachten/analyse', 'gedachten/ai']) {
    assert.equal((await api(pad, {}, lid)).status, 404, 'er is geen ' + pad);
  }
  const lees = (...p) => fs.readFileSync(path.join(__dirname, '..', 'server', ...p), 'utf8');
  const bron = lees('routes', 'gedachten.js');
  const routes = [...bron.matchAll(/app\.post\('([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(routes.sort(), ['/api/gedachten', '/api/gedachten/weg', '/api/gedachten/zet'],
    'precies drie routes, en geen vierde die de tekst ergens heen brengt');

  /* Commentaar er eerst af. Zonder die stap sloeg deze scan aan op de zin die
     UITLEGT dat er niet wordt samengevat -- dan bewaakt hij zijn eigen proza in
     plaats van de code. */
  const zonderUitleg = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const code = zonderUitleg(bron) + zonderUitleg(lees('kern', 'gedachten.js'));
  assert.ok(!/anthropic|aiPoort|vraagAi|samenvat/i.test(code),
    'en nergens een aanroep naar het model');
});

test('niemand anders komt in uw boek', async () => {
  await api('gedachten/zet', { tekst: 'iets van mij' }, lid);
  const ander = (await api('gedachten', {}, lid2)).body;
  assert.deepEqual(ander.notities, [], 'lid2 ziet zijn eigen lege boek');

  /* En het id van een ander weggooien kan ook niet -- dat geeft hetzelfde 404
     als een id dat niet bestaat, want "bestaat wel maar niet van u" is ook een
     antwoord. */
  const mijnId = (await api('gedachten', {}, lid)).body.notities[0].id;
  assert.equal((await api('gedachten/weg', { id: mijnId }, lid2)).status, 404);
  assert.ok((await api('gedachten', {}, lid)).body.notities.some(n => n.id === mijnId),
    'en hij staat er bij de eigenaar nog gewoon');

  assert.equal((await api('gedachten', {}, sup)).status, 401, 'een zaak-sessie komt er niet in');
  assert.equal((await api('gedachten', {}, '')).status, 401);
});

test('een lange lijst kapt niet stilletjes af', async () => {
  const { MAX_TERUG } = require('../server/kern/gedachten');
  for (let i = 0; i < MAX_TERUG + 3; i++) await api('gedachten/zet', { tekst: 'regel ' + i }, lid);
  const d = (await api('gedachten', {}, lid)).body;
  assert.equal(d.notities.length, MAX_TERUG);
  assert.ok(d.meer >= 3, 'en er staat hoeveel er nog ouder zijn: ' + d.meer);
});

test('het gedachtenboek staat op het toestemmingsscherm bij wat er NIET onder valt', async () => {
  const d = (await api('toestemming', {}, lid)).body;
  const rij = d.nietGedekt.find(x => /gedachtenboek/i.test(x.naam));
  assert.ok(rij, 'het boek staat bij wat dit scherm niet dekt');
  assert.match(rij.reden, /ook geen model/i);
});
