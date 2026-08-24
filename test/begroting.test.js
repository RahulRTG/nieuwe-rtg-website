/* DE BEGROTING (server/opzet/begroting.js).

   WAT HIER OP HET SPEL STAAT. Dit is de eerste laag in dit huis die een handeling
   kan WEIGEREN in plaats van hem achteraf te melden. Het verschil is niet
   academisch: als de melding van server/opzet/handeling.js in het log staat, zijn
   de rijen al weg. Hier gebeurt het oordeel op de drempel, met de oude lengte en
   de nieuwe allebei bekend en nog niets veranderd.

   DRIE DINGEN MOETEN WAAR BLIJVEN, en alle drie kunnen ze stil sneuvelen:

     1 HIJ WEIGERT ECHT. Een poort die alleen meldt is geen poort. De toets die
       dat bewijst zet de modus op 'weigeren', doet een te grote hervulling en
       eist dat de OUDE collectie er nog staat. Zou hij alleen gooien nadat hij
       heeft toegekend, dan was de schade er al en zou deze toets dat zien.
     2 HIJ LAAT HET HUIS MET RUST. Buiten een verzoek -- de bewaarveger, een
       migratie, het inlezen van de seed -- hoort er geen budget te staan. Een
       begroting die het opstarten breekt is erger dan geen begroting.
     3 HIJ STAAT STANDAARD OP MELDEN. Zodra dat stilletjes 'weigeren' wordt,
       gaan er over 3706 routes dingen kapot waarvan niemand de catalogus heeft.
       Die stand hoort een BESLUIT te zijn, en een toets is wat hem een besluit
       maakt in plaats van een aanname.

   Draai los: node --test test/begroting.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const begroting = require('../server/opzet/begroting');
const handeling = require('../server/opzet/handeling');

/* Een nagemaakt verzoek eromheen, want de begroting doet buiten een verzoek
   niets. Dezelfde vorm als in test/handeling.test.js. */
function inVerzoek(werk, opties) {
  const regels = [];
  const luisteraars = {};
  const req = { id: 'corr-b', path: '/api/proef', method: 'POST' };
  const res = { on: (n, fn) => { (luisteraars[n] = luisteraars[n] || []).push(fn); } };
  const mw = handeling.middleware({ data: () => (opties && opties.data) || null, log: () => {} });
  let uit;
  mw(req, res, () => { uit = werk(regels); });
  for (const fn of luisteraars.finish || []) fn();
  return { uit, regels };
}
const logNaar = (regels) => (niveau, bericht, velden) => regels.push({ niveau, bericht, velden });

/* ---------- het oordeel, los van de Proxy ---------- */

test('groei en gelijk blijven zijn nooit een overschrijding', () => {
  assert.equal(begroting.beoordeel('x', 10, 5000, { grens: 10 }).oordeel, 'door');
  assert.equal(begroting.beoordeel('x', 10, 10, { grens: 10 }).oordeel, 'door');
  /* Groei is een ander probleem (opslag, niet verlies) en er een grens op zetten
     zou legitiem werk breken zonder dat er iets onherstelbaars tegenover staat. */
});

test('een krimp binnen de grens gaat door, erboven niet', () => {
  assert.equal(begroting.beoordeel('x', 100, 91, { grens: 10 }).oordeel, 'door');
  assert.equal(begroting.beoordeel('x', 100, 90, { grens: 10 }).oordeel, 'door', 'de grens hoort erbij');
  assert.equal(begroting.beoordeel('x', 100, 89, { grens: 10, modus: 'melden' }).oordeel, 'meld');
  assert.equal(begroting.beoordeel('x', 100, 89, { grens: 10, modus: 'weigeren' }).oordeel, 'weiger');
});

/* ---------- en dan de enige vraag die telt: houdt hij het tegen ---------- */

test('WEIGEREN: de oude collectie staat er NA de poging nog, onaangeroerd', () => {
  /* Dit is de bewering waar de hele laag op rust. Een fout waarin eerst wordt
     toegekend en daarna gegooid, ziet er in een log precies hetzelfde uit --
     en dan is de schade er wel. */
  const regels = [];
  const data = { medewerkers: new Array(4280).fill(0).map((_, i) => ({ id: i })) };
  const bewaakt = begroting.bewaak(data, { log: logNaar(regels), modus: 'weigeren' });
  inVerzoek(() => {
    assert.throws(
      () => { bewaakt.medewerkers = []; },
      (e) => e instanceof begroting.BegrotingOverschreden && e.krimp === 4280 && e.status === 409,
      'een hervulling van 4280 naar 0 hoort geweigerd te worden'
    );
  }, { data });
  assert.equal(data.medewerkers.length, 4280, 'DE RIJEN ZIJN WEG: hij gooide pas NA de toekenning');
  assert.equal(regels.filter(r => r.bericht === 'begroting: handeling geweigerd').length, 1);
}, { concurrency: false });

test('WEIGEREN: een krimp binnen de grens gaat gewoon door', () => {
  /* De grens staat er EXPLICIET bij. Zonder haar erfde deze toets de
     module-constante, en die hangt aan RTG_BEGROTING_KRIMP -- draai de suite in
     de meetstand van de krimpronde (0,5) en dan zakt hij, terwijl er niets mis
     is. Een toets die van betekenis verandert door een omgevingsvariabele,
     toetst niet wat zijn naam belooft. */
  const data = { boekingen: new Array(100).fill(0) };
  const bewaakt = begroting.bewaak(data, { log: () => {}, modus: 'weigeren', grens: 50 });
  inVerzoek(() => { bewaakt.boekingen = new Array(99).fill(0); }, { data });
  assert.equal(data.boekingen.length, 99, 'een normale handeling mag niet geraakt worden');
});

test('de fout draagt collectie, aantal en grens -- niet alleen "geweigerd"', () => {
  const data = { leden: new Array(50).fill(0) };
  const bewaakt = begroting.bewaak(data, { log: () => {}, modus: 'weigeren', grens: 5 });
  inVerzoek(() => {
    try { bewaakt.leden = []; assert.fail('had moeten gooien'); }
    catch (e) {
      assert.equal(e.collectie, 'leden');
      assert.equal(e.krimp, 50);
      assert.equal(e.grens, 5);
      assert.match(e.message, /leden/);
      assert.match(e.message, /Splits hem op/, 'een weigering hoort te zeggen wat er dan wel kan');
    }
  }, { data });
});

/* ---------- de standaardstand, want die is een besluit ---------- */

test('STANDAARD staat hij op MELDEN, en dat hoort een besluit te zijn', () => {
  /* Zodra dit stilzwijgend 'weigeren' wordt, gaan er over 3706 routes dingen
     kapot waarvan de catalogus van legitieme grote krimpen nog niet bestaat.
     Deze toets is wat die stand een besluit maakt in plaats van een aanname. */
  assert.equal(begroting.MODUS, 'melden',
    'de begroting staat op weigeren zonder dat RTG_BEGROTING dat vroeg -- of deze toets draait met die vlag');
});

test('MELDEN: de handeling gaat door, maar niet stil', () => {
  const regels = [];
  const data = { oud: new Array(3000).fill(0) };
  const bewaakt = begroting.bewaak(data, { log: logNaar(regels) });
  inVerzoek(() => { bewaakt.oud = []; }, { data });
  assert.equal(data.oud.length, 0, 'in meldmodus hoort hij door te gaan');
  const meld = regels.filter(r => r.bericht === 'begroting: zou zijn geweigerd');
  assert.equal(meld.length, 1, 'en niet stil (LAT-regel 5)');
  assert.equal(meld[0].velden.rijen, 3000);
  assert.equal(meld[0].velden.id, 'corr-b', 'de melding draagt het correlatie-id');
});

/* ---------- hij laat het huis met rust ---------- */

test('BUITEN EEN VERZOEK gebeurt er niets: veger, migratie en seed blijven vrij', () => {
  /* Een begroting die het opstarten breekt is erger dan geen begroting. Dit is
     precies het geval dat een naïeve versie kapotmaakt. */
  const regels = [];
  const data = { alles: new Array(100000).fill(0) };
  const bewaakt = begroting.bewaak(data, { log: logNaar(regels) });
  assert.doesNotThrow(() => { bewaakt.alles = []; });
  assert.equal(data.alles.length, 0);
  assert.equal(regels.length, 0, 'buiten een verzoek hoort er ook geen melding te komen');
});

test('alles wat GEEN collectie-hervulling is, gaat ongemoeid door', () => {
  const data = { teller: 5, ding: { a: 1 }, lijst: [1, 2, 3] };
  const bewaakt = begroting.bewaak(data, { log: () => {} });
  inVerzoek(() => {
    bewaakt.teller = 9;
    bewaakt.ding = { a: 2 };
    bewaakt.nieuw = [1, 2, 3];
    bewaakt.lijst = null;
  }, { data });
  assert.equal(data.teller, 9);
  assert.deepEqual(data.ding, { a: 2 });
  assert.deepEqual(data.nieuw, [1, 2, 3]);
  assert.equal(data.lijst, null);
});

/* ---------- de wikkel zelf ---------- */

test('dezelfde data geeft dezelfde wikkel: db.data === db.data blijft kloppen', () => {
  const data = { a: [1] };
  const een = begroting.bewaak(data);
  const twee = begroting.bewaak(data);
  assert.equal(een, twee, 'twee wikkels om een ding geeft twee beelden van dezelfde waarheid');
  assert.equal(begroting.bewaak(een), een, 'een wikkel om een wikkel hoort er geen tweede te worden');
});

test('de wikkel verandert niets aan lezen, opsommen of serialiseren', () => {
  /* De opslaglaag doet Object.keys, spreidt en serialiseert db.data. Zou de
     Proxy daar iets aan veranderen, dan zou hij de opslag stukmaken op een
     manier die pas bij het herstarten opvalt. */
  const data = { a: [1, 2], b: { c: 3 }, d: 'tekst' };
  const bewaakt = begroting.bewaak(data);
  assert.deepEqual(Object.keys(bewaakt), ['a', 'b', 'd']);
  assert.deepEqual({ ...bewaakt }, data);
  assert.equal(JSON.stringify(bewaakt), JSON.stringify(data));
  assert.equal(bewaakt.a.length, 2);
  assert.equal(bewaakt.b.c, 3);
  assert.equal('a' in bewaakt, true);
});

test('de stand is af te lezen en telt wat er is gebeurd', () => {
  const voor = begroting.stand();
  assert.equal(typeof voor.gezien, 'number');
  assert.equal(voor.modus, begroting.MODUS);
  assert.equal(voor.grens, begroting.KRIMPGRENS);
  /* De lengte komt NIET meer uit KRIMPGRENS. Die kan uit de omgeving komen, en
     new Array(5.5) werpt "Invalid array length" -- zo zakte deze toets in de
     meetronde op 0,5 met een fout die niets met de begroting te maken had.
     De bewering hierboven (stand() meldt de module-constante) blijft staan; de
     PROEF hieronder zet zijn eigen grens. */
  const data = { x: new Array(20).fill(0) };
  const bewaakt = begroting.bewaak(data, { log: () => {}, grens: 10 });
  inVerzoek(() => { bewaakt.x = []; }, { data });
  const na = begroting.stand();
  assert.ok(na.overschreden > voor.overschreden, 'een overschrijding hoort geteld te worden');
  assert.ok(na.laatste.length > 0, 'en met naam terug te vinden -- anders is er geen catalogus te bouwen');
});

/* ---------- de aanname onder deze hele laag ---------- */

test('db.data loopt echt door de begroting heen', () => {
  /* Zonder deze bewering kan iemand de accessor in server/db/state.js weghalen
     en blijft alles hier groen terwijl er in de echte server niets meer bewaakt
     wordt -- de meter die groen staat omdat hij niets ziet. */
  const bron = require('fs').readFileSync(require('path').join(__dirname, '..', 'server/db/state.js'), 'utf8');
  assert.match(bron, /Object\.defineProperty\(db, 'data'/, 'db.data is geen accessor meer');
  assert.match(bron, /begroting'\)\.bewaak/, 'de accessor haalt de begroting er niet meer bij');
  const { db } = require('../server/db/state');
  const eigen = Object.getOwnPropertyDescriptor(db, 'data');
  assert.ok(eigen && typeof eigen.set === 'function', 'db.data heeft geen setter');
});
