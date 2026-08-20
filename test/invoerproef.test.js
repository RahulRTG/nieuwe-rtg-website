/* HET OORDEEL VAN DE INVOERPROEF, los van een server.

   scripts/invoerproef-route.js heeft een echte server nodig en duurt minuten;
   daar komt niemand ooit met een mutatie bij. Het oordeel zelf is puur en hoort
   dus hier getoetst te worden -- dezelfde opzet als test/rolproef.test.js, en om
   dezelfde reden (LAT.md, regel 10: een meter die je niet hebt zien uitslaan,
   meet niets).

   DE TWEE BEWIJSSOORTEN STAAN UIT ELKAAR, en dat hoort erbij:

     de DETECTOR      hier, met bekend-foute invoer -- source mutation
     de RONDE zelf    scripts/invoerproef-route.js, tegen een echte server;
                      die zakt op zijn eigen blindheidscontrole als geen enkel
                      rommelverzoek voorbij een poort komt

   Draai los: node --test test/invoerproef.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { weegInvoer, sporenIn, draaiInvoerproef, SPOORMERKERS } = require('../scripts/lib/invoerproef');

/* ---------- de detector ---------- */

test('een 500 op rommel is een breuk', () => {
  const o = weegInvoer(500, '{"error":"Interne fout."}');
  assert.equal(o.breekt, true);
  assert.equal(o.poort, false);
});

test('geen antwoord is geen nettere uitkomst dan een 500', () => {
  assert.equal(weegInvoer(0, '').breekt, true);
  assert.equal(weegInvoer(null, '').breekt, true);
});

test('503 is hier een ONTWORPEN antwoord en dus een grendel, geen breuk', () => {
  /* Dit is de regel die de eerste ronde koste: drie loze bevindingen op
     /api/bank/krediet*, waar 503 "hiervoor is een vergunning nodig" betekent.
     Een grendel telt als ongemeten -- nooit als groen, en nooit als bevinding. */
  const o = weegInvoer(503, '{"error":"Hiervoor is een bankvergunning nodig.","reden":"bevoegdheid"}');
  assert.equal(o.poort, true);
  assert.equal(o.breekt, false);
  assert.equal(o.spoor, null);
});

test('401 en 403 zijn grendels; 400 is precies wat rommel hoort op te leveren', () => {
  assert.equal(weegInvoer(401, '{}').poort, true);
  assert.equal(weegInvoer(403, '{"error":"RTG Bank is voor leden."}').poort, true);
  const vierhonderd = weegInvoer(400, '{"error":"Kies een looptijd tussen 1 en 360 maanden."}');
  assert.equal(vierhonderd.poort, false, 'een 400 IS de meting: de validatie heeft geantwoord');
  assert.equal(vierhonderd.breekt, false);
  assert.equal(vierhonderd.spoor, null);
});

test('een grendel die zijn binnenkant laat zien is geen nette weigering meer', () => {
  /* Zonder deze regel zou 503 een schuilplaats worden: alles wat daarachter
     lekt, telt dan als "ongemeten" in plaats van als bevinding. */
  const o = weegInvoer(503, '{"error":"x","stack":"Error: kapot\\n    at doeIets (/home/rtg/server/kern/bank.js:12:9)"}');
  assert.equal(o.poort, false);
  assert.ok(o.spoor, 'een spoor achter een grendel hoort alsnog gezien te worden');
});

test('de vijf spoormerkers slaan aan op machinetaal', () => {
  assert.equal(sporenIn('Error: x\n    at Object.doeIets (/app/server/kern/x.js:12:9)'), 'stack trace');
  /* Zonder regel:kolom is dit geen stackframe voor de eerste merker; de tweede
     hoort hem alsnog te zien. Precies daarom staan er vijf en niet een. */
  assert.equal(sporenIn('at async node:internal/main/run_main_module:23'), 'node-intern pad');
  assert.equal(sporenIn('kon /home/rtg/server/data/db.json niet lezen'), 'pad op de schijf');
  assert.equal(sporenIn('SQLITE_BUSY: database is locked'), 'databasefoutcode');
  assert.equal(sporenIn('{"stack":"Error: iets"}'), 'stack-veld in de JSON');
  assert.equal(SPOORMERKERS.length, 5, 'wie er een toevoegt, toetst hem hier');
});

test('en NIET op gewone Nederlandse foutteksten', () => {
  /* De tegenhanger, en zonder deze toets is de merkerlijst gevaarlijk: honderden
     valse bevindingen zijn hetzelfde als geen proef, want ze worden weggestreept
     tot iemand hem uitzet. */
  for (const tekst of [
    '{"error":"Opladen kan van 1 tot 5000 euro."}',
    '{"error":"Geen lid gevonden met die codenaam."}',
    '{"error":"Het bord zit vol; ruim eerst het archief op."}',
    '{"error":"Dit punt staat niet (meer) op de lijst."}',
    '{"error":"De betaling wacht op bevestiging.","betaalStatus":"open"}'
  ]) assert.equal(sporenIn(tekst), null, 'vals alarm op: ' + tekst);
});

/* ---------- de ronde ---------- */

const nepPost = (antwoorden) => {
  let i = 0;
  return async () => antwoorden[Math.min(i++, antwoorden.length - 1)];
};

test('een route achter een grendel is ONGEMETEN en niet dicht', async () => {
  const uit = await draaiInvoerproef({
    post: nepPost([{ status: 403, data: { error: 'nee' } }, { status: 400, data: { error: 'rommel' } }]),
    routes: [{ methode: 'POST', pad: '/api/dicht', rol: 'member' }, { methode: 'POST', pad: '/api/open', rol: 'member' }],
    tokenVoor: () => 't', rommelVoor: () => ({ x: 1 }), perRoute: 1
  });
  assert.equal(uit.perRoute['POST /api/dicht'].invoer, 'poort');
  assert.match(uit.perRoute['POST /api/dicht'].reden, /grendel/);
  assert.equal(uit.perRoute['POST /api/open'].invoer, 'dicht');
});

test('de ronde oordeelt NIET als niets voorbij een poort kwam', async () => {
  /* De blindheidscontrole. Zonder deze zou een ronde met een dood token
     "geen bevindingen" melden over duizenden routes die hij nooit heeft bereikt
     -- exact de fout waar deze proef voor bestaat. */
  const uit = await draaiInvoerproef({
    post: nepPost([{ status: 401, data: {} }]),
    routes: [{ methode: 'POST', pad: '/api/a', rol: 'member' }, { methode: 'POST', pad: '/api/b', rol: 'member' }],
    tokenVoor: () => 't', rommelVoor: () => ({}), perRoute: 1
  });
  assert.ok(uit.meterStuk, 'nul bereikte routes hoort een blinde ronde te zijn');
  assert.match(uit.meterStuk, /voordeur/);
  assert.equal(uit.bereikt, 0);
});

test('een dood token wordt hernieuwd in plaats van als bevinding geteld', async () => {
  /* Een 401 halverwege is een meetfout en geen defect. Zonder de hernieuwing
     staat de rest van de ronde stil achter de deur, en dat leest als groen. */
  let beurt = 0;
  const post = async () => (++beurt === 1 ? { status: 401, data: {} } : { status: 400, data: { error: 'rommel' } });
  const uit = await draaiInvoerproef({
    post, routes: [{ methode: 'POST', pad: '/api/a', rol: 'member' }],
    tokenVoor: () => 't', rommelVoor: () => ({}), hernieuw: async () => true, perRoute: 1
  });
  assert.equal(uit.hernieuwd, 1);
  assert.equal(uit.perRoute['POST /api/a'].invoer, 'dicht');
  assert.equal(uit.bereikt, 1);
});

test('een breuk stopt die route en komt met de rommel erbij in het register', async () => {
  const uit = await draaiInvoerproef({
    post: nepPost([{ status: 500, data: { error: 'Interne fout.' } }]),
    routes: [{ methode: 'POST', pad: '/api/stuk', rol: 'member' }],
    tokenVoor: () => 't', rommelVoor: () => ({ gemeen: '😀'.repeat(3) }), perRoute: 3
  });
  const rij = uit.perRoute['POST /api/stuk'];
  assert.equal(rij.invoer, 'GEZAKT');
  assert.equal(rij.pogingen, 1, 'na een breuk hoeft dezelfde route niet nog twee keer om');
  assert.match(rij.rommel, /gemeen/, 'zonder de rommel is de bevinding niet na te spelen');
  assert.equal(uit.bevindingen.breuken.length, 1);
});
