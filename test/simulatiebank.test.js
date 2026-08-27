/* DE SIMULATIEBANK, EN DE POORT DIE HIJ NIET AANRAAKT.

   MAGNAATLAB.md par. 3 stelde de scherpste vraag van dat document en gaf er een
   ongemakkelijk antwoord op: Magnaat kan niet bij RTG Pay, en dat is geen schuld
   maar een compliment. `kern/pay/poort.js` kent geen enkele demo-, test- of
   spelstand, en een spelbank moet geld uit niets maken.

   > Een simulatie-adapter vervangt de RAIL, nooit de POORT.

   Dit bestand bewaakt precies die zin, van twee kanten:

     DE RAIL BESTAAT en kan STUK. Een demo-provider die altijd slaagt, bewijst
     dat de zonnige dag werkt. De simulatiebank kan weigeren, blijven hangen en
     terugboeken -- reproduceerbaar, want dezelfde sleutel geeft dezelfde afloop.

     DE POORT IS ONAANGERAAKT. Toets 5 leest kern/pay/poort.js en zakt zodra daar
     een demo-, test-, spel- of simulatiestand in verschijnt. Toets 6 zakt zodra
     een HTTP-route een simulatiescenario doorgeeft -- want dan is de simulatie
     alsnog een knop in de productieweg geworden, en dat is precies de vlag die
     op een dag in productie aan staat.

   EN DAN HET BEWIJS ZELF (toets 7): een lid laadt op via de simulatiebank en
   geeft het geld uit door de echte waardepoort. Een geweigerde simulatie levert
   geen cent op. Dat is wat MAGNAATLAB.md par. 5.1 "een capability, een
   invariant, een keer bewezen" noemt.

   Draai los: node --experimental-sqlite --test test/simulatiebank.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const bank = require('../server/betaal/synthetisch');
const { startServer, stop } = require('./helper');

const WORTEL = path.join(__dirname, '..');
const maak = (env, echteRail) => bank({ crypto, env, echteRail: echteRail || null });

test('1. de drie grendels zitten dicht, en elke zegt WELKE', () => {
  /* Elk van de drie is een fout die iemand echt maakt: de vlag vergeten, de vlag
     meenemen naar productie, of hem aanzetten terwijl er een sleutel staat.
     "Niet beschikbaar" laat iemand daar een kwartier naar zoeken. */
  assert.match(maak({}).belet(), /staat uit/);
  assert.match(maak({ RTG_SIMULATIEBANK: '1', NODE_ENV: 'production' }).belet(), /nooit in productie/);
  assert.match(maak({ RTG_SIMULATIEBANK: '1' }, 'stripe').belet(), /stripe/);
  assert.equal(maak({ RTG_SIMULATIEBANK: '1' }).belet(), null, 'en anders gaat hij open');
  assert.equal(maak({ RTG_SIMULATIEBANK: '1' }).aan(), true);
});

test('2. een gesloten bank boekt niets, hij weigert met de reden', () => {
  const uit = maak({});
  assert.throws(() => uit.maak({ bedrag: 100 }), /staat uit/);
  try { uit.maak({ bedrag: 100 }); } catch (e) { assert.equal(e.code, 'SIMULATIEBANK_UIT'); }
});

test('3. de vier scenarios doen alle vier iets anders', () => {
  /* Dit is het verschil met de demo-provider, en dus de hele reden dat deze rail
     bestaat: hij kan stuk. Zonder deze toets is hij een duurdere demo. */
  const b = maak({ RTG_SIMULATIEBANK: '1' });
  const uitkomsten = {};
  for (const naam of Object.keys(bank.SCENARIOS)) {
    const r = b.maak({ bedrag: 1000, referentie: 'r', idempotentieSleutel: 'k', simulatie: naam });
    uitkomsten[naam] = r.status;
    assert.equal(r.aanbieder, 'simulatie');
    assert.equal(r.simulatie, naam);
    assert.match(r.waarom, /gevraagd/, 'hij zegt erbij waarom, anders is een rode run een raadsel');
  }
  assert.deepEqual(uitkomsten, {
    betaald: 'betaald', geweigerd: 'geweigerd', traag: 'open', terugboeking: 'teruggeboekt'
  });
  assert.equal(new Set(Object.values(uitkomsten)).size, 4, 'vier scenarios, vier uitkomsten');
  assert.throws(() => b.maak({ bedrag: 1, simulatie: 'verzonnen' }), /bestaat niet/);
});

test('4. zonder scenario kiest de sleutel, reproduceerbaar en gespreid', () => {
  const b = maak({ RTG_SIMULATIEBANK: '1' });
  assert.equal(b.scenarioVan({ idempotentieSleutel: 'zelfde' }), b.scenarioVan({ idempotentieSleutel: 'zelfde' }),
    'dezelfde sleutel geeft altijd dezelfde afloop');

  const tel = {};
  for (let i = 0; i < 2000; i++) {
    const n = b.scenarioVan({ idempotentieSleutel: 'run-' + i });
    tel[n] = (tel[n] || 0) + 1;
  }
  /* De tegenproef: een bank die altijd "betaald" zegt haalt deze regel niet, en
     dan is een groene simulatierun niets waard. */
  for (const naam of Object.keys(bank.SCENARIOS))
    assert.ok(tel[naam] > 0, 'scenario ' + naam + ' komt voor in 2000 boekingen (nu: ' + (tel[naam] || 0) + ')');
  assert.ok(tel.betaald < 2000, 'en niet alles is betaald');

  const som = Object.values(bank.SCENARIOS).reduce((n, s) => n + s.deel, 0);
  assert.equal(som, 100, 'de vakken vullen samen precies honderd; anders valt er stil iets buiten');
});

test('5. de waardepoort kent geen simulatiestand, en dat blijft zo', () => {
  /* DE INVARIANT VAN MAGNAATLAB.md par. 3. Zakt deze toets, dan is de rail geen
     rail meer maar een vlag in de poort -- en LAT-regel 5 en 9 komen allebei uit
     gevallen waarin precies dat gebeurde. */
  const poort = fs.readFileSync(path.join(WORTEL, 'server/kern/pay/poort.js'), 'utf8');
  /* GEEN WOORDGRENZEN MAAR STAMMEN, en dat is twee keer gerepareerd door een
     mutatie die er dwars doorheen liep. Hier stond eerst
     `/\b(demo|simulatie|...)\b/`:

       const demoStand = ...        de AFSLUITENDE grens faalt (na demo een letter)
       process.env.RTG_SPELMODUS    de OPENENDE grens faalt (voor spel een _,
                                    en dat is voor een regexp een woordteken)
       besteedDoor(codenaam, isTest) de stam zit MIDDEN in een camelCase-naam

     Alle drie precies de vorm die iemand werkelijk zou schrijven, en alle drie
     bleven ze onzichtbaar -- drie mutaties, drie keer een gat. Nu wordt de regel
     eerst op zijn camelCase-naden opengeknipt en dan op stammen gezocht. Dit
     bestand is klein en stabiel genoeg om daar geen valse treffer op te geven:
     vandaag staat er geen van deze woorden in, in geen enkele vorm. */
  const plat = (r) => r.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  const VERDACHT = /(^|[^A-Za-z])(demo|simulat|synthet|spel|test|mock|fake|sandbox)/i;
  const treffers = poort.split('\n')
    .map((r, i) => ({ r, i: i + 1 }))
    .filter(x => VERDACHT.test(plat(x.r)));
  assert.deepEqual(treffers.map(x => x.i + ': ' + x.r.trim()), [],
    'kern/pay/poort.js hoort geen enkele demo-, spel- of simulatiestand te kennen');
});

test('6. geen enkele HTTP-route geeft een simulatiescenario door', () => {
  /* De rail mag bestaan; een KNOP ernaartoe in de productieweg mag niet. Wie een
     scenario over HTTP kan kiezen, kan een betaling laten slagen die niet
     geslaagd is. De sleutel bepaalt de afloop, en die kiest de aanroeper niet. */
  const routes = [];
  const loop = (map) => {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      if (fs.statSync(p).isDirectory()) loop(p);
      else if (naam.endsWith('.js')) routes.push(p);
    }
  };
  loop(path.join(WORTEL, 'server/routes'));
  assert.ok(routes.length > 50, 'de routes zijn gevonden, nu: ' + routes.length);
  const fout = routes.filter(p => /simulatie\s*:/.test(fs.readFileSync(p, 'utf8')))
    .map(p => path.relative(WORTEL, p));
  assert.deepEqual(fout, [], 'routes die een simulatiescenario doorgeven: ' + fout.join(', '));
});

/* ---------------------------------------------------------------------------
   Het bewijs zelf: een boeking door de ECHTE waardepoort, op geld dat uit de
   simulatiebank komt. Dit is de stap die MAGNAATLAB.md par. 5.1 vraagt.
   --------------------------------------------------------------------------- */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-simbank-'));
let srv, base;

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_SIMULATIEBANK: '1' } });
  base = srv.base;
});
test.after(async () => { await stop(srv); fs.rmSync(TMP, { recursive: true, force: true }); });

test('7. opladen loopt over de simulatiebank, en de poort doet zijn werk ongewijzigd', async () => {
  const inlog = await fetch(base + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' })
  }).then(r => r.json());
  const token = inlog.token;
  const codenaam = (await api('pay/overzicht', {}, token)).body.codenaam;
  assert.ok(codenaam, 'het lid heeft een codenaam');

  /* De sleutel die de server bouwt staat in kern/pay/opladen.js. We zoeken er
     een die 'betaald' geeft en een die 'geweigerd' geeft -- de afloop is dus
     VOORAF bekend, en daarna kijken we of het grootboek hem volgt. */
  const b = maak({ RTG_SIMULATIEBANK: '1' });
  const sleutelVan = (idem) => 'pay-oplaad:' + codenaam + ':' + idem;
  const zoek = (wil) => {
    for (let i = 0; i < 500; i++) {
      const idem = 'sim-' + wil + '-' + i;
      if (b.scenarioVan({ idempotentieSleutel: sleutelVan(idem) }) === wil) return idem;
    }
    throw new Error('geen sleutel gevonden voor ' + wil);
  };

  const geslaagd = await api('pay/oplaad', { centen: 5000, idem: zoek('betaald') }, token);
  assert.equal(geslaagd.status, 200, 'een geslaagde simulatie laadt op');
  assert.equal((await api('pay/overzicht', {}, token)).body.saldo, 5000, 'en het staat op de wallet');

  const afgewezen = await api('pay/oplaad', { centen: 9900, idem: zoek('geweigerd') }, token);
  assert.equal(afgewezen.status, 402, 'een geweigerde simulatie laadt niet op');
  assert.equal((await api('pay/overzicht', {}, token)).body.saldo, 5000,
    'en levert geen cent op -- dit is de regel waar een spelbank op stuk hoort te gaan');

  /* En nu de poort, op gesimuleerd geld: hij weigert wat er niet is. Precies
     dezelfde code als in productie -- er is geen tweede pad. */
  const teveel = await api('pay/stuur', { aan: codenaam, centen: 999999, oms: 'te veel', idem: 'sim-poort-1' }, token);
  assert.ok(teveel.status === 402 || teveel.status === 400,
    'de waardepoort weigert een boeking zonder dekking, ook op simulatiegeld (nu: ' + teveel.status + ')');
});
