/* DE ENDPOINT-BEWIJSMATRIX (scripts/bewijsmatrix.js): het register dat per route
   de elf schakels langsloopt en zegt wie er een bewijst.

   WAT HIER OP HET SPEL STAAT, en het is precies het gevaar dat de matrix zelf
   moest wegnemen: een register dat te makkelijk "bewezen" zegt is schadelijker
   dan geen register, want het geeft rust die niemand heeft verdiend. De vier
   standen moeten dus scherp uit elkaar blijven -- vooral bewezen (iemand heeft
   het GEMETEN) tegenover verklaard (het staat in de bron).

   Puur, dus zonder server: bouw() krijgt zijn vier bronnen als parameter mee.
   Draai los: node --test test/bewijsmatrix.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { bouw, achteruit, SCHAKELS } = require('../scripts/bewijsmatrix');

/* Een miniwereld van drie routes: een schrijfroute met een bewaker in de bron,
   dezelfde weg als leesroute, en een schrijfroute zonder enige bewaker. */
const TABEL = {
  routes: [
    { methode: 'POST', pad: '/api/proef/schrijf' },
    { methode: 'GET', pad: '/api/proef/lees' },
    { methode: 'POST', pad: '/api/proef/kaal' }
  ],
  herkomst: 'proef'
};
const BEWAKERS = new Map([
  ['POST /api/proef/schrijf', { bewakers: ['auth'], waar: 'server/proef.js:1' }]
]);

/* ALLE ZES DE BRONNEN EXPLICIET OP null, en dat is sinds vandaag nodig. De
   matrix leest de registers nu standaard uit de wortel; zonder deze regels zou
   een toets over een verzonnen routetabel stilletjes de ECHTE ROLPROEF.json van
   dit moment meelezen, en dan hangt hij af van wanneer je hem draait. */
const leeg = () => bouw({ tabel: TABEL, bewakers: BEWAKERS, journaal: null,
  poort: null, rol: null, keten: null, invoer: null, idem: null });
const rij = (m, pad) => leeg().rijen.find(r => r.methode === m && r.pad === pad);

test('elke route krijgt elke schakel: geen cel valt stilletjes weg', () => {
  const m = leeg();
  assert.equal(m.routes, 3);
  assert.equal(m.schakels, SCHAKELS.length);
  assert.equal(m.cellen, 3 * SCHAKELS.length);
  for (const r of m.rijen) {
    for (const s of SCHAKELS) assert.ok(r.cellen[s.id], s.id + ' ontbreekt op ' + r.pad);
  }
});

test('de vier standen tellen samen op tot alle cellen -- geen vijfde stand, niets dubbel', () => {
  const m = leeg();
  const t = m.telling;
  assert.equal(t.bewezen + t.verklaard + t.nvt + t.ongemeten, m.cellen);
});

test('een bewaker in de BRON levert verklaard en nadrukkelijk geen bewezen', () => {
  const c = rij('POST', '/api/proef/schrijf').cellen.AUTH;
  assert.equal(c.staat, 'verklaard');
  assert.equal(c.bron, 'auth');
  assert.equal(c.waar, 'server/proef.js:1');
});

test('geen bewaker en geen meting is ongemeten, niet stilletjes verklaard', () => {
  assert.equal(rij('POST', '/api/proef/kaal').cellen.AUTH.staat, 'ongemeten');
});

test('een gemeten poortwacht-oordeel wint van de bron: verklaard wordt bewezen', () => {
  const poort = new Map([['POST /api/proef/schrijf', { oordeel: 'dicht' }]]);
  const m = bouw({ tabel: TABEL, bewakers: BEWAKERS, journaal: null, poort });
  const c = m.rijen.find(r => r.pad === '/api/proef/schrijf').cellen.AUTH;
  assert.equal(c.staat, 'bewezen');
  assert.equal(c.bron, 'poortwacht');
  assert.equal(c.oordeel, 'dicht');
});

test('een leesroute krijgt nvt op wat alleen over muteren gaat, en niet op de rest', () => {
  const lees = rij('GET', '/api/proef/lees').cellen;
  const schrijf = rij('POST', '/api/proef/schrijf').cellen;
  for (const s of SCHAKELS.filter(x => x.nvtBijLezen)) {
    assert.equal(lees[s.id].staat, 'nvt', s.id + ' hoort nvt te zijn op een GET');
    assert.notEqual(schrijf[s.id].staat, 'nvt', s.id + ' is op een POST wel van toepassing');
  }
  // AUTH en PRIVACY gelden juist WEL voor een leesroute: lezen is het lek
  assert.notEqual(lees.AUTH.staat, 'nvt');
  assert.notEqual(lees.PRIVACY.staat, 'nvt');
});

test('geraakt is een vlag en geen kolom -- aanraken is geen bewijs', () => {
  const m = bouw({ tabel: TABEL, bewakers: BEWAKERS, poort: null,
    journaal: new Set(['/api/proef/schrijf']) });
  const r = m.rijen.find(x => x.pad === '/api/proef/schrijf');
  assert.equal(r.geraakt, true);
  // en het heeft geen enkele cel groen gemaakt
  assert.equal(r.cellen.OUTPUT.staat, 'ongemeten');
  assert.equal(r.cellen.STATE.staat, 'ongemeten');
  assert.ok(!SCHAKELS.some(s => s.id === 'GERAAKT'));
});

test('zonder journaal blijft geraakt null en wordt het geen stille false', () => {
  assert.equal(rij('POST', '/api/proef/schrijf').geraakt, null);
});

test('de ratel wijst de schakel aan die achteruit ging, met de meetronde als reden', () => {
  const met = bouw({ tabel: TABEL, bewakers: BEWAKERS, journaal: null,
    poort: new Map([['POST /api/proef/schrijf', { oordeel: 'dicht' }]]) });
  const zonder = leeg();
  const uit = achteruit(zonder, met);
  assert.equal(uit.length, 1);
  assert.match(uit[0], /AUTH/);
  assert.match(uit[0], /is de meetronde meegeleverd/);
});

test('vooruitgang is geen achteruitgang: de ratel meldt dan niets', () => {
  const met = bouw({ tabel: TABEL, bewakers: BEWAKERS, journaal: null,
    poort: new Map([['POST /api/proef/schrijf', { oordeel: 'dicht' }]]) });
  assert.deepEqual(achteruit(met, leeg()), []);
});

test('geen enkele schakel doet alsof hij een instrument heeft dat er niet is', () => {
  /* De zeven lege kolommen MOETEN blijven zeggen wat ze nodig hebben. Verdwijnt
     die tekst, dan leest een lege kolom als een kolom die toevallig nul scoort,
     en dat is het verschil tussen een gat en een cijfer. */
  for (const s of SCHAKELS) {
    if (s.bron) continue;
    assert.ok(s.nodig && s.nodig.length > 20,
      s.id + ' heeft geen instrument en ook geen omschrijving van wat hij nodig heeft');
  }
});

/* ---------- beproefd en gezakt is geen bewijs, ook niet bij de voordeur ----------

   Dit stond hier fout: elk poortwacht-oordeel werd als `bewezen` overgenomen,
   ook `open` -- een route waar een vreemde zonder token binnenkwam. Twaalf van
   die cellen telden mee als dekking. ACL en PRIVACY deden het al goed. */
const metPoort = (oordeel, extra) => bouw({ tabel: TABEL, bewakers: BEWAKERS, journaal: null,
  rol: null, keten: null, invoer: null, idem: null,
  poort: new Map([['POST /api/proef/schrijf', { oordeel, status: 200, ...extra }]]) })
  .rijen.find(r => r.pad === '/api/proef/schrijf').cellen.AUTH;

test('een route waar de poortwacht ZONDER TOKEN binnenkwam is gezakt, niet bewezen', () => {
  const c = metPoort('open');
  assert.equal(c.staat, 'gezakt');
  assert.match(c.reden, /zonder token/);
});

test('een dichte en een bewust publieke route zijn wel bewezen', () => {
  assert.equal(metPoort('dicht').staat, 'bewezen');
  assert.equal(metPoort('publiek').staat, 'bewezen');
  assert.equal(metPoort('stil').staat, 'bewezen');
});

test('onbereikbaar is ongemeten: daar kwam geen antwoord', () => {
  assert.equal(metPoort('onbereikbaar').staat, 'ongemeten');
});

/* ---------- de twee nieuwe kolommen ---------- */

const metInvoer = (rij) => bouw({ tabel: TABEL, bewakers: BEWAKERS, journaal: null,
  poort: null, rol: null, keten: null, idem: null,
  invoer: new Map([['POST /api/proef/schrijf', { methode: 'POST', pad: '/api/proef/schrijf', ...rij }]]) })
  .rijen.find(r => r.pad === '/api/proef/schrijf').cellen.INPUT;

test('INPUT: dicht is bewezen, GEZAKT is gezakt, en een grendel is ONGEMETEN met reden', () => {
  assert.equal(metInvoer({ invoer: 'dicht', pogingen: 2 }).staat, 'bewezen');
  assert.equal(metInvoer({ invoer: 'GEZAKT', reden: 'status 500' }).staat, 'gezakt');
  const poort = metInvoer({ invoer: 'poort', reden: 'elk antwoord was een grendel' });
  assert.equal(poort.staat, 'ongemeten', 'achter een grendel is niet gemeten en dus geen groen');
  assert.match(poort.reden, /grendel/, 'zonder reden is dit niet te onderscheiden van nooit geprobeerd');
});

const metIdem = (rij) => bouw({ tabel: TABEL, bewakers: BEWAKERS, journaal: null,
  poort: null, rol: null, keten: null, invoer: null,
  idem: new Map([['POST /api/proef/schrijf', { methode: 'POST', pad: '/api/proef/schrijf', ...rij }]]) })
  .rijen.find(r => r.pad === '/api/proef/schrijf').cellen.IDEMPOTENCY;

test('IDEMPOTENCY: beschermd is bewezen, onbeschermd is gezakt, ongemeten blijft ongemeten', () => {
  assert.equal(metIdem({ idempotentie: 'beschermd', reden: 'herhaald' }).staat, 'bewezen');
  /* Onbeschermd is in het REGISTER een neutrale telling en in deze KOLOM een
     gezakte belofte: "twee keer doet niet twee keer iets" gaat er niet op. */
  assert.equal(metIdem({ idempotentie: 'onbeschermd', reden: 'deed het opnieuw' }).staat, 'gezakt');
  assert.equal(metIdem({ idempotentie: 'ongemeten', reden: 'geen werk gedaan' }).staat, 'ongemeten');
});

test('een leesroute houdt IDEMPOTENCY op nvt, ook met een register ernaast', () => {
  const m = bouw({ tabel: TABEL, bewakers: BEWAKERS, journaal: null, poort: null, rol: null, keten: null,
    invoer: null, idem: new Map([['GET /api/proef/lees', { idempotentie: 'onbeschermd' }]]) });
  assert.equal(m.rijen.find(r => r.pad === '/api/proef/lees').cellen.IDEMPOTENCY.staat, 'nvt');
});
