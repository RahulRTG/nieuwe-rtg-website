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
  for (const g of ['voor-eerste-mutatie', 'na-commit-voor-antwoord']) {
    assert.equal(k[g].bestaat, 'onbekend', g + ' hoort onbekend te zijn');
    assert.equal(k[g].graad, 'onbekend', 'en de graad hoort dat te weerspiegelen');
    assert.ok(k[g].grond && k[g].grond.length > 20, 'met een uitgeschreven reden');
  }
});

/* DEZE TOETS STOND HET OMGEKEERDE TE BEWAKEN, en hij had gelijk over de vorm en
   ongelijk over de inhoud. Hij eiste dat een route die aantoonbaar SCHRIJFT de
   twee duurzame grenzen als `ja` draagt. Dat is over-claimen: schrijven zegt
   niets over de WEG waarlangs, en scripts/crashproef.js heeft eenenveertig van
   de negentig rijen gemeten als "komt langs geen van beide injectiepunten" --
   die routes schrijven met de gewone write-behind save().

   De regel is nu: schrijft hij aantoonbaar niets, dan bestaat de grens niet;
   heeft de PROEF hem geraakt, dan bestaat hij; in alle andere gevallen is het
   `onbekend`. Dat laatste is de belangrijke helft -- het oude `ja` was een
   gevolgtrekking die nergens op steunde. */
test('schrijven alleen maakt een crashgrens NIET bestaand -- dat is de schrijfweg', () => {
  const k = ca.classificeer(rij({ collecties: ['paySaldi', 'payBoekingen'] }));
  for (const g of ['voor-eerste-mutatie', 'na-commit-voor-antwoord']) {
    assert.equal(k[g].bestaat, 'onbekend',
      g + ': deze fixture staat niet in CRASHPROEF.json, dus de schrijfweg is niet gemeten');
    assert.notEqual(k[g].bestaat, 'ja',
      'dit was de over-claim: "hij schrijft" gelezen als "de grens bestaat"');
    assert.match(k[g].grond, /SCHRIJFWEG|schrijfweg/,
      'en de reden noemt waar het werkelijk aan hangt');
  }
});

/* DE BEDRADING NAAR DE PROEF, tegen het ECHTE register en niet tegen een
   verzonnen fixture. Een fixture zou zich houden aan de vorm die deze code
   aanneemt in plaats van aan de vorm die het register werkelijk heeft -- dat
   is hoe achttien groene toetsen eerder een kapotte functie hebben gedekt. */
test('een grens die de proef HEEFT geraakt, staat op ja; een pad zonder weg op nee', () => {
  const cp = require('../CRASHPROEF.json');
  const geraakt = cp.per.find(r => r.stand === 'PROVEN' || r.stand === 'FAILED');
  const zonderWeg = cp.per.find(r => r.stand === 'GEEN_DUURZAME_WEG');
  assert.ok(geraakt && zonderWeg, 'het register hoort allebei de gevallen te bevatten');

  const kg = ca.classificeer({ methode: geraakt.methode, pad: geraakt.pad,
    collecties: geraakt.collecties, semantiek: 'idempotent' });
  assert.equal(kg[geraakt.grens].bestaat, 'ja');
  assert.equal(kg[geraakt.grens].graad, 'gemeten');

  const kz = ca.classificeer({ methode: zonderWeg.methode, pad: zonderWeg.pad,
    collecties: zonderWeg.collecties, semantiek: 'idempotent' });
  assert.equal(kz[zonderWeg.grens].bestaat, 'nee');
  assert.equal(kz[zonderWeg.grens].graad, 'gemeten', 'dit is nagemeten en niet geredeneerd');
  assert.ok(kz[zonderWeg.grens].wordtRelevantAls, 'een `nee` dat kan omslaan zegt wat hem omslaat');
  assert.match(kz[zonderWeg.grens].wordtRelevantAls, /schrijf-verloren/,
    'en wijst naar de modus die hem WEL bedreigt -- anders leest het als een vrijspraak');
});

/* DE GRENS DIE NIET BESTAAT, EN WAAROM DAT EEN TOETS VERDIENT.

   `in-de-opslag` stond eerst op `ja` voor elke schrijvende route -- een half
   geschreven uitkomst klinkt immers waarschijnlijk zodra er twee collecties bij
   betrokken zijn. scripts/crashgrenzen.js mat het na en vond het tegendeel: de
   opslag schrijft met BEGIN IMMEDIATE ... COMMIT, dus hij commit heel of rolt
   heel terug. Een injectie tussen de schrijfopdracht en de checkpoint gaf exact
   de uitkomst van sterf-na-commit.

   Deze toets houdt twee dingen vast die makkelijk terugglijden: het is een
   `nee` met een GEMETEN grond (geen aanname), en het zegt WAT hem weer relevant
   maakt -- op een opslag die wel kan scheuren bestaat dit moment wel. */
test('`in-de-opslag` bestaat NIET op een transactionele opslag, met de grond erbij', () => {
  const k = ca.classificeer(rij({ collecties: ['paySaldi', 'payBoekingen'] }));
  assert.equal(k['in-de-opslag'].bestaat, 'nee');
  assert.equal(k['in-de-opslag'].graad, 'gemeten', 'dit is nagemeten en niet geredeneerd');
  assert.match(k['in-de-opslag'].grond, /transactioneel|COMMIT/,
    'de grond noemt waarom er geen middelpunt is');
  assert.ok(k['in-de-opslag'].wordtRelevantAls, 'een `nee` dat kan omslaan zegt wat hem omslaat');
  assert.equal(k['in-de-opslag'].collecties, 2,
    'het aantal collecties blijft staan: op een opslag die WEL kan scheuren bepaalt dat het risico');
});

/* EN DE HEFBOOM ZELF: `voor-eerste-mutatie` is sinds 13 september te beproeven.
   Zonder deze toets kan dat stil terugvallen naar onmeetbaar en merkt niemand
   dat de crash-as weer een grens armer is. */
test('`voor-eerste-mutatie` heeft een injectiepunt en is dus meetbaar', () => {
  assert.equal(ca.INJECTIE['voor-eerste-mutatie'].verraad, 'sterf-voor-mutatie');
  const u = ca.meet();
  for (const r of u.per) assert.equal(r.grenzen['voor-eerste-mutatie'].meetbaar, 'sterf-voor-mutatie');
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
