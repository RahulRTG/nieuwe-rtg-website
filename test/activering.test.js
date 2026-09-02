/* DE ACTIVERINGSMETER -- en of hij werkelijk iets onderscheidt.

   scripts/activering.js beantwoordt per functie: wat wordt er wakker als ik dit
   aanzet? Die meter heeft in drie ronden drie keer een ander getal gegeven, en
   alle drie de keren was de vorige fout. Dat is precies waarom deze toetsen er
   staan -- elk van de drie fouten heeft er een:

     RONDE 1  de envelop van /api/stream was 814 van de 849 knopen (96%). Die
              route hangt in server.js, en de sluiting vanaf de BEDRADING is het
              hele huis. Toets 4.
     RONDE 2  server/routes/gewoonten.js leek een eiland van EEN bestand. Het
              heeft nul requires: zijn hele domein komt via de kern-tas binnen.
              Toets 5.
     RONDE 3  32 functies hielden een envelop van EEN knoop over, en dat las als
              "raakt bijna niets" terwijl het "hierover is niets bekend" was.
              Een envelop met een onopgeloste sleutel is een ONDERGRENS. Toets 6.

   Draai los: node --test test/activering.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../scripts/activering');

/* De meter zelf start de app; deze toetsen doen dat niet. Alles hieronder werkt
   op de pure kant (envelopen/sluiting/kernSleutelsVan), en dat is ook de reden
   dat die kant puur is. */

test('1. de parameternaam van de fabriek wordt GELEZEN, niet aangenomen', () => {
  /* Niet elk bestand noemt zijn tas `kern`. Wie die naam aanneemt, krijgt stil
     nul sleutels terug -- en dat ziet er hetzelfde uit als een bestand dat de
     tas niet gebruikt. */
  const bron = 'module.exports = (k) => {\n const { app, auth, ritStart } = k;\n};';
  assert.deepEqual([...A.kernSleutelsVan(bron)].sort(), ['app', 'auth', 'ritStart']);
});

test('2. ook een sleutel die niet wordt uitgepakt telt mee', () => {
  const bron = 'module.exports = (kern) => {\n kern.log.info();\n kern.betaalPoort(1);\n};';
  assert.deepEqual([...A.kernSleutelsVan(bron)].sort(), ['betaalPoort', 'log']);
});

test('3. de sluiting is transitief en loopt niet vast op een kring', () => {
  const graaf = new Map([
    ['a.js', new Set(['b.js'])],
    ['b.js', new Set(['c.js', 'a.js'])],
    ['c.js', new Set()]
  ]);
  assert.deepEqual([...A.sluiting(graaf, ['a.js'])].sort(), ['a.js', 'b.js', 'c.js']);
});

test('4. een route uit de BEDRADING krijgt geen toerekenbare envelop', () => {
  /* De 96%-fout. server.js requiret het halve huis omdat bedraden zijn taak is;
     wie dat aan de functie toerekent, meet waar de route hangt in plaats van
     wat hij gebruikt. */
  const graaf = new Map([
    ['server/server.js', new Set(['server/kern/alles/index.js', 'server/kern/nogmeer/index.js'])],
    ['server/routes/klein.js', new Set(['server/kern/klein/index.js'])]
  ]);
  const routes = [
    { methode: 'GET', pad: '/api/stream', bestand: 'server/server.js' },
    { methode: 'GET', pad: '/api/stream/x', bestand: 'server/routes/klein.js' }
  ];
  const r = A.envelopen({ routes, graaf, functieVoorPad: () => ({ id: 'kern-live', naam: 'Live' }) });
  const e = r.envelopen[0];
  assert.equal(e.graad, 'deels-niet-toe-te-rekenen');
  assert.equal(e.inBedrading, 1);
  /* En de bedrading sleept haar eigen sluiting niet mee naar binnen. */
  assert.deepEqual(e.domeinen, ['domein:klein']);
});

test('5. een kern-sleutel trekt zijn leverancier de envelop in', () => {
  /* Zonder deze stap is de hele meting fictie: server/routes/gewoonten.js heeft
     nul requires en gebruikt kern/gewoonten.js volledig via de tas. */
  const graaf = new Map([['server/kern/gewoonten.js', new Set(['server/lib/tijd.js'])]]);
  const bestanden = { 'server/routes/gewoonten.js': 'module.exports = (kern) => { const { app, gewoontenVan } = kern; };' };
  const r = A.envelopen({
    routes: [{ methode: 'POST', pad: '/api/gewoonten', bestand: 'server/routes/gewoonten.js' }],
    graaf,
    functieVoorPad: () => ({ id: 'gewoonten', naam: 'Gewoonten' }),
    kernBron: { gewoontenVan: 'server/kern/gewoonten.js', app: 'server/server.js' },
    leesBestand: b => bestanden[b] || ''
  });
  const e = r.envelopen[0];
  assert.ok(e.leveranciers.includes('server/kern/gewoonten.js'), 'de leverancier hoort in de envelop');
  assert.ok(e.domeinen.includes('domein:gewoonten'), 'en dus ook zijn domein');
  assert.equal(e.bestandenBereikt, 3, 'route + leverancier + wat die leverancier requiret');
  /* En `app` komt uit server.js: die sleutel wordt apart gehouden en trekt de
     bedrading NIET mee. Dat is dezelfde fout als toets 4, langs een andere weg,
     en deze toets vond hem terwijl hij al geschreven was. */
  assert.deepEqual(e.sleutelsUitBedrading, ['app']);
  assert.ok(!e.domeinen.some(d => d.includes('server')), 'de bedrading hoort er niet in');
});

test('6. een onopgeloste sleutel maakt de envelop een ONDERGRENS', () => {
  /* De gevaarlijkste faalvorm van deze meter: een klein getal dat "raakt bijna
     niets" lijkt te zeggen terwijl er niets bekend is. */
  const bestanden = { 'server/routes/vonk.js': 'module.exports = (kern) => { const { vonkBericht } = kern; };' };
  const maak = kernBron => A.envelopen({
    routes: [{ methode: 'POST', pad: '/api/vonk', bestand: 'server/routes/vonk.js' }],
    graaf: new Map(), functieVoorPad: () => ({ id: 'vonk', naam: 'Vonk' }),
    kernBron, leesBestand: b => bestanden[b] || ''
  }).envelopen[0];

  const onbekend = maak({});
  assert.equal(onbekend.graad, 'ondergrens');
  assert.deepEqual(onbekend.sleutelsOnbekend, ['vonkBericht']);

  const bekend = maak({ vonkBericht: 'server/kern/vonk.js' });
  assert.equal(bekend.graad, 'gemeten');
});

test('7. een route zonder functie verdwijnt niet, hij komt apart terug', () => {
  /* functieAan() geeft true bij een onbekende id: een pad zonder functie is
     nergens uit te zetten. Zo'n route stil laten vallen is het gat verbergen. */
  const r = A.envelopen({
    routes: [{ methode: 'GET', pad: '/api/health', bestand: 'server/routes/x.js' }],
    graaf: new Map(), functieVoorPad: () => null
  });
  assert.equal(r.envelopen.length, 0);
  assert.equal(r.zonderFunctie.length, 1);
  assert.equal(r.zonderFunctie[0].pad, '/api/health');
});

test('8. de onverklaarde randen van stap 1 komen mee de envelop in', () => {
  /* Niet hoe groot een envelop is maakt een trede onveilig, maar hoeveel ervan
     niemand kan uitleggen. Die twee metingen horen aan elkaar vast. */
  const graaf = new Map([['server/routes/mall.js', new Set(['server/kern/mall/index.js'])],
    ['server/kern/mall/index.js', new Set(['server/kern/ervaring/index.js'])]]);
  const r = A.envelopen({
    routes: [{ methode: 'GET', pad: '/api/mall', bestand: 'server/routes/mall.js' }],
    graaf, functieVoorPad: () => ({ id: 'mall', naam: 'Mall' }),
    onbekendeRanden: new Set(['domein:mall -> domein:ervaring', 'domein:school -> domein:office'])
  });
  assert.deepEqual(r.envelopen[0].onverklaardeRanden, ['domein:mall -> domein:ervaring']);
});

test('9. de wikkel om elke handler is niet de eigenaar van de route', () => {
  const { eigenaarVan } = require('../scripts/lib/routeherkomst');
  assert.equal(eigenaarVan(['server/lib/foutisolatie.js', 'server/routes/bank.js']), 'server/routes/bank.js');
  /* En blijft er niets over, dan is dat een uitslag en geen gok. */
  assert.equal(eigenaarVan(['server/lib/foutisolatie.js']), null);
  assert.equal(eigenaarVan([]), null);
});
