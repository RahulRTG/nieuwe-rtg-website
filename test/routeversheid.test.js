/* ============================================================================
   DE ROUTEVERSHEID -- vervalt het bewijs van een route als iets waar hij van
   afhangt verandert? (scripts/routeversheid.js, PROOF.md par. 2a)

   Wat dit bestand bewijst:

     1. DE DRIE STANDEN. `geraakt` gaat voor alles (wat we wel zien IS
        veranderd), `vers` vraagt een VOLLEDIGE sluiting, en een sluiting met
        een gat heet `onbepaald` en nooit `vers`.
     2. DE MONTAGEWORTEL. server.js en opzet/ komen in de sluiting maar er
        wordt niet doorheen gelopen -- anders hangt elke route aan het hele huis.
     3. DE DRIE BLINDE VLEKKEN van de eerste ronde, elk een toets: een fabriek
        die `const { .. } = kern` doet, een fabriek die de tas al in zijn
        PARAMETER destructureert, en een domeinmodule die als "basisobject van
        server.js" door KERNHERKOMST.json gaat. Alle drie leverden een valse
        `vers` op.
     4. DE TEGENPROEF op de echte boom: gemeten tegen HEAD is er niets gewijzigd
        en dus niets geraakt, en de stand `vers` bestaat daar dan ook echt --
        een meter die alleen `geraakt` kan zeggen is geen meter.
     5. HET BLIJFT SCHADUW: de meter schrijft niets.

   Draai los: node --test test/routeversheid.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const rv = require('../scripts/routeversheid');

const set = (...a) => new Set(a);

/* ---------------------------------------------------------------------------
   1. DE DRIE STANDEN
   ------------------------------------------------------------------------- */
test('1a. een gewijzigd bestand in de sluiting maakt de route geraakt', () => {
  const s = rv.standVan({ bestanden: set('server/routes/a.js', 'server/kern/a.js'), ongevolgd: [],
    gewijzigd: set('server/kern/a.js'), meetcommit: 'abc' });
  assert.equal(s.stand, 'geraakt');
  assert.deepEqual(s.geraakt, ['server/kern/a.js']);
});

test('1b. geraakt gaat voor onvolledig: wat we wel zien, IS veranderd', () => {
  const s = rv.standVan({ bestanden: set('server/routes/a.js'), ongevolgd: ['server/routes/a.js'],
    gewijzigd: set('server/routes/a.js'), meetcommit: 'abc' });
  assert.equal(s.stand, 'geraakt');
});

test('1c. een sluiting met een gat is onbepaald en NOOIT vers', () => {
  const s = rv.standVan({ bestanden: set('server/routes/a.js'), ongevolgd: ['server/routes/a.js'],
    gewijzigd: set(), meetcommit: 'abc' });
  assert.equal(s.stand, 'onbepaald');
  assert.match(s.reden, /gat/);
});

test('1d. een volledige, ongewijzigde sluiting is vers', () => {
  const s = rv.standVan({ bestanden: set('server/routes/a.js'), ongevolgd: [], gewijzigd: set('x.md'), meetcommit: 'abc' });
  assert.equal(s.stand, 'vers');
});

test('1e. zonder bronbestand is er geen stand, en dat heet onbepaald', () => {
  assert.equal(rv.standVan({ bestanden: new Set(), ongevolgd: [], gewijzigd: set() }).stand, 'onbepaald');
});

/* ---------------------------------------------------------------------------
   2. DE MONTAGEWORTEL
   ------------------------------------------------------------------------- */
test('2. de montagewortel komt erin, maar er wordt niet doorheen gelopen', () => {
  const graaf = {
    'server/routes/a.js': ['server/server.js', 'server/kern/a.js'],
    'server/server.js': ['server/kern/alles.js'],
    'server/kern/a.js': ['server/lib/b.js'],
    'server/lib/b.js': []
  };
  const s = rv.sluiting(['server/routes/a.js'], (b) => ({ naar: graaf[b] || [], ongevolgd: 0 }));
  assert.ok(s.bestanden.has('server/server.js'));
  assert.ok(s.bestanden.has('server/lib/b.js'), 'transitief gevolgd');
  assert.ok(!s.bestanden.has('server/kern/alles.js'), 'niet door server.js heen');
});

test('2b. een ongevolgde kern-naam ergens in de sluiting maakt hem onvolledig', () => {
  const s = rv.sluiting(['server/routes/a.js'], (b) =>
    b === 'server/routes/a.js' ? { naar: ['server/kern/a.js'], ongevolgd: 0 } : { naar: [], ongevolgd: 1 });
  assert.deepEqual(s.ongevolgd, ['server/kern/a.js']);
});

/* ---------------------------------------------------------------------------
   3. DE DRIE BLINDE VLEKKEN VAN DE EERSTE RONDE
   ------------------------------------------------------------------------- */
test('3a. const { .. } = kern: de namen worden gelezen', () => {
  const g = rv.kernGebruik('module.exports = (kern) => {\n  const { app, rechterhandAI } = kern;\n  kern.notify();\n};');
  assert.deepEqual(g.namen, ['app', 'notify', 'rechterhandAI']);
  assert.equal(g.open, false);
});

test('3b. de tas gedestructureerd in de PARAMETER (rtfos/governance.js)', () => {
  const g = rv.kernGebruik('module.exports = ({ app, officeAuth, rtfos }) => {};');
  assert.deepEqual(g.namen, ['app', 'officeAuth', 'rtfos']);
});

test('3c. module.exports = N, met N elders gedefinieerd', () => {
  assert.equal(rv.fabriekParam('function mount(ctx) {}\nmodule.exports = mount;'), 'ctx');
  assert.equal(rv.fabriekParam('const m = async ({ a }) => 1;\nmodule.exports = m;'), '{ a }');
  assert.equal(rv.fabriekParam('module.exports = { a: 1 };'), null, 'een object is geen fabriek');
});

test('3d. een spread of een dynamische sleutel maakt het gebruik open', () => {
  assert.equal(rv.kernGebruik('module.exports = (k) => { const { a, ...rest } = k; };').open, true);
  assert.equal(rv.kernGebruik('module.exports = (k) => { k[naam](); };').open, true);
});

test('3e. een domeinmodule uit de montagewortel wordt naar zijn require gevolgd', () => {
  const bestaat = (p) => ['server/kern/journalistiek.js', 'server/kern/pay/index.js'].includes(p);
  const kaart = rv.montageHerkomst({
    'server/server.js': "const journalistiek = require('./kern/journalistiek')({ db });\n" +
      "const { betaal, terug: t } = require('./kern/pay');\nfunction addTicket() {}"
  }, bestaat);
  assert.equal(kaart.get('journalistiek'), 'server/kern/journalistiek.js');
  assert.equal(kaart.get('betaal'), 'server/kern/pay/index.js');
  assert.equal(kaart.get('terug'), 'server/kern/pay/index.js');
  assert.equal(kaart.has('addTicket'), false, 'lokaal gedefinieerd: dan hangt de route aan server.js zelf');
});

test('3f. burenIndex: onbekende naam is ongevolgd, montagenaam volgt zijn require', () => {
  const ix = { bestanden: new Map([
    ['server/routes/j.js', { pad: 'server/routes/j.js', kanten: { opgelost: [] } }],
    ['server/routes/r.js', { pad: 'server/routes/r.js', kanten: { opgelost: [] } }]
  ]) };
  const bron = {
    'server/routes/j.js': 'module.exports = (kern) => { const { journalistiek, addTicket } = kern; };',
    'server/routes/r.js': 'module.exports = (kern) => { const { rechterhandAI } = kern; };'
  };
  const herkomst = new Map([
    ['journalistiek', [{ bestand: 'server/server.js', hoe: 'basisobject' }]],
    ['addTicket', [{ bestand: 'server/server.js', hoe: 'basisobject' }]]
  ]);
  const buren = rv.burenIndex(ix, [], herkomst, (p) => bron[p] || '',
    new Map([['journalistiek', 'server/kern/journalistiek.js']]));
  assert.deepEqual(buren('server/routes/j.js').naar.sort(), ['server/kern/journalistiek.js', 'server/server.js']);
  assert.equal(buren('server/routes/j.js').ongevolgd, 0);
  assert.equal(buren('server/routes/r.js').ongevolgd, 1, 'een naam die KERNHERKOMST niet kent is een gat');
});

/* ---------------------------------------------------------------------------
   4. DE ECHTE BOOM
   ------------------------------------------------------------------------- */
test('4a. een meetcommit die niet bestaat is niet vast te stellen, met de reden', () => {
  const r = rv.gewijzigdSinds('0000000000000000000000000000000000000000');
  assert.ok(r.reden && !r.gewijzigd);
});

test('4b. tegenproef: gemeten tegen HEAD is niets geraakt, en vers bestaat echt', () => {
  const u = rv.meet({ sinds: 'HEAD' });
  assert.equal(u.vastTeStellen, true, u.reden);
  assert.equal(u.gewijzigdeBestanden, 0);
  assert.equal(u.telling.geraakt, 0);
  assert.ok(u.telling.vers > 0, 'een meter die nooit vers kan zeggen, kan ook niet uitslaan');
  assert.ok(u.telling.onbepaald > 0, 'en de gaten blijven zichtbaar: onbepaald is geen vers');
});

/* ---------------------------------------------------------------------------
   5. SCHADUW
   ------------------------------------------------------------------------- */
test('5. de meter schrijft niets: VERTROUWEN.json en de schorspoort blijven onaangeroerd', () => {
  const bron = fs.readFileSync(path.join(__dirname, '../scripts/routeversheid.js'), 'utf8');
  assert.doesNotMatch(bron, /writeFileSync|appendFileSync|renameSync/);
});
