/* TWEE INTERPRETATIERAILS VERGELIJKEN (scripts/railvergelijk.js, fase 12).

   Het oordeel per zin is een PURE functie, en dat is met opzet: de echte
   vergelijking hangt af van welke rails er toevallig draaien, en vandaag draait
   er maar een. Een toets op de LIJSTEN zou hier dus niets kunnen zien zakken --
   dezelfde fout als bij `soortVerschil` in scripts/menselijkeuitvoering.js, waar
   elke mutatie een no-op was omdat de echte data het geval niet bevatte.

   Op de functie is het wel te beproeven, met invoer die elk geval afdwingt.

   DE VOLGORDE VAN DE OORDELEN IS ZELF EEN BEWERING: een schending van het
   CONTRACT weegt zwaarder dan een verschil met de andere rail. Die volgorde
   wordt hieronder vastgelegd en niet aangenomen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { oordeel, zelfdeContract } = require('../scripts/railvergelijk');

/* Een rij zoals MENSTAALPROEF.json hem schrijft, zo klein mogelijk. */
const rij = (kwam, koos, extra) => Object.assign({
  id: 'x', input: 'x', kwam, uitslag: 'binnen', uit: [],
  fasen: { CAPABILITY_SELECTED: koos ? 'PASS' : 'OVERGESLAGEN' }
}, extra || {});

test('1. gelijk blijft gelijk, en voorzichtiger is geen schending', () => {
  /* MUTATIE: laat LAGER hetzelfde soort teruggeven als HOGER. */
  assert.equal(oordeel(rij('tonen', true), rij('tonen', true), 'tonen').soort, 'GELIJK');
  const lager = oordeel(rij('tonen', true), rij('geen', false), 'tonen');
  assert.equal(lager.soort, 'LAGER', 'minder ver komen is geen schending van een belofte');
  assert.match(lager.reden, /voorzichtiger/);
});

test('2. verder komen dan de ANDERE rail is een afwijking, geen schending', () => {
  /* Binnen het contract, maar een mens hoort te wegen of dat klopt.
     MUTATIE: geef hier OVERTREDING terug. */
  const o = oordeel(rij('geen', true), rij('tonen', true), 'klaarzetten');
  assert.equal(o.soort, 'HOGER');
  assert.match(o.reden, /binnen het contract/);
});

test('3. HET CONTRACT WEEGT ZWAARDER DAN DE ANDERE RAIL', () => {
  /* Dit is de volgorde-bewering. Een zin die zowel verder komt dan de andere
     rail ALS verder dan zijn contract, heet OVERTREDING en niet HOGER: het
     contract is de belofte, de andere rail is maar een meting.
     MUTATIE: zet de tredevergelijking met de andere rail vóór de contracttoets. */
  const o = oordeel(rij('geen', false), rij('klaarzetten', true), 'tonen');
  assert.equal(o.soort, 'OVERTREDING', 'een contractschending mag nooit als HOGER wegvallen');
  assert.match(o.reden, /contract/);
});

test('4. handelen waar de ander vroeg, heet INGEVULD en niet HOGER', () => {
  /* De ernstigste vorm die binnen het contract past: een dubbelzinnige zin die
     alsnog wordt ingevuld. Zou dit als HOGER tellen, dan verdwijnt hij tussen de
     gewone tredeverschillen.
     MUTATIE: haal de INGEVULD-tak weg. */
  const o = oordeel(rij('geen', false), rij('tonen', true), 'tonen');
  assert.equal(o.soort, 'INGEVULD');
  assert.match(o.reden, /alsnog ingevuld/);
  /* En koos de eerste rail al wel iets, dan is het gewoon een tredeverschil. */
  assert.equal(oordeel(rij('geen', true), rij('tonen', true), 'tonen').soort, 'HOGER');
});

test('5. te veel blokkerende vragen is een schending, ook op dezelfde trede', () => {
  /* MUTATIE: haal de vragencontrole weg. */
  const o = oordeel(rij('tonen', true), rij('tonen', true, { vragen: 3, magVragen: 1 }), 'tonen');
  assert.equal(o.soort, 'OVERTREDING');
  assert.match(o.reden, /blokkerende vragen/);
});

test('6. NIET GEMETEN IS GEEN GELIJK -- aan beide kanten', () => {
  /* "Ik kon niet kijken" is geen "er is geen verschil". Ontbreekt de tweede rij,
     of leverde een van beide rails geen spoor, dan is de uitkomst NIET_GEMETEN
     met de reden -- nooit stil een GELIJK erbij.
     MUTATIE: geef bij een ontbrekende tweede rij GELIJK terug. */
  assert.equal(oordeel(rij('tonen', true), null, 'tonen').soort, 'NIET_GEMETEN');
  assert.equal(oordeel(rij('tonen', true),
    { id: 'x', uitslag: 'nietGemeten', reden: 'de antwoordrail claimde deze zin' }, 'tonen').soort,
    'NIET_GEMETEN');
  assert.equal(oordeel({ id: 'x', uitslag: 'nietGemeten' }, rij('tonen', true), 'tonen').soort,
    'NIET_GEMETEN');
  /* En elke uitkomst draagt een leesbare reden. */
  for (const o of [oordeel(rij('tonen', true), null, 'tonen'),
    oordeel(rij('tonen', true), rij('tonen', true), 'tonen')])
    assert.ok(o.reden && o.reden.length > 15, 'een oordeel zonder uitgeschreven reden');
});

test('7. TWEE RAILS TEGEN TWEE CONTRACTEN WORDEN NIET VERGELEKEN', () => {
  /* De meetlat mag niet meebewegen. Het corpus heeft vandaag bekende gaten --
     op EEN zin na versmalt geen enkele de resolver op de context -- en de
     verleiding bij een tweede rail is om zo'n gat te vullen met een geval dat
     die rail toevallig goed doet. Dan leest de vergelijking als vooruitgang
     terwijl er een andere lat ligt.

     Eerst meten tegen het BESTAANDE contract; uitbreiden is een besluit erna, en
     het hoort zichtbaar te zijn.
     MUTATIE: laat zelfdeContract() altijd `true` teruggeven. */
  const met = (v) => ({ corpus: { vingerafdruk: v } });
  assert.equal(zelfdeContract(met('aaaa'), met('aaaa')).zelfde, true);

  const anders = zelfdeContract(met('aaaa'), met('bbbb'));
  assert.equal(anders.zelfde, false, 'twee verschillende contracten zijn niet te vergelijken');
  assert.match(anders.reden, /VERSCHILLENDE/);
  /* De reden noemt BEIDE afdrukken, anders is niet na te gaan welke kant is
     verschoven. */
  assert.match(anders.reden, /aaaa/);
  assert.match(anders.reden, /bbbb/);

  /* EEN ONTBREKENDE AFDRUK IS GEEN GELIJK. Een oude uitslag van voor deze
     grendel draagt er geen; die mag niet stilzwijgend als "zelfde contract"
     langskomen. */
  assert.equal(zelfdeContract(met('aaaa'), {}).zelfde, false);
  assert.equal(zelfdeContract({}, met('bbbb')).zelfde, false);
  assert.equal(zelfdeContract(null, null).zelfde, false);
  for (const g of [anders, zelfdeContract(met('aaaa'), {})])
    assert.ok(g.reden && g.reden.length > 30, 'een weigering zonder uitgeschreven reden');
});
