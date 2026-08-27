/* Het btw-toezicht van het Belastingkantoor (kern/overheid/btwtoezicht.js): de
   aansluiting tussen het factuurregister en wat er is aangegeven, de vier standen
   die daaruit volgen, en de signalen die alleen over een AFGESLOTEN periode gaan.

   Waarom dit los van test/belastingkantoor.test.js staat: die draait op een echte
   server, en daar zijn alle facturen van vandaag. De vraag die ertoe doet gaat
   juist over een kwartaal dat voorbij is -- wie heeft niet ingediend, en wiens
   aangifte is achterhaald door facturen die er daarna bij kwamen. Met een
   verzetbare klok is dat na te lopen; met de kalender niet.
   Draai: node --test test/btw-toezicht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakBtwAangifte } = require('../server/kern/fiscaal/btwaangifte');
const { maakBtwTelling } = require('../server/kern/fiscaal/btwtelling');
const maakToezicht = require('../server/kern/overheid/btwtoezicht');
const maakCmdOpslag = require('../server/kern/command/opslag');

/* Een factuur zoals kern/facturatie/motor.js hem boekt. Zelfde helper als in
   test/btw-aangifte.test.js; hij staat hier opnieuw omdat een toets die zijn
   invoer uit een andere toets haalt, samen met die andere omvalt. */
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
  const db = { data: { facturen: facturen || [], btwAangiftes: [], rijkKvk: [] } };
  const klok = { nu: nuIso || '2026-08-09T12:00:00.000Z' };
  const nu = () => klok.nu;
  const { telPerZaak } = maakBtwTelling({ db });
  const toezicht = maakToezicht({ db, opslag: maakCmdOpslag({ db }), nu, seed: () => {}, telPerZaak });
  const aangifte = maakBtwAangifte({ db, save: () => {}, crypto, nu }).btwAangifte;
  return { db, klok, toezicht, aangifte };
}
const ZAAK = { code: 'SAL', name: 'Sal de Mar', settings: { land: 'NL' } };
const K2 = '2026K2'; // 1 april t/m 30 juni: op 9 augustus voorbij

// ----------------------------------------------------------- 1. de aansluiting
test('inspecteur en aangever tellen hetzelfde -- op de cent, uit dezelfde routine', () => {
  const { toezicht, aangifte } = opzet([
    factuur({ nummer: 1, datum: '2026-04-10', verkoper: 'SAL', regels: [[121, 21], [109, 9]] }),
    factuur({ nummer: 2, datum: '2026-06-30', verkoper: 'SAL', regels: [[242, 21]] })
  ]);
  const eigen = aangifte.maak(ZAAK, K2, 'Beheer').aangifte;
  const r = toezicht.bdBtwAansluiting(K2);
  const z = r.zaken.find(x => x.code === 'SAL');
  assert.equal(z.geteldBtwCenten, eigen.verschuldigdCenten,
    'wat de inspecteur telt is wat de aangifte verschuldigd noemt');
  assert.equal(z.grondslagCenten, eigen.tarieven.reduce((s, t) => s + t.omzetCenten, 0),
    'en de grondslag ook');
});

test('vier standen, en elk betekent iets anders', () => {
  const facturen = [factuur({ nummer: 11, datum: '2026-04-10', verkoper: 'SAL', regels: [[121, 21]] })];
  const { toezicht, aangifte } = opzet(facturen);

  // 1. omzet, geen aangifte
  let z = toezicht.bdBtwAansluiting(K2).zaken.find(x => x.code === 'SAL');
  assert.equal(z.stand, 'niet_aangegeven');
  assert.equal(z.aangegevenBtwCenten, null);
  assert.equal(z.geteldBtwCenten, 2100);

  // 2. wel een concept, maar niet ingediend
  const a = aangifte.maak(ZAAK, K2, 'Beheer').aangifte;
  z = toezicht.bdBtwAansluiting(K2).zaken.find(x => x.code === 'SAL');
  assert.equal(z.stand, 'alleen_concept', 'een concept is geen aangifte');

  // 3. ingediend en kloppend
  aangifte.dienIn(a.id, 'Beheer', 'BD-123456');
  z = toezicht.bdBtwAansluiting(K2).zaken.find(x => x.code === 'SAL');
  assert.equal(z.stand, 'sluit_aan');
  assert.equal(z.verschilCenten, 0);
  assert.equal(z.kenmerk, 'BD-123456', 'het kenmerk staat bij de inspecteur');

  // 4. er komt na het indienen een factuur bij: de aangifte is achterhaald
  facturen.push(factuur({ nummer: 12, datum: '2026-05-05', verkoper: 'SAL', regels: [[242, 21]] }));
  z = toezicht.bdBtwAansluiting(K2).zaken.find(x => x.code === 'SAL');
  assert.equal(z.stand, 'wijkt_af');
  assert.equal(z.verschilCenten, -4200, 'er is 42 euro meer gefactureerd dan aangegeven');
});

test('een zaak die niets factureerde en niets indiende, is geen bevinding', () => {
  const { toezicht } = opzet([]);
  const r = toezicht.bdBtwAansluiting(K2);
  assert.deepEqual(r.zaken, [], 'geen facturen, geen zaken in de lijst');
  assert.equal(r.zonderAangifte, 0);
});

test('de laatst INGEDIENDE telt, ook als er een correctie overheen ging', () => {
  const facturen = [factuur({ nummer: 21, datum: '2026-04-10', verkoper: 'SAL', regels: [[121, 21]] })];
  const { toezicht, aangifte } = opzet(facturen);
  const a = aangifte.maak(ZAAK, K2, 'Beheer').aangifte;
  aangifte.dienIn(a.id, 'Beheer', 'BD-111111');

  facturen.push(factuur({ nummer: 22, datum: '2026-05-05', verkoper: 'SAL', regels: [[242, 21]] }));
  const c = aangifte.maak(ZAAK, K2, 'Beheer', { correctie: true }).aangifte;
  let z = toezicht.bdBtwAansluiting(K2).zaken.find(x => x.code === 'SAL');
  assert.equal(z.stand, 'wijkt_af', 'zolang de correctie een concept is, telt de oude aangifte');
  assert.equal(z.kenmerk, 'BD-111111');

  aangifte.dienIn(c.id, 'Beheer', 'BD-222222');
  z = toezicht.bdBtwAansluiting(K2).zaken.find(x => x.code === 'SAL');
  assert.equal(z.stand, 'sluit_aan', 'na het indienen van de correctie sluit het weer aan');
  assert.equal(z.kenmerk, 'BD-222222', 'en de correctie is wat er staat');
  assert.equal(z.soort, 'correctie');
});

/* DEZE TOETS KOMT UIT EEN MUTATIE DIE AFSLOEG. "De laatst ingediende telt" werd
   hierboven getoetst via de aangiftelaag, en die zet zijn nieuwste vooraan in de
   lijst EN geeft op een vaste klok twee keer hetzelfde tijdstempel. Daardoor gaf
   de volgorde in de array altijd al het goede antwoord en kon de regel zelf niet
   zakken: hem eruit slopen veranderde niets aan de uitslag.

   Hier staan de twee dus met de HAND in de opslag, in een volgorde die hun
   tijdstempels tegenspreekt. Dan telt alleen nog wat de regel zegt. Dat is geen
   gekunsteld geval: zodra de opslag op Postgres draait of ergens een sort()
   bijkomt, is de volgorde in die lijst niet meer degene waar iemand op rekende. */
test('bij tegenstrijdige volgorde wint het tijdstempel, niet de plek in de lijst', () => {
  const { db, toezicht } = opzet([factuur({ nummer: 26, datum: '2026-04-10', verkoper: 'SAL', regels: [[121, 21]] })]);
  const basis = { code: 'SAL', zaak: 'Sal de Mar', periode: K2, stand: 'ingediend',
    van: '2026-04-01', tot: '2026-06-30', verschuldigdCenten: 2100, voorbelastingCenten: 0, saldoCenten: 2100 };
  db.data.btwAangiftes = [
    // vooraan in de lijst, maar het OUDST ingediend
    { ...basis, id: 'btw_oud', soort: 'aangifte', kenmerk: 'BD-OUD', ingediendOp: '2026-07-01T09:00:00.000Z' },
    { ...basis, id: 'btw_nieuw', soort: 'correctie', kenmerk: 'BD-NIEUW', ingediendOp: '2026-07-20T09:00:00.000Z' }
  ];
  const z = toezicht.bdBtwAansluiting(K2).zaken.find(x => x.code === 'SAL');
  assert.equal(z.kenmerk, 'BD-NIEUW', 'de laatst INGEDIENDE telt, ook al staat hij achteraan');
  assert.equal(z.soort, 'correctie');
});

// -------------------------------------------------------------- 2. de signalen
test('signalen komen alleen over een afgesloten periode', () => {
  const facturen = [factuur({ nummer: 31, datum: '2026-08-01', verkoper: 'SAL', regels: [[121, 21]] })];
  const { toezicht } = opzet(facturen); // klok 9 augustus: K3 loopt nog

  const lopend = toezicht.bdBtwAansluiting('2026K3');
  assert.equal(lopend.periodeLoopt, true);
  assert.equal(lopend.zaken.find(x => x.code === 'SAL').stand, 'niet_aangegeven',
    'de stand staat er wel, want de inspecteur mag kijken');
  assert.deepEqual(toezicht.btwSignalen('2026K3'), [],
    'maar over een lopend kwartaal is "niets ingediend" geen bevinding: dat MAG nog niet');
});

test('over een afgesloten periode wijst het toezicht drie dingen aan', () => {
  const facturen = [
    factuur({ nummer: 41, datum: '2026-04-10', verkoper: 'STIL', regels: [[121, 21]] }),   // dient niets in
    factuur({ nummer: 42, datum: '2026-04-11', verkoper: 'SAL', regels: [[242, 21]] }),    // dient in, raakt achterhaald
    factuur({ nummer: 43, datum: '2026-04-12', verkoper: 'CONC', regels: [[109, 9]] })     // blijft in een concept hangen
  ];
  const { toezicht, aangifte } = opzet(facturen);

  const a = aangifte.maak(ZAAK, K2, 'Beheer').aangifte;
  aangifte.dienIn(a.id, 'Beheer', 'BD-123456');
  aangifte.maak({ code: 'CONC', name: 'Concept BV', settings: { land: 'NL' } }, K2, 'Beheer');
  facturen.push(factuur({ nummer: 44, datum: '2026-05-05', verkoper: 'SAL', regels: [[121, 21]] }));

  const sig = toezicht.btwSignalen(K2);
  assert.equal(sig.length, 3, 'drie bevindingen, een per zaak');
  assert.ok(sig.every(s => s.soort === 'btw'));
  const per = Object.fromEntries(sig.map(s => [s.ref, s.tekst]));
  assert.match(per.STIL, /geen aangifte ingediend/);
  assert.equal(per.SAL, 'De aangifte over 2026K2 (€ 42,00) wijkt € 21,00 af van het factuurregister ' +
    '(€ 63,00); de facturen zijn na het indienen veranderd.',
    'het signaal noemt aangegeven, verschil en geteld -- alle drie, met een komma zoals het hoort');
  assert.match(per.CONC, /nooit ingediend/);
});

test('een onzinnige periode wordt geweigerd en levert geen signalen', () => {
  const { toezicht } = opzet([]);
  assert.equal(toezicht.bdBtwAansluiting('2026K9').status, 400);
  assert.equal(toezicht.bdBtwAansluiting('').status, 400);
  assert.deepEqual(toezicht.btwSignalen('rommel'), []);
});

test('de standaardperiode is de laatst AFGESLOTEN, nooit de lopende', () => {
  for (const [nu, verwacht] of [['2026-08-09T12:00:00.000Z', '2026K2'],
    ['2026-01-02T12:00:00.000Z', '2025K4'], ['2026-04-01T00:30:00.000Z', '2026K1'],
    ['2026-12-31T23:00:00.000Z', '2026K3']]) {
    const { toezicht } = opzet([], nu);
    assert.equal(toezicht.vorigeBtwPeriode(), verwacht, 'op ' + nu.slice(0, 10));
    assert.equal(toezicht.bdBtwAansluiting(toezicht.vorigeBtwPeriode()).periodeLoopt, false,
      'de standaardperiode is per definitie voorbij');
  }
});
