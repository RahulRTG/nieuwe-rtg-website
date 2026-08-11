/* De automatiseringen (draaiboeken) op de RTMAIL-rail. Unit-test op het welkom-
   draaiboek met een nep-db, zodat we los kunnen bewijzen dat een nieuw lid een
   welkom in zijn eigen RTMAIL-postvak krijgt -- zonder echte namen (codenaam-privacy).
   node --test test/automatisering.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function maak(extra) {
  const db = { data: Object.assign({ facturen: [], btwAangiftes: [] }, extra || {}) };
  const rtmail = require('../server/kern/rtmail')({ db, save: () => {}, crypto });
  /* Een vaste klok: het btw-draaiboek rekent met het laatst AFGESLOTEN kwartaal,
     en zonder vaste klok bewijst deze toets op 1 april iets anders dan op
     30 juni. */
  const automatisering = require('../server/kern/automatisering')({ rtmail, db, nu: () => '2026-08-09T12:00:00.000Z' });
  return { rtmail, automatisering, db };
}
/* Een factuur zoals kern/facturatie/motor.js hem boekt. */
const rond = n => Math.round(n * 100) / 100;
function factuur(datum, verkoper, incl, btw) {
  const excl = rond(incl / (1 + btw / 100));
  return { id: 'f' + datum + incl, nummer: 'RTG-' + incl, datum, at: datum + 'T10:00:00.000Z',
    verkoper: { code: verkoper, naam: verkoper }, koper: { supplierCode: null, naam: 'K' },
    regels: [{ omschrijving: 'Post', aantal: 1, stuk: incl, btw, incl }],
    subtotaal: excl, btwBedrag: rond(incl - excl), totaal: incl };
}

test('welkom-draaiboek RTG: bericht in het eigen postvak, van de systeem-afzender', () => {
  const { rtmail, automatisering } = maak();
  const m = automatisering.welkomLid({ codename: 'ORCHIDEE', wereld: 'RTG' });
  assert.ok(m, 'er wordt een welkom bezorgd');
  assert.equal(m.van, 'rtg@rtmail');
  assert.equal(m.naar, 'orchidee@rtmail');
  assert.match(m.onderwerp, /Rahul Travel Group/);
  const vak = rtmail.postvak('orchidee');
  assert.equal(vak.length, 1);
  assert.equal(rtmail.ongelezen('orchidee'), 1);
});

test('welkom-draaiboek RTF: het merk staat in het bericht', () => {
  const { automatisering } = maak();
  const m = automatisering.welkomLid({ codename: 'lelie', wereld: 'RTF' });
  assert.match(m.onderwerp, /RTFoundation/);
});

test('codenaam-privacy: een meegegeven echte naam belandt niet in het bericht', () => {
  const { automatisering } = maak();
  // zelfs als er per ongeluk een naam wordt meegegeven, gebruikt het draaiboek
  // alleen de codenaam -- de echte naam blijft in de kluis, niet in RTMAIL.
  const m = automatisering.welkomLid({ codename: 'jasmijn', naam: 'Zeldzame Testnaam', wereld: 'RTG' });
  assert.doesNotMatch(m.tekst, /Zeldzame Testnaam/);
  assert.doesNotMatch(m.onderwerp, /Zeldzame Testnaam/);
});

test('zonder bruikbaar adres gebeurt er niets (geen crash)', () => {
  const { automatisering } = maak();
  assert.equal(automatisering.welkomLid({ codename: '', wereld: 'RTG' }), null);
  assert.equal(automatisering.welkomLid({}), null);
});

test('personeel-draaiboek: sollicitatie zet een seintje in het postvak van de zaak', () => {
  const { rtmail, automatisering } = maak();
  const m = automatisering.sollicitatieBinnen({ zaakCode: 'SAKURA', functie: 'gastvrouw', codename: 'orchidee' });
  assert.ok(m);
  assert.equal(m.naar, 'sakura@rtmail');
  assert.equal(m.van, 'rtg@rtmail');
  assert.match(m.onderwerp, /sollicitatie/i);
  assert.match(m.tekst, /gastvrouw/);
  assert.match(m.tekst, /orchidee/); // codenaam mag, echte naam niet
  assert.equal(rtmail.postvak('sakura').length, 1);
});

test('personeel-draaiboek: zonder zaakcode gebeurt er niets', () => {
  const { automatisering } = maak();
  assert.equal(automatisering.sollicitatieBinnen({ zaakCode: '', functie: 'x' }), null);
});

test('facturen-draaiboek: seintje naar verkoper en koper (lid op codenaam)', () => {
  const { rtmail, automatisering } = maak();
  const uit = automatisering.factuurGeboekt({ verkoperCode: 'SAKURA', verkoperNaam: 'Sakura Spa', koperCodenaam: 'orchidee', nummer: '2026-0007', totaal: 121 });
  assert.equal(uit.length, 2);
  assert.equal(rtmail.postvak('sakura').length, 1);
  assert.match(rtmail.postvak('sakura')[0].onderwerp, /2026-0007/);
  const koper = rtmail.postvak('orchidee');
  assert.equal(koper.length, 1);
  assert.match(koper[0].tekst, /Sakura Spa/);
  assert.match(koper[0].tekst, /121\.00/);
});

test('facturen-draaiboek: koper kan ook een andere zaak zijn', () => {
  const { rtmail, automatisering } = maak();
  automatisering.factuurGeboekt({ verkoperCode: 'GROOT', koperZaakCode: 'BLOEM', nummer: '9' });
  assert.equal(rtmail.postvak('bloem').length, 1);
});

test('inkoop-draaiboek: concept naar de groothandel + kopie bij de zaak, niets besteld', () => {
  const { rtmail, automatisering } = maak();
  const uit = automatisering.inkoopVoorstel({ zaakCode: 'SAKURA', groothandelCode: 'GROOT', regels: [{ aantal: 10, wat: 'handdoeken' }, { wat: 'zeep' }] });
  assert.equal(uit.length, 2);
  const bijGroot = rtmail.postvak('groot');
  assert.equal(bijGroot.length, 1);
  assert.match(bijGroot[0].tekst, /handdoeken/);
  assert.match(bijGroot[0].tekst, /concept/i);
  assert.equal(rtmail.postvak('sakura').length, 1); // de kopie
  assert.equal(automatisering.inkoopVoorstel({ zaakCode: 'SAKURA', groothandelCode: '' }), null);
});

test('overheid-draaiboek: de btw-herinnering rekent zijn eigen bedrag uit het factuurregister', () => {
  // 242 incl 21% in het tweede kwartaal: 42,00 btw. De klok staat op 9 augustus,
  // dus 2026K2 is het laatst afgesloten tijdvak.
  const { automatisering } = maak({ facturen: [factuur('2026-05-10', 'SAKURA', 242, 21)] });
  const m = automatisering.btwHerinnering({ zaakCode: 'SAKURA' });
  assert.ok(m, 'er is iets te herinneren');
  assert.equal(m.naar, 'sakura@rtmail');
  assert.match(m.tekst, /2026K2/, 'over het laatst afgesloten tijdvak');
  assert.match(m.tekst, /EUR 42\.00/, 'het bedrag komt uit het register en niet uit een parameter');
  assert.match(m.tekst, /Deadline: 2026-07-31/, 'een maand na afloop van het tijdvak, uitgerekend');
  assert.match(m.tekst, /indienen doe je zelf/i);
  assert.equal(automatisering.btwHerinnering({ zaakCode: '' }), null);

  /* EN DE AANROEPER STUURT NIET. Dit draaiboek NAM een bedrag, een periode en
     een deadline aan, en de route gaf ze door uit het verzoek -- dus wie de
     route aanriep bepaalde wat er in de herinnering stond, ongeacht wat het
     register zei. Wie zoiets terugbouwt hoort hier te zakken.

     Deze toets komt uit een mutatie die AFSLOEG: een `bedrag`-parameter
     terugzetten veranderde niets zolang niemand hem meestuurde. Een grendel die
     alleen dichtblijft omdat er niet aan wordt geduwd, is niet getoetst. */
  const gestuurd = automatisering.btwHerinnering({ zaakCode: 'SAKURA',
    bedrag: 99999, centen: 9999900, periode: '2099K1', deadline: '2099-01-01' });
  assert.match(gestuurd.tekst, /EUR 42\.00/, 'het bedrag blijft dat van het register');
  assert.match(gestuurd.tekst, /2026K2/, 'en de periode ook');
  assert.match(gestuurd.tekst, /Deadline: 2026-07-31/, 'en de deadline ook');
  assert.equal(/99999|2099/.test(gestuurd.tekst), false, 'niets uit de aanroep komt in het bericht');
});

test('geen herinnering als er niets te herinneren valt', () => {
  // niets gefactureerd
  assert.equal(maak().automatisering.btwHerinnering({ zaakCode: 'SAKURA' }), null);
  // wel gefactureerd, maar in een tijdvak dat nog loopt
  const loopt = maak({ facturen: [factuur('2026-08-01', 'SAKURA', 242, 21)] });
  assert.equal(loopt.automatisering.btwHerinnering({ zaakCode: 'SAKURA' }), null,
    'over een lopend tijdvak hoeft nog niets te worden ingediend');
  // wel gefactureerd, maar al ingediend
  const klaar = maak({ facturen: [factuur('2026-05-10', 'SAKURA', 242, 21)],
    btwAangiftes: [{ code: 'SAKURA', periode: '2026K2', stand: 'ingediend' }] });
  assert.equal(klaar.automatisering.btwHerinnering({ zaakCode: 'SAKURA' }), null,
    'wie zijn aangifte al deed krijgt geen herinnering; anders leert hij zijn post te negeren');
});
