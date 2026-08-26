/* KLEEFROUTERING EN SPREIDING (server/trio-kleef.js, server/trio-spreiding.js).

   Dit is de laag die bepaalt WELK serverproces een lid krijgt. Twee dingen
   moeten kloppen, en het tweede is het minst vanzelfsprekende:

   1. Hetzelfde lid krijgt steeds hetzelfde proces. Anders bestaat de hele
      ingreep niet: read-your-writes breekt precies op het moment dat een
      verzoek ergens anders landt dan het vorige.

   2. Als er een server wegvalt, verhuizen ALLEEN de leden van die server. Bij
      een gewone `merk % aantal` verhuist bijna iedereen -- en elke verhuizing is
      een lid dat zijn eigen zojuist opgeslagen gegevens even niet ziet. Die
      modulo staat hieronder als referentie, zodat het verschil een gemeten
      getal is en geen bewering in een commentaarblok.

   Draai los: node --test test/trio-kleef.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const kleef = require('../server/trio-kleef.js');
const { maakSpreiding } = require('../server/trio-spreiding.js');

/* Een verzoek zoals de poortwachter het ziet: alleen headers en url. */
const metKop = t => ({ headers: { authorization: 'Bearer ' + t }, url: '/api/notities/mijn' });
const metQuery = t => ({ headers: {}, url: '/api/stream?token=' + encodeURIComponent(t) });
const tokens = (n, p) => Array.from({ length: n }, (_, i) => (p || 't') + '-' + i + '-abcdefgh');

/* ---------- de kleefbeslissing ---------- */

test('1. hetzelfde token krijgt steeds dezelfde server', () => {
  for (const t of tokens(200)) {
    const eerste = kleef.kleefIndex(metKop(t), [0, 1, 2]);
    assert.ok(eerste >= 0 && eerste <= 2, 'een geldige keuze voor ' + t);
    for (let herhaling = 0; herhaling < 5; herhaling++) {
      assert.equal(kleef.kleefIndex(metKop(t), [0, 1, 2]), eerste, 'stabiel voor ' + t);
    }
    /* En ook als de kandidaten in een andere volgorde binnenkomen: de keuze mag
       niet afhangen van hoe de poortwachter zijn lijstje toevallig opbouwde. */
    assert.equal(kleef.kleefIndex(metKop(t), [2, 1, 0]), eerste, 'volgorde-onafhankelijk voor ' + t);
  }
});

test('2. de kop en de query wijzen naar dezelfde server -- ook bij een base64-token', () => {
  /* EventSource kan geen Authorization-kop meesturen en zet het token in de
     query. Staan er +, / of = in (base64), dan komt hij daar ge-escaped binnen
     en in de kop niet. Zonder decoderen zou een lid zijn SSE-stroom bij een
     ANDER proces krijgen dan zijn gewone verzoeken -- precies het gat dat deze
     laag moet dichten. */
  for (const t of ['abc123', 'a+b/c=', 'zZ9+/=abcdef', 'sim.ple-token_1']) {
    assert.equal(kleef.merkVan(metQuery(t)), kleef.merkVan(metKop(t)), 'zelfde merk voor ' + JSON.stringify(t));
    assert.equal(kleef.kleefIndex(metQuery(t), [0, 1, 2]), kleef.kleefIndex(metKop(t), [0, 1, 2]));
  }
});

test('3. een verzoek zonder token kleeft niet, en niets gooit', () => {
  const geen = [
    { headers: {}, url: '/apps/app.html' },
    { headers: { authorization: 'Bearer' }, url: '/x' },        // kop zonder waarde
    { headers: { authorization: 'Basic abc' }, url: '/x' },     // ander schema
    { headers: {}, url: '/x?tokens=abc' },                      // lijkt erop, is het niet
    { headers: {}, url: '/x?a=1&tokenx=abc' },
    { headers: {}, url: '/x?xtoken=abc' },                      // en ook aan de voorkant niet
    { headers: {}, url: '/x?a=1&mijntoken=abc' },
    { headers: {}, url: '' },
    {}, null, undefined
  ];
  for (const req of geen) {
    assert.equal(kleef.merkVan(req), null, 'geen merk voor ' + JSON.stringify(req));
    assert.equal(kleef.kleefIndex(req, [0, 1, 2]), -1, '-1 betekent: de aanroeper kiest zelf');
  }
  // en een stukgeslagen percent-escape mag geen uitzondering geven
  assert.notEqual(kleef.merkVan({ headers: {}, url: '/x?token=%E0%A4%A' }), null);
});

test('4. het token zelf verlaat de module niet', () => {
  /* Een poortwachter die een tokenwaarde in handen krijgt, is een poortwachter
     die hem een keer logt. Naar buiten gaat alleen een getal. */
  assert.deepEqual(Object.keys(require('../server/trio-kleef.js')).sort(), ['kiesUit', 'kleefIndex', 'merkVan']);
  const merk = kleef.merkVan(metKop('geheim-token-abc'));
  assert.equal(typeof merk, 'number');
  assert.ok(Number.isInteger(merk) && merk >= 0, 'een geheel, niet-negatief getal');
  assert.ok(!String(merk).includes('geheim'), 'het merk draagt de tekst niet mee');
});

test('5. de verdeling over drie servers is gelijkmatig', () => {
  const tel = [0, 0, 0];
  const N = 30000;
  for (const t of tokens(N)) tel[kleef.kleefIndex(metKop(t), [0, 1, 2])]++;
  for (let i = 0; i < 3; i++) {
    const deel = tel[i] / N;
    assert.ok(deel > 0.28 && deel < 0.39,
      'server ' + i + ' krijgt ' + (deel * 100).toFixed(1) + '% (verwacht rond 33%): ' + tel.join('/'));
  }
});

test('6. valt er een server weg, dan verhuizen ALLEEN zijn eigen leden', () => {
  /* De referentie: de naïeve verdeling. */
  const modulo = (t, n) => kleef.merkVan(metKop(t)) % n;

  const N = 20000;
  let kleefVerhuisd = 0, kleefVanDeDode = 0, moduloVerhuisd = 0;
  for (const t of tokens(N)) {
    const voor = kleef.kleefIndex(metKop(t), [0, 1, 2]);
    const na = kleef.kleefIndex(metKop(t), [0, 1]);       // server 2 valt weg
    if (voor === 2) kleefVanDeDode++; else if (voor !== na) kleefVerhuisd++;
    if (modulo(t, 3) !== 2 && modulo(t, 3) !== modulo(t, 2)) moduloVerhuisd++;
  }
  assert.equal(kleefVerhuisd, 0,
    'geen enkel lid van server 0 of 1 mag verhuizen; ' + kleefVerhuisd + ' deden dat wel');
  assert.ok(kleefVanDeDode > N * 0.28, 'de leden van de weggevallen server verhuizen wél (' + kleefVanDeDode + ')');
  assert.ok(moduloVerhuisd > N * 0.2,
    'en dit is waarom het geen modulo is: die laat ' + moduloVerhuisd + ' van de ' + N +
    ' overgebleven leden onnodig verhuizen');
});

test('7. de keuze overleeft een herstart van de poortwachter', () => {
  /* De zaden worden uit de INDEX afgeleid en niet uit een toevalsgetal bij het
     starten. Zou dat ooit veranderen, dan verhuist bij elke herstart van de
     poortwachter iedereen -- en dan is dit geen kleefroutering meer. */
  const voor = tokens(50).map(t => kleef.kleefIndex(metKop(t), [0, 1, 2]));
  delete require.cache[require.resolve('../server/trio-kleef.js')];
  const vers = require('../server/trio-kleef.js');
  const na = tokens(50).map(t => vers.kleefIndex(metKop(t), [0, 1, 2]));
  assert.deepEqual(na, voor, 'een verse module kiest exact hetzelfde');
});

/* ---------- de rollen en de spreiding ---------- */

function proefTrio() {
  const gedaan = [];
  const servers = [0, 1, 2].map(i => ({ nr: i + 1, port: 3001 + i, child: {}, healthy: true, rol: 'uit' }));
  const apiCall = async (port, pad) => { gedaan.push(port + ' ' + pad); return { status: 200 }; };
  return { servers, gedaan, log: () => {}, apiCall };
}
function metOmgeving(vlaggen, fn) {
  const oud = { RTG_SPREIDING: process.env.RTG_SPREIDING, REDIS_URL: process.env.REDIS_URL };
  for (const [k, v] of Object.entries(vlaggen)) { if (v == null) delete process.env[k]; else process.env[k] = v; }
  try { return fn(); }
  finally { for (const [k, v] of Object.entries(oud)) { if (v == null) delete process.env[k]; else process.env[k] = v; } }
}

test('8. zonder RTG_SPREIDING verandert er niets aan wat de poortwachter deed', async () => {
  await metOmgeving({ RTG_SPREIDING: null, REDIS_URL: null }, async () => {
    const t = proefTrio();
    const sp = maakSpreiding(t);
    assert.equal(sp.aan(), false);
    assert.equal(sp.naLeiderschap(), 'uit', 'een afgetreden leider gaat naar stand-by, zoals altijd');
    await sp.stemAf(0);
    assert.deepEqual(t.gedaan, [], 'er wordt niemand gepromoveerd');
    for (const merk of ['a', 'b', 'c']) {
      assert.equal(sp.kleefDoel(metKop(merk), 0), 0, 'alles gaat naar de terugval (de leider)');
    }
  });
});

test('9. spreiding gevraagd zonder REDIS_URL WEIGERT, met de reden erbij', async () => {
  /* Zonder bus delen de processen geen sessies. Het inloggen heeft nog geen
     token en gaat naar de leider; het volgende verzoek kleeft aan een ander
     proces dat de sessie niet kent. Dat is 401 voor iedereen, meteen. Een stand
     die je aanzet en die er niet is, is erger dan een die weigert. */
  await metOmgeving({ RTG_SPREIDING: '1', REDIS_URL: null }, async () => {
    const t = proefTrio();
    const regels = [];
    const sp = maakSpreiding({ ...t, log: m => regels.push(m) });
    assert.equal(sp.gevraagd(), true, 'de vraag is wel gezien');
    assert.equal(sp.aan(), false, 'maar de stand staat niet aan');
    await sp.stemAf(0);
    assert.deepEqual(t.gedaan, []);
    assert.equal(regels.length, 1, 'precies een melding');
    assert.match(regels[0], /NIET aangezet/);
    assert.match(regels[0], /REDIS_URL/, 'en hij zegt wat je eraan doet');
    await sp.stemAf(0);
    assert.equal(regels.length, 1, 'en niet bij elke hartslag opnieuw');
  });
});

test('10. met spreiding worden de gezonde niet-leiders volger -- en maar een keer', async () => {
  await metOmgeving({ RTG_SPREIDING: '1', REDIS_URL: 'redis://127.0.0.1:6379' }, async () => {
    const t = proefTrio();
    const sp = maakSpreiding(t);
    assert.equal(sp.aan(), true);
    assert.equal(sp.naLeiderschap(), 'volger', 'een afgetreden leider blijft meewerken');
    t.servers[0].rol = 'leider';
    await sp.stemAf(0);
    assert.deepEqual(t.gedaan, ['3002 /api/cluster/promote?leider=0', '3003 /api/cluster/promote?leider=0'],
      'de twee anderen worden volger, en de leider wordt niet aangeraakt');
    assert.deepEqual(t.servers.map(s => s.rol), ['leider', 'volger', 'volger']);

    t.gedaan.length = 0;
    await sp.stemAf(0);
    assert.deepEqual(t.gedaan, [], 'wie al volger is, krijgt geen tweede promote per hartslag');

    /* Een server die wegvalt krijgt geen verkeer meer (trio-wacht zet zijn rol
       op 'uit') en wordt daarna vanzelf weer opgepakt. */
    t.servers[2].healthy = false; t.servers[2].rol = 'uit';
    await sp.stemAf(0);
    assert.deepEqual(t.gedaan, [], 'een onbereikbare server wordt niet gepromoveerd');
    t.servers[2].healthy = true;
    await sp.stemAf(0);
    assert.deepEqual(t.gedaan, ['3003 /api/cluster/promote?leider=0'], 'en zodra hij terug is, loopt hij weer mee');
  });
});

test('11. kleefDoel geeft de terugval zodra er niets te kiezen valt', async () => {
  await metOmgeving({ RTG_SPREIDING: '1', REDIS_URL: 'redis://127.0.0.1:6379' }, async () => {
    const t = proefTrio();
    const sp = maakSpreiding(t);
    t.servers[0].rol = 'leider';
    // nog geen volgers: een kandidaat is geen keuze
    assert.equal(sp.kleefDoel(metKop('abc'), 0), 0);
    await sp.stemAf(0);
    // nu drie kandidaten: het lid kleeft, en steeds aan dezelfde
    const doel = sp.kleefDoel(metKop('abc'), 0);
    assert.ok([0, 1, 2].includes(doel));
    assert.equal(sp.kleefDoel(metKop('abc'), 0), doel);
    // een verzoek zonder token blijft bij de terugval
    assert.equal(sp.kleefDoel({ headers: {}, url: '/apps/app.html' }, 0), 0);
    // alles behalve de leider omgevallen: terug naar de terugval
    t.servers[1].healthy = false; t.servers[2].healthy = false;
    assert.equal(sp.kleefDoel(metKop('abc'), 0), 0);
  });
});
