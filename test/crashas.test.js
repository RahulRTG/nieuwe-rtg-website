/* DE CRASH-AS-CLASSIFICATIE -- wat er hier bewaakt wordt, en waarom.

   scripts/crashas.js beantwoordt per geldroute en per crashgrens de vraag of
   die grens er WERKELIJK is. Dat is een classificatie, en een classificatie
   gaat op precies twee manieren stuk:

     1. een `onbekend` die stilletjes een `nee` wordt -- dan daalt het aantal
        open vragen zonder dat er iets is uitgezocht;
     2. een grens die `meetbaar` heet terwijl er geen injectiepunt is -- dan
        stijgt de dekking doordat er minder te meten valt.

   Beide zijn hieronder een toets. Ze zijn met een mutatie nagetrokken (LAT.md
   regel 2): elke bewering is een keer zien zakken met een met opzet verkeerde
   invoer, en die zelfijking staat als laatste toets in dit bestand. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ca = require('../scripts/crashas.js');
const tax = require('../scripts/lib/crashtaxonomie.js');

const GRENZEN = Object.keys(tax.GRENZEN);
const rij = (over) => Object.assign({ methode: 'POST', pad: '/api/test',
  collecties: ['paySaldi'], semantiek: 'idempotent' }, over || {});

test('elke grens uit de gesloten taxonomie krijgt een oordeel -- geen enkele valt weg', () => {
  const k = ca.classificeer(rij());
  assert.deepEqual(Object.keys(k).sort(), GRENZEN.slice().sort(),
    'de classificatie dekt precies de zes grenzen van crashtaxonomie.js');
});

test('`bestaat` is een gesloten woord: ja, nee of onbekend', () => {
  const toegestaan = new Set(['ja', 'nee', 'onbekend']);
  for (const soort of [rij(), rij({ collecties: [], semantiek: 'leest' }),
    rij({ collecties: [], idempotentie: 'ongemeten' })]) {
    for (const [g, c] of Object.entries(ca.classificeer(soort)))
      assert.ok(toegestaan.has(c.bestaat), g + ' draagt een vreemd woord: ' + c.bestaat);
  }
});

/* DE KERN VAN DIT BESTAND. Een route waarvan niet gemeten is of hij schrijft,
   hoort `onbekend` te krijgen en niet `nee`. Die twee door elkaar halen is de
   fout die kern/stuur/gevolg.js elders al benoemt: "de proef kwam er niet bij"
   is iets anders dan "er gebeurt niets". */
test('een ONGEMETEN route is onbekend en nooit `nee`', () => {
  const k = ca.classificeer(rij({ collecties: [], idempotentie: 'ongemeten' }));
  for (const g of ['voor-eerste-mutatie', 'in-de-opslag', 'na-commit-voor-antwoord']) {
    assert.equal(k[g].bestaat, 'onbekend', g + ' hoort onbekend te zijn');
    assert.equal(k[g].graad, 'onbekend', 'en de graad hoort dat te weerspiegelen');
    assert.ok(k[g].grond && k[g].grond.length > 20, 'met een uitgeschreven reden');
  }
});

test('een route die aantoonbaar schrijft, draagt de drie schrijfgrenzen als gemeten', () => {
  const k = ca.classificeer(rij({ collecties: ['paySaldi', 'payBoekingen'] }));
  for (const g of ['voor-eerste-mutatie', 'in-de-opslag', 'na-commit-voor-antwoord']) {
    assert.equal(k[g].bestaat, 'ja');
    assert.equal(k[g].graad, 'gemeten', 'de collecties zijn GEMETEN, niet geraden');
  }
  assert.match(k['in-de-opslag'].vorm, /samengesteld/,
    'twee collecties maken van een half geschreven uitkomst een samengesteld risico');
});

/* EEN `nee` DIE KAN OMSLAAN, MOET ZEGGEN WAT HEM OMSLAAT. De twee externe
   grenzen bestaan vandaag niet omdat er geen aanbieder hangt. Dat is een
   TOESTAND en geen eigenschap van de route, en zonder dat veld leest hij als
   het tweede. */
test('de externe grenzen dragen wat hen relevant maakt', () => {
  const k = ca.classificeer(rij());
  for (const g of ['providercommit-zonder-antwoord', 'ambigu-extern-resultaat']) {
    assert.equal(k[g].bestaat, 'nee');
    assert.ok(k[g].wordtRelevantAls, g + ' zegt niet wat hem relevant zou maken');
    assert.match(k[g].grond, /provider/i, 'en noemt de grond in de code');
  }
});

test('een grens zonder injectiepunt heet nooit meetbaar', () => {
  const u = ca.meet();
  for (const r of u.per) for (const g of GRENZEN) {
    const c = r.grenzen[g];
    if (!ca.INJECTIE[g].verraad) {
      assert.equal(c.meetbaar, false, g + ' heeft geen verraad en hoort niet meetbaar te heten');
      assert.ok(c.nietMeetbaarOmdat, 'en zegt waarom niet');
    }
  }
});

/* DE DRIE TELLERS WORDEN NOOIT OPGETELD, en dit is de toets die dat vasthoudt:
   bestaat + bestaatNiet + onbekend dekt elk paar precies een keer. Zou een
   `onbekend` in twee vakken belanden, dan is het totaal groter dan het aantal
   paren en klopt elk percentage erover niet meer. */
test('elke (route, grens) valt in precies EEN vak', () => {
  const t = ca.meet().telling;
  assert.equal(t.bestaat + t.bestaatNiet + t.onbekend, t.paren,
    'de drie vakken dekken samen precies alle paren');
  assert.equal(t.paren, t.routes * GRENZEN.length);
  assert.ok(t.meetbaar <= t.bestaat, 'meetbaar kan nooit groter zijn dan bestaand');
  assert.ok(t.gemeten <= t.meetbaar, 'gemeten kan nooit groter zijn dan meetbaar');
});

/* DE ZELFIJKING. Een toets die je niet hebt zien zakken is geen toets: hier
   wordt met opzet verkeerde invoer aangeboden, en de classificatie MOET er
   anders uit komen. Blijft hij gelijk, dan meet dit bestand niets. */
test('zelfijking: verkeerde invoer verandert de uitslag aantoonbaar', () => {
  const schrijft = ca.classificeer(rij({ collecties: ['paySaldi'] }));
  const leest = ca.classificeer(rij({ collecties: [], semantiek: 'leest' }));
  assert.notEqual(schrijft['voor-eerste-mutatie'].bestaat, leest['voor-eerste-mutatie'].bestaat,
    'een lezende route hoort anders geclassificeerd te worden dan een schrijvende');
  assert.equal(leest['voor-eerste-mutatie'].bestaat, 'nee');

  const metBericht = ca.classificeer(rij({ collecties: ['paySaldi', 'meldingen'] }));
  assert.equal(metBericht['na-commit-voor-bericht'].bestaat, 'ja',
    'een gemeten berichtbak maakt de berichtgrens aantoonbaar');
  assert.equal(schrijft['na-commit-voor-bericht'].bestaat, 'onbekend',
    'en zonder berichtbak blijft hij onbekend -- niet `nee`');
});
