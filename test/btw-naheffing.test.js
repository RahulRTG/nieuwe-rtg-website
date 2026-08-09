/* De naheffingsaanslag omzetbelasting (kern/overheid/naheffing.js +
   naheffing-daarna.js): het bedrag dat uit de aansluiting komt en niet uit een
   invulveld, de vier ogen bij vaststellen, de derde ogen bij bezwaar, en de
   boete die nooit vanzelf ontstaat.

   Met een verzetbare klok, want alles hier gaat over een AFGESLOTEN tijdvak:
   over een lopend kwartaal valt niets na te heffen omdat er nog niets te laat
   is. Draai: node --experimental-sqlite --test test/btw-naheffing.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakBtwAangifte } = require('../server/kern/fiscaal/btwaangifte');
const { maakBtwTelling } = require('../server/kern/fiscaal/btwtelling');
const maakToezicht = require('../server/kern/overheid/btwtoezicht');
const maakNaheffing = require('../server/kern/overheid/naheffing');

const rond = n => Math.round(n * 100) / 100;
function factuur({ nummer, datum, verkoper, regels }) {
  const uit = regels.map(([incl, btw]) => ({ omschrijving: 'Post', aantal: 1, stuk: incl, btw, incl }));
  const btwBedrag = rond(uit.reduce((s, r) => s + rond(r.incl - rond(r.incl / (1 + r.btw / 100))), 0));
  return { id: 'f' + nummer, nummer: 'RTG-' + nummer, datum, at: datum + 'T10:00:00.000Z',
    verkoper: { code: verkoper, naam: verkoper === 'SAL' ? 'Sal de Mar' : verkoper },
    koper: { key: null, supplierCode: null, naam: 'K', codenaam: null },
    regels: uit, subtotaal: rond(uit.reduce((s, r) => s + r.incl, 0) - btwBedrag),
    btwBedrag, totaal: rond(uit.reduce((s, r) => s + r.incl, 0)) };
}

function opzet(facturen, nuIso) {
  const db = { data: { facturen: facturen || [], btwAangiftes: [], rijkKvk: [], rijkNaheffingen: [] } };
  const klok = { nu: nuIso || '2026-08-09T12:00:00.000Z' };
  const nu = () => klok.nu;
  const seinen = [];
  const { telPerZaak } = maakBtwTelling({ db });
  const ctx = { db, save: () => {}, crypto, nu, seed: () => {}, telPerZaak,
    ref: p => 'RTG-' + p + '-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    schoon: (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120),
    notifySupplier: (code, note) => seinen.push({ code, ...note }) };
  Object.assign(ctx, maakToezicht(ctx));
  const nh = maakNaheffing(ctx);
  const aangifte = maakBtwAangifte({ db, save: () => {}, crypto, nu }).btwAangifte;
  return { db, klok, nh, aangifte, seinen };
}
const ZAAK = { code: 'SAL', name: 'Sal de Mar', settings: { land: 'NL' } };
const K2 = '2026K2';

// ------------------------------------------------------- 1. waar het bedrag vandaan komt
test('het bedrag komt uit de aansluiting en is niet te typen', () => {
  const { nh } = opzet([factuur({ nummer: 1, datum: '2026-04-10', verkoper: 'SAL', regels: [[242, 21]] })]);
  // niets aangegeven: de hele gefactureerde btw valt na te heffen
  const r = nh.naheffingMaak(K2, 'SAL', 'Inspecteur Jansen', { bedrag: 999999, naheffingCenten: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.naheffing.naheffingCenten, 4200, 'de 42 euro btw op de factuur, en niet de 999999 uit het verzoek');
  assert.equal(r.naheffing.aanleiding, 'niet_aangegeven');
  assert.equal(r.naheffing.status, 'concept');
  assert.match(r.naheffing.kenmerk, /^RTG-NH-/);
});

test('is er wel aangegeven, dan is alleen het VERSCHIL na te heffen', () => {
  const facturen = [factuur({ nummer: 11, datum: '2026-04-10', verkoper: 'SAL', regels: [[121, 21]] })];
  const { nh, aangifte } = opzet(facturen);
  const a = aangifte.maak(ZAAK, K2, 'Beheer').aangifte;   // 21,00 aangegeven
  aangifte.dienIn(a.id, 'Beheer', 'BD-123456');
  facturen.push(factuur({ nummer: 12, datum: '2026-05-05', verkoper: 'SAL', regels: [[242, 21]] })); // +42,00

  const r = nh.naheffingMaak(K2, 'SAL', 'Inspecteur Jansen');
  assert.equal(r.naheffing.naheffingCenten, 4200, 'geteld 6300 min aangegeven 2100');
  assert.equal(r.naheffing.aangegevenCenten, 2100);
  assert.equal(r.naheffing.aanleiding, 'wijkt_af');
});

test('waar niets mis is, valt niets na te heffen', () => {
  const { nh, aangifte } = opzet([factuur({ nummer: 21, datum: '2026-04-10', verkoper: 'SAL', regels: [[121, 21]] })]);
  const a = aangifte.maak(ZAAK, K2, 'Beheer').aangifte;
  aangifte.dienIn(a.id, 'Beheer', 'BD-123456');
  const r = nh.naheffingMaak(K2, 'SAL', 'Inspecteur Jansen');
  assert.equal(r.status, 409);
  assert.match(r.error, /niet te weinig aangegeven/);
});

test('over een lopend tijdvak is nog niets te laat', () => {
  const { nh } = opzet([factuur({ nummer: 31, datum: '2026-08-01', verkoper: 'SAL', regels: [[121, 21]] })]);
  const r = nh.naheffingMaak('2026K3', 'SAL', 'Inspecteur Jansen');
  assert.equal(r.status, 409);
  assert.match(r.error, /loopt de periode nog/);
});

test('geen twee naheffingen over hetzelfde tijdvak', () => {
  const { nh } = opzet([factuur({ nummer: 41, datum: '2026-04-10', verkoper: 'SAL', regels: [[242, 21]] })]);
  assert.equal(nh.naheffingMaak(K2, 'SAL', 'Jansen').ok, true);
  const tweede = nh.naheffingMaak(K2, 'SAL', 'Jansen');
  assert.equal(tweede.status, 409);
  assert.match(tweede.error, /loopt al een naheffing/);
});

// ---------------------------------------------------------------- 2. de boete
test('de boete ontstaat nooit vanzelf, en niet zonder grond', () => {
  const facturen = [factuur({ nummer: 51, datum: '2026-04-10', verkoper: 'SAL', regels: [[242, 21]] })];
  const { nh } = opzet(facturen);
  const kaal = nh.naheffingMaak(K2, 'SAL', 'Jansen');
  assert.equal(kaal.naheffing.boetePct, 0, 'zonder dat iemand er om vroeg: geen boete');
  assert.equal(kaal.naheffing.boeteCenten, 0);
  assert.equal(kaal.naheffing.boeteGrond, null);
  nh.naheffingIntrek(kaal.naheffing.id, 'Jansen', 'opnieuw opmaken met boete');

  const zonderGrond = nh.naheffingMaak(K2, 'SAL', 'Jansen', { boetePct: 10 });
  assert.equal(zonderGrond.status, 400);
  assert.match(zonderGrond.error, /zonder grond bestaat niet/);

  const met = nh.naheffingMaak(K2, 'SAL', 'Jansen', { boetePct: 10, boeteGrond: 'tweede keer niet aangegeven' });
  assert.equal(met.naheffing.boeteCenten, 420, '10% van 4200');
  assert.equal(met.naheffing.totaalCenten, 4620);
  assert.match(met.naheffing.boeteGrond, /tweede keer/);
});

// ------------------------------------------------------------- 3. de vier ogen
test('wie de naheffing opmaakt, stelt hem niet vast', () => {
  const { nh } = opzet([factuur({ nummer: 61, datum: '2026-04-10', verkoper: 'SAL', regels: [[242, 21]] })]);
  const n = nh.naheffingMaak(K2, 'SAL', 'Inspecteur Jansen').naheffing;

  const zelf = nh.naheffingStelVast(n.id, 'Inspecteur Jansen');
  assert.equal(zelf.status, 409);
  assert.match(zelf.error, /ANDERE inspecteur/);
  // ook niet met een andere schrijfwijze van dezelfde naam
  assert.equal(nh.naheffingStelVast(n.id, '  inspecteur jansen ').status, 409, 'hoofdletters zijn geen tweede persoon');
  assert.equal(nh.naheffingStelVast(n.id, 'X').status, 400, 'en een krabbel is geen naam');

  const ander = nh.naheffingStelVast(n.id, 'Inspecteur De Vries');
  assert.equal(ander.ok, true);
  assert.equal(ander.naheffing.status, 'vastgesteld');
  assert.equal(ander.naheffing.vastgesteldDoor, 'Inspecteur De Vries');
  assert.ok(ander.naheffing.vervaltOp, 'er staat een vervaldatum op');
  assert.match(ander.let, /niets geind/, 'en er is niets geind');
  assert.equal(nh.naheffingStelVast(n.id, 'Inspecteur De Vries').status, 409, 'niet twee keer');
});

test('de zaak hoort er pas van bij het vaststellen, niet bij het opmaken', () => {
  const { nh, seinen } = opzet([factuur({ nummer: 71, datum: '2026-04-10', verkoper: 'SAL', regels: [[242, 21]] })]);
  const n = nh.naheffingMaak(K2, 'SAL', 'Jansen').naheffing;
  assert.deepEqual(seinen, [], 'een concept is een gedachte van het kantoor');
  assert.deepEqual(nh.naheffingVanZaak('SAL').naheffingen, [], 'en staat niet bij de zaak');

  nh.naheffingStelVast(n.id, 'De Vries');
  assert.equal(seinen.length, 1, 'nu wel');
  assert.equal(seinen[0].code, 'SAL');
  assert.match(seinen[0].body, /€ 42,00/);
  assert.equal(nh.naheffingVanZaak('SAL').naheffingen.length, 1);
});

test('vaststellen weigert op cijfers die intussen zijn veranderd', () => {
  const facturen = [factuur({ nummer: 81, datum: '2026-04-10', verkoper: 'SAL', regels: [[242, 21]] })];
  const { nh, aangifte } = opzet(facturen);
  const n = nh.naheffingMaak(K2, 'SAL', 'Jansen').naheffing;

  // de zaak geeft alsnog aan voordat de tweede ogen tekenen
  const a = aangifte.maak(ZAAK, K2, 'Beheer').aangifte;
  aangifte.dienIn(a.id, 'Beheer', 'BD-123456');

  const r = nh.naheffingStelVast(n.id, 'De Vries');
  assert.equal(r.status, 409);
  assert.match(r.error, /veranderd sinds het opmaken/);
  assert.equal(nh.naheffingenLijst({}).naheffingen[0].status, 'concept', 'en hij blijft een concept');
});

/* DEZE TOETS KOMT UIT EEN MUTATIE DIE AFSLOEG. Er staan TWEE grendels op
   vaststellen: er valt niets meer na te heffen (de aangifte kwam alsnog), en het
   BEDRAG is veranderd terwijl er nog wel iets na te heffen valt. De toets
   hierboven raakte alleen de eerste; de tweede eruit slopen veranderde niets aan
   de uitslag, en dan bewaakt hij niets. Dit is het geval waar hij wel over gaat:
   er komt een factuur bij, dus het bedrag groeit. */
test('vaststellen weigert ook als het BEDRAG intussen is gegroeid', () => {
  const facturen = [factuur({ nummer: 85, datum: '2026-04-10', verkoper: 'SAL', regels: [[242, 21]] })];
  const { nh } = opzet(facturen);
  const n = nh.naheffingMaak(K2, 'SAL', 'Jansen').naheffing;
  assert.equal(n.naheffingCenten, 4200);

  facturen.push(factuur({ nummer: 86, datum: '2026-05-05', verkoper: 'SAL', regels: [[121, 21]] }));
  const r = nh.naheffingStelVast(n.id, 'De Vries');
  assert.equal(r.status, 409);
  assert.match(r.error, /nu € 63,00, in de naheffing € 42,00/,
    'de weigering noemt allebei de bedragen, anders weet niemand wat er veranderde');
  assert.equal(nh.naheffingenLijst({}).naheffingen[0].status, 'concept');
});

test('een vastgestelde naheffing trek je niet stilletjes in', () => {
  const { nh } = opzet([factuur({ nummer: 91, datum: '2026-04-10', verkoper: 'SAL', regels: [[242, 21]] })]);
  const n = nh.naheffingMaak(K2, 'SAL', 'Jansen').naheffing;
  assert.equal(nh.naheffingIntrek(n.id, 'Jansen', '').status, 400, 'intrekken zonder reden niet');
  nh.naheffingStelVast(n.id, 'De Vries');
  const r = nh.naheffingIntrek(n.id, 'Jansen', 'toch maar niet');
  assert.equal(r.status, 409);
  assert.match(r.error, /via bezwaar/);
});

// ----------------------------------------------------------- 4. bezwaar
test('de zaak maakt bezwaar, en een DERDE beslist erop', () => {
  const { nh, seinen } = opzet([factuur({ nummer: 101, datum: '2026-04-10', verkoper: 'SAL', regels: [[242, 21]] })]);
  const n = nh.naheffingMaak(K2, 'SAL', 'Jansen').naheffing;
  nh.naheffingStelVast(n.id, 'De Vries');

  assert.equal(nh.naheffingBezwaar('ANDERS', n.id, 'niet van mij').status, 404,
    'een andere zaak kent deze naheffing niet');
  assert.equal(nh.naheffingBezwaar('SAL', n.id, 'nee').status, 400, 'bezwaar draagt een reden');
  const bz = nh.naheffingBezwaar('SAL', n.id, 'De facturen van april zijn dubbel geboekt.');
  assert.equal(bz.ok, true);
  assert.equal(bz.naheffing.status, 'bezwaar');
  assert.equal(nh.naheffingBezwaar('SAL', n.id, 'nogmaals dan').status, 409, 'niet twee keer');

  // de opsteller en de vaststeller mogen er allebei niet over beslissen
  for (const wie of ['Jansen', 'De Vries', 'de vries']) {
    const r = nh.naheffingBeslisBezwaar(wie, n.id, { toewijzen: true, motivering: 'akkoord' });
    assert.equal(r.status, 409, wie + ' beslist niet op zijn eigen besluit');
    assert.match(r.error, /geen heroverweging/);
  }
  assert.equal(nh.naheffingBeslisBezwaar('Mevrouw Bakker', n.id, { toewijzen: true }).status, 400,
    'een besluit op bezwaar draagt een motivering');

  const besluit = nh.naheffingBeslisBezwaar('Mevrouw Bakker', n.id,
    { toewijzen: true, motivering: 'De dubbele boeking is nagelopen en klopt; de naheffing vervalt.' });
  assert.equal(besluit.ok, true);
  assert.equal(besluit.naheffing.status, 'vernietigd');
  assert.equal(besluit.naheffing.naheffingCenten, 0, 'een toegewezen bezwaar laat niets staan');
  assert.equal(besluit.naheffing.totaalCenten, 0);
  assert.equal(besluit.naheffing.bezwaar.besluit, 'toegewezen');
  assert.equal(seinen.length, 2, 'de zaak hoort van het besluit');
  assert.match(seinen[1].title, /bezwaar/i);
});

test('een afgewezen bezwaar laat de naheffing staan, met motivering', () => {
  const { nh } = opzet([factuur({ nummer: 111, datum: '2026-04-10', verkoper: 'SAL', regels: [[242, 21]] })]);
  const n = nh.naheffingMaak(K2, 'SAL', 'Jansen').naheffing;
  nh.naheffingStelVast(n.id, 'De Vries');
  nh.naheffingBezwaar('SAL', n.id, 'ik ben het er niet mee eens');
  const r = nh.naheffingBeslisBezwaar('Bakker', n.id, { toewijzen: false, motivering: 'De facturen staan er gewoon.' });
  assert.equal(r.naheffing.status, 'gehandhaafd');
  assert.equal(r.naheffing.naheffingCenten, 4200, 'het bedrag blijft staan');
  assert.equal(r.naheffing.bezwaar.besluit, 'afgewezen');
  assert.match(r.naheffing.bezwaar.motivering, /gewoon/);
  // en na een afgewezen bezwaar staat er geen tweede bezwaar meer open
  assert.equal(nh.naheffingBezwaar('SAL', n.id, 'toch nog een keer').status, 409);
});

test('tegen een concept staat geen bezwaar open, want het is geen besluit', () => {
  const { nh } = opzet([factuur({ nummer: 121, datum: '2026-04-10', verkoper: 'SAL', regels: [[242, 21]] })]);
  const n = nh.naheffingMaak(K2, 'SAL', 'Jansen').naheffing;
  const r = nh.naheffingBezwaar('SAL', n.id, 'dit deugt niet');
  assert.equal(r.status, 409);
  assert.match(r.error, /concept/);
});

// ------------------------------------------------------------- 5. teruglezen
test('de lijst filtert, en telt de openstaande bezwaren', () => {
  const { nh } = opzet([
    factuur({ nummer: 131, datum: '2026-04-10', verkoper: 'SAL', regels: [[242, 21]] }),
    factuur({ nummer: 132, datum: '2026-04-11', verkoper: 'STIL', regels: [[121, 21]] })
  ]);
  const a = nh.naheffingMaak(K2, 'SAL', 'Jansen').naheffing;
  nh.naheffingStelVast(a.id, 'De Vries');
  nh.naheffingBezwaar('SAL', a.id, 'hier klopt niets van');
  nh.naheffingMaak(K2, 'STIL', 'Jansen');

  assert.equal(nh.naheffingenLijst({}).naheffingen.length, 2);
  assert.equal(nh.naheffingenLijst({}).openBezwaren, 1);
  assert.equal(nh.naheffingenLijst({ status: 'concept' }).naheffingen.length, 1);
  assert.equal(nh.naheffingenLijst({ status: 'bezwaar' }).naheffingen[0].code, 'SAL');
  assert.equal(nh.naheffingenLijst({ periode: '2026K1' }).naheffingen.length, 0);
  // de zaak ziet alleen zijn eigen, en geen concepten van een ander
  assert.equal(nh.naheffingVanZaak('STIL').naheffingen.length, 0, 'een concept is nog geen besluit');
  assert.equal(nh.naheffingVanZaak('SAL').naheffingen.length, 1);
});
