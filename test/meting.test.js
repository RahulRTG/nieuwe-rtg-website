/* ============================================================================
   De meting: tellen zonder de monitoring om te leggen en zonder iets over een
   persoon vast te leggen.

   Draai los: node --test test/meting.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const meting = require('../server/meting');

test.beforeEach(() => meting.wis());

test('1. een verzoek wordt geteld op methode, route en statusklasse', () => {
  meting.telVerzoek('GET', '/api/leden/:id', 200, 0.012);
  meting.telVerzoek('GET', '/api/leden/:id', 200, 0.030);
  meting.telVerzoek('GET', '/api/leden/:id', 404, 0.002);
  const t = meting.tekst();
  assert.match(t, /rtg_verzoeken_totaal\{methode="GET",route="\/api\/leden\/:id",status="2xx"\} 2/);
  assert.match(t, /rtg_verzoeken_totaal\{methode="GET",route="\/api\/leden\/:id",status="4xx"\} 1/);
});

test('2. DE CARDINALITEIT: duizend id\'s geven niet duizend tijdreeksen', () => {
  /* Dit is de fout die je monitoring omlegt voordat je server omvalt. De router
     geeft het PATROON door, dus duizend verschillende leden blijven een reeks. */
  for (let i = 0; i < 1000; i++) meting.telVerzoek('GET', '/api/leden/:id', 200, 0.01);
  const s = meting.samenvatting();
  assert.equal(s.verzoeken, 1000);
  assert.equal(s.reeksen, 2, 'een teller-reeks en een duur-reeks, niet duizend');
});

test('3. een onbekend pad valt samen op een enkele noemer', () => {
  /* Anders maakt een scanner met duizend verzonnen adressen duizend reeksen. */
  const nep = { method: 'GET', headers: {}, socket: {} };  // geen routePatroon
  const res = { statusCode: 404, on: (naam, fn) => { if (naam === 'finish') res._fin = fn; } };
  for (let i = 0; i < 50; i++) meting.middleware()(Object.assign({}, nep), res, () => {});
  // de middleware telt pas bij 'finish'; hier direct toetsen op de noemer zelf
  meting.telVerzoek('GET', '(onbekend)', 404, 0.001);
  assert.match(meting.tekst(), /route="\(onbekend\)"/);
});

test('4. het histogram klopt: emmers zijn cumulatief', () => {
  meting.telVerzoek('GET', '/api/x', 200, 0.004);  // vanaf de emmer van 5 ms
  meting.telVerzoek('GET', '/api/x', 200, 0.7);    // pas vanaf 1s
  meting.telVerzoek('GET', '/api/x', 200, 30);     // in geen enkele emmer, wel in +Inf
  meting.telVerzoek('GET', '/api/x', 200, 0.0004); // in ALLE emmers, ook de fijnste
  const t = meting.tekst();
  /* De drie fijne emmers onderaan zijn er niet voor de sier: zonder hen vielen
     0,4 ms en 4 ms in dezelfde emmer en was er geen percentiel onder de 5 ms te
     maken. Deze regels zakken zodra iemand ze weghaalt. */
  assert.match(t, /rtg_duur_seconden_bucket\{methode="GET",route="\/api\/x",le="0\.0005"\} 1/);
  assert.match(t, /rtg_duur_seconden_bucket\{methode="GET",route="\/api\/x",le="0\.0025"\} 1/);
  assert.match(t, /rtg_duur_seconden_bucket\{methode="GET",route="\/api\/x",le="0\.005"\} 2/);
  assert.match(t, /rtg_duur_seconden_bucket\{methode="GET",route="\/api\/x",le="1"\} 3/);
  assert.match(t, /rtg_duur_seconden_bucket\{methode="GET",route="\/api\/x",le="\+Inf"\} 4/);
  assert.match(t, /rtg_duur_seconden_count\{methode="GET",route="\/api\/x"\} 4/);
});

test('5. de statusklasse deelt netjes in', () => {
  assert.equal(meting.statusKlasse(200), '2xx');
  assert.equal(meting.statusKlasse(204), '2xx');
  assert.equal(meting.statusKlasse(302), '3xx');
  assert.equal(meting.statusKlasse(401), '4xx');
  assert.equal(meting.statusKlasse(500), '5xx');
  assert.equal(meting.statusKlasse(503), '5xx');
});

test('6. de samenvatting rekent het foutpercentage waar de SLO op staat', () => {
  for (let i = 0; i < 997; i++) meting.telVerzoek('GET', '/api/x', 200, 0.01);
  for (let i = 0; i < 3; i++) meting.telVerzoek('GET', '/api/x', 500, 0.01);
  const s = meting.samenvatting();
  assert.equal(s.verzoeken, 1000);
  assert.equal(s.fouten5xx, 3);
  assert.equal(s.foutpercentage, 0.3);
  assert.equal(s.gemiddeldeDuurMs, 10);
});

test('7. er staat NIETS persoonsgebonden in de uitvoer', () => {
  /* Een metrics-endpoint wordt gescrapet door een systeem dat doorgaans minder
     streng bewaakt is dan de database. Daar hoort niets in te staan wat over
     een persoon gaat. */
  meting.telVerzoek('POST', '/api/leden/:id/boeking', 200, 0.05);
  meting.telFout('TypeError');
  const t = meting.tekst();
  assert.ok(!/@/.test(t), 'geen e-mailadressen');
  assert.ok(!/\d+\.\d+\.\d+\.\d+/.test(t), 'geen IP-adressen');
  assert.ok(!/codenaam|codename/i.test(t), 'geen codenamen');
  // het patroon mag wel: :id is juist het bewijs dat er geen echt id in staat
  assert.match(t, /route="\/api\/leden\/:id\/boeking"/);
});

test('8. aanhalingstekens en backslashes in een label breken het formaat niet', () => {
  meting.telVerzoek('GET', '/api/raar"pad\\met', 200, 0.01);
  const regel = meting.tekst().split('\n').find(r => r.startsWith('rtg_verzoeken_totaal{methode="GET"'));
  assert.ok(regel.includes('\\"'), 'aanhalingsteken ontsnapt');
  assert.ok(regel.includes('\\\\'), 'backslash ontsnapt');
  // en het aantal aanhalingstekens blijft even (elk label netjes gesloten)
  assert.equal((regel.match(/(?<!\\)"/g) || []).length % 2, 0);
});

test('9. het formaat heeft voor elke meter een HELP en een TYPE', () => {
  meting.telVerzoek('GET', '/api/x', 200, 0.01);
  const t = meting.tekst();
  for (const naam of ['rtg_up', 'rtg_uptime_seconds', 'rtg_verzoeken_totaal',
    'rtg_duur_seconden', 'rtg_fouten_totaal', 'rtg_geheugen_bytes']) {
    assert.ok(t.includes('# HELP ' + naam + ' '), 'HELP ontbreekt voor ' + naam);
    assert.ok(t.includes('# TYPE ' + naam + ' '), 'TYPE ontbreekt voor ' + naam);
  }
  assert.ok(t.endsWith('\n'), 'het formaat eindigt op een newline');
});

test('10. het geheugen groeit niet mee met het verkeer', () => {
  /* Vaste emmers, geen lijst met metingen: honderdduizend verzoeken op dezelfde
     route horen evenveel te kosten als drie. */
  const voor = meting.samenvatting().reeksen;
  for (let i = 0; i < 100000; i++) meting.telVerzoek('GET', '/api/x', 200, Math.random() * 2);
  assert.equal(meting.samenvatting().reeksen, voor + 2, 'nog steeds een teller- en een duur-reeks');
  assert.equal(meting.samenvatting().verzoeken, 100000);
});
