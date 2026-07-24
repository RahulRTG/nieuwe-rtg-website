/* De automatiseringen (draaiboeken) op de RTMAIL-rail. Unit-test op het welkom-
   draaiboek met een nep-db, zodat we los kunnen bewijzen dat een nieuw lid een
   welkom in zijn eigen RTMAIL-postvak krijgt -- zonder echte namen (codenaam-privacy).
   node --test test/automatisering.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function maak() {
  const db = { data: {} };
  const rtmail = require('../server/kern/rtmail')({ db, save: () => {}, crypto });
  const automatisering = require('../server/kern/automatisering')({ rtmail });
  return { rtmail, automatisering };
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

test('overheid-draaiboek: btw-herinnering met de voorbereide cijfers; indienen blijft een mens', () => {
  const { rtmail, automatisering } = maak();
  const m = automatisering.btwHerinnering({ zaakCode: 'SAKURA', periode: 'Q1 2026', bedrag: 842.5, deadline: '2026-04-30' });
  assert.ok(m);
  assert.equal(m.naar, 'sakura@rtmail');
  assert.match(m.tekst, /842\.50/);
  assert.match(m.tekst, /2026-04-30/);
  assert.match(m.tekst, /indienen doe je zelf/i);
  assert.equal(automatisering.btwHerinnering({ zaakCode: '' }), null);
});
