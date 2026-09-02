/* De wereldcontrole en de wereldwacht.

   Waarom ze bestaan staat in de kop van scripts/lib/wereldcontrole.js: de
   proef roept elke route aan, en er staan sloopachtige routes BINNEN de
   werelden die zij zelf opzet. Een wereld die halverwege sneuvelt meldde zich
   nog steeds klaar -- want klaar was hij, aan het begin.

   Deze toets draait op een verzonnen `post`, niet op een server: wat hier
   bewaakt wordt is de REDENERING (wanneer heet iets gecontroleerd, wanneer
   gesneuveld, wanneer geen uitslag), en die hoort niet af te hangen van een
   draaiende installatie. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { CONTROLES, controleerWerelden, maakWereldwacht } = require('../scripts/lib/wereldcontrole');

const volleExtras = () => {
  const e = {};
  for (const c of CONTROLES) {
    e[c.wereld] = {};
    for (const v of c.velden) e[c.wereld][v] = 'X';
  }
  return e;
};

test('elke controle noemt een wereld, een pad, velden en een reden', () => {
  for (const c of CONTROLES) {
    assert.ok(c.wereld && c.pad.startsWith('/api/'), JSON.stringify(c));
    assert.ok(Array.isArray(c.velden) && c.velden.length, 'velden van ' + c.wereld);
    assert.ok((c.waarom || '').length >= 20, 'de reden bij ' + c.wereld + ' is te kort');
  }
});

test('geen twee controles op dezelfde wereld', () => {
  const namen = CONTROLES.map(c => c.wereld);
  assert.equal(new Set(namen).size, namen.length);
});

/* NIET GEKEKEN IS GEEN UITSLAG (LAT.md regel 3). Een wereld die niet is
   opgezet hoort `gecontroleerd: false` te krijgen en NOOIT `ok: false` --
   anders leest een ontbrekende wereld als een kapotte. */
test('een wereld zonder gegevens levert geen oordeel, maar een reden', async () => {
  const uit = await controleerWerelden({ post: async () => ({ status: 200, data: {} }), extras: {} });
  assert.equal(uit.length, CONTROLES.length);
  for (const u of uit) {
    assert.equal(u.gecontroleerd, false, u.wereld);
    assert.equal(u.ok, null, u.wereld + ' kreeg een oordeel zonder te kijken');
    assert.ok((u.waarom || '').length > 10);
  }
});

test('een wereld die antwoordt staat overeind', async () => {
  const uit = await controleerWerelden({
    post: async () => ({ status: 200, data: { ok: true } }),
    extras: volleExtras(), tokenVoor: () => 'tok'
  });
  for (const u of uit) { assert.equal(u.gecontroleerd, true, u.wereld); assert.equal(u.ok, true, u.wereld); }
});

test('een wereld die weigert is gesneuveld, met de reden van de route erbij', async () => {
  const uit = await controleerWerelden({
    post: async () => ({ status: 404, data: { error: 'Bestaat niet.' } }),
    extras: volleExtras(), tokenVoor: () => 'tok'
  });
  for (const u of uit) { assert.equal(u.ok, false, u.wereld); assert.match(u.waarom, /Bestaat niet/); }
});

/* EEN SESSIE IS GEEN WERELD. Dit is de fout die deze module zelf maakte: zij
   meldde de spelwereld gesneuveld terwijl /api/logout de sessie had gesloten
   en het potje er gewoon nog stond. */
test('een sessie die niet terugkomt levert geen oordeel over de wereld', async () => {
  const uit = await controleerWerelden({
    post: async () => ({ status: 200, data: {} }),
    extras: volleExtras(), tokenVoor: () => 'tok',
    hernieuw: async () => false
  });
  const metRol = uit.filter(u => CONTROLES.find(c => c.wereld === u.wereld).rol);
  assert.ok(metRol.length, 'er horen controles met een rol te zijn');
  for (const u of metRol) {
    assert.equal(u.gecontroleerd, false, u.wereld + ' werd beoordeeld op een dode sessie');
    assert.match(u.waarom, /sessie/);
  }
});

/* DE WACHT. Hij meldt een VENSTER en geen route: tussen twee peilingen liggen
   er meer, en een naam noemen die maar half klopt is erger dan een bereik. */
test('de wacht meldt het venster waarin een wereld omsloeg', async () => {
  let stuk = false;
  const w = maakWereldwacht({
    post: async () => (stuk ? { status: 404, data: { error: 'weg' } } : { status: 200, data: {} }),
    tokenVoor: () => 'tok', extras: volleExtras(), elke: 100
  });
  await w.naRoute(100, '/api/een');   // eerste peiling: alles overeind
  stuk = true;
  await w.naRoute(200, '/api/twee');  // tweede peiling: alles stuk
  const v = w.verslag();
  assert.equal(v.peilingen, 2);
  assert.equal(v.gebeurtenissen.length, CONTROLES.length);
  const g = v.gebeurtenissen[0];
  assert.equal(g.van, 'overeind');
  assert.equal(g.naar, 'stuk');
  assert.equal(g.vanafRoute, 101);
  assert.equal(g.totRoute, 200);
});

/* Tussen twee peilingen wordt er niet gepeild -- anders kost de wacht meer dan
   hij waard is. */
test('de wacht peilt niet vaker dan zijn stap', async () => {
  let n = 0;
  const w = maakWereldwacht({
    post: async () => { n++; return { status: 200, data: {} }; },
    tokenVoor: () => 'tok', extras: volleExtras(), elke: 100
  });
  for (let i = 1; i <= 99; i++) await w.naRoute(i, '/api/x');
  assert.equal(w.verslag().peilingen, 0, 'er werd gepeild voor de stap om was');
  await w.naRoute(100, '/api/x');
  assert.equal(w.verslag().peilingen, 1);
  assert.equal(n, CONTROLES.length, 'een peiling is een oproep per wereld');
});

/* Een herstel is net zo goed een omslag: een route die iets sloopt en een
   latere die het terugzet, laten aan het EIND niets zien. */
test('de wacht meldt ook een herstel', async () => {
  let stuk = true;
  const w = maakWereldwacht({
    post: async () => (stuk ? { status: 404, data: { error: 'weg' } } : { status: 200, data: {} }),
    tokenVoor: () => 'tok', extras: volleExtras(), elke: 50
  });
  await w.naRoute(50, '/api/een');
  stuk = false;
  await w.naRoute(100, '/api/twee');
  const g = w.verslag().gebeurtenissen[0];
  assert.equal(g.van, 'stuk');
  assert.equal(g.naar, 'overeind');
});
