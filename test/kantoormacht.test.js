/* DE KANTOORMACHT-METER (scripts/kantoormacht.js).

   KANTOORMACHT.md par. 26 zet deze meter als blok 0: "eerst, altijd". Par. 29
   zegt waarom -- de getallen in dat document zijn lexicaal geteld en dragen de
   graad `vermoed`, en een richtingsdocument dat in stilte veroudert wordt
   geciteerd alsof het vandaag beschrijft.

   Deze toets bewaakt niet of 385 het JUISTE getal is; dat is een meting en die
   beweegt. Hij bewaakt de vier dingen die machinaal te handhaven zijn en die
   allemaal een fout afvangen die de meter waardeloos zou maken zonder dat
   iemand het ziet:

     1 de meter BESLIST niets -- niets in server/ importeert hem. Zou dat wel
       gebeuren, dan is hij de 22e capabilitylijst uit OS.md in plaats van de
       laag eroverheen. Zelfde grens als test/gezagsnoemer.test.js.
     2 de harde as blijft HARD -- `deurEistMens` telt alleen bewakers die
       werkelijk een identiteit eisen. Een rol is geen mens, en `officeAuth`
       hoort daar dus nooit in te sluipen: dat is precies het gat dat gemeten
       wordt, en wie hem toevoegt meet het gat weg in plaats van te dichten.
     3 de graden staan ERBIJ -- een getal zonder graad wordt doorverteld als
       zekerheid. `anoniemUitvoerbaar` is lexicaal en dus `vermoed`.
     4 `ongemeten` is een eigen uitslag en nooit een 0. Een nul beweert "gemeten
       en niet aanwezig"; dat is een andere bewering dan "hier is niet gekeken",
       en die twee door elkaar halen is hoe een scorecard geruststellend wordt
       zonder iets te weten (zelfde regel als gevolg.js: `geen-effect-gemeten`
       tegenover `onbekend`). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { meet, EIST_MENS, KANTOORPAD } = require('../scripts/kantoormacht');

const WORTEL = path.join(__dirname, '..');

test('1. de meter beslist niets: niets in server/ importeert hem', () => {
  let treffers = '';
  try {
    treffers = execFileSync('grep',
      ['-rl', 'kantoormacht', path.join(WORTEL, 'server'), '--include=*.js'],
      { encoding: 'utf8' }).trim();
  } catch (e) { treffers = ''; }  // grep geeft 1 bij nul treffers
  assert.equal(treffers, '',
    'server/ importeert de kantoormacht-meter: ' + treffers +
    ' -- dan is hij een beslisser in plaats van een meetlaag, en hoort hij niet in scripts/');
});

test('2. de harde as blijft hard: een gedeelde rol telt nooit als een mens', () => {
  assert.ok(!EIST_MENS.has('officeAuth'),
    'officeAuth staat in EIST_MENS -- maar de gedeelde kantoorcode maakt een sessie ' +
    'zonder lidKey (kern/kantoor/kluispoort.js). Wie hem meetelt, meet het gat weg.');
  assert.ok(!EIST_MENS.has('balieAuth') && !EIST_MENS.has('techAuth'),
    'een bewaker die alleen een ROL controleert hoort niet in EIST_MENS: een rol is geen mens');
  assert.ok(EIST_MENS.has('kluisAuth') && EIST_MENS.has('boardroomAuth'),
    'de twee poorten die aantoonbaar een identiteit eisen horen er wel in');
});

test('3. elke gemeten as draagt een graad, en de lexicale assen zijn `vermoed`', () => {
  const u = meet();
  for (const as of Object.keys(u.gemeten)) {
    if (as === 'bestanden') continue;
    assert.ok(u.graden[as], 'as zonder graad: ' + as + ' -- een getal zonder graad wordt doorverteld als zekerheid');
  }
  assert.equal(u.graden.deurEistMens, 'gemeten', 'de deur-as komt uit de router en is hard');
  assert.equal(u.graden.anoniemUitvoerbaar, 'vermoed',
    'anoniemUitvoerbaar is lexicaal op bestandsniveau en mag nooit `gemeten` heten');
});

test('4. ongemeten is een eigen uitslag met een reden, nooit een 0', () => {
  const u = meet();
  assert.ok(Object.keys(u.ongemeten).length > 0, 'er is niets als ongemeten gemarkeerd');
  for (const [k, reden] of Object.entries(u.ongemeten)) {
    assert.equal(typeof reden, 'string', k + ' heeft geen reden');
    assert.ok(reden.length > 20, k + ': een ongemeten as hoort te zeggen WAAROM er niet gekeken is');
    assert.ok(!(k in u.gemeten), k + ' staat zowel in gemeten als in ongemeten');
  }
});

test('5. de meter kijkt naar de kantoordeur en niet naar het hele huis', () => {
  assert.ok(KANTOORPAD.test('/api/office/state'));
  assert.ok(KANTOORPAD.test('/api/boardroom/bank'));
  assert.ok(!KANTOORPAD.test('/api/member/profiel'),
    'een ledenroute is geen kantoorroute');
  const u = meet();
  assert.ok(u.gemeten.routes > 0, 'geen enkele kantoorroute gevonden -- dan meet dit script niets');
  assert.equal(u.gemeten.deurEistMens + u.gemeten.deurGedeeld, u.gemeten.routes,
    'elke route valt in precies een van beide bakken; anders telt er iets dubbel of valt er iets weg');
});

test('6. het vastgelegde register loopt niet achter op de meter', () => {
  const doel = path.join(WORTEL, 'KANTOORMACHT.json');
  assert.ok(fs.existsSync(doel), 'KANTOORMACHT.json ontbreekt -- draai npm run kantoormacht:vast');
  const oud = JSON.parse(fs.readFileSync(doel, 'utf8'));
  const nu = meet();
  assert.ok(nu.gemeten.anoniemUitvoerbaar <= oud.gemeten.anoniemUitvoerbaar,
    'anoniem uitvoerbare kantoorroutes gestegen van ' + oud.gemeten.anoniemUitvoerbaar +
    ' naar ' + nu.gemeten.anoniemUitvoerbaar + ' -- deze teller mag alleen dalen (PROOF.md normtand)');
});
