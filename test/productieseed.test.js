/* DE PRODUCTIESEED HOUDT ZIJN EIGEN BELOFTE.

   server/seed/index.js droeg de sleutel `trip` TWEE KEER in hetzelfde
   objectliteraal: `trip: null` met een uitleg erboven, en drie regels lager
   `trip: { dest: '', dates: '', days: 0, items: [] }`. In JavaScript wint de
   laatste, dus een van de twee deed niets -- en welke, dat kon je aan de code
   niet zien. Precies dat is het defect: niet de waarde, maar dat er twee zijn.

   WAT DE UITKOMST HOORT TE ZIJN, en dat is niet wat het commentaar suggereert.
   `trip: null` stond bovenaan met de uitleg erboven, maar twee andere bronnen
   kennen de LEGE VORM als "geen reis": kern/initdata/index.js zet hem op precies
   die waarde wanneer het een demo-reis uit een bestaande installatie veegt, en
   test/demostand.test.js legt hem zo vast. Twee bronnen tegen een
   commentaarregel, dus de dubbele sleutel is opgelost NAAR de lege vorm -- het
   defect (twee keer dezelfde sleutel) is weg zonder dat productiegedrag
   verschuift. De belofte blijft staan: `dest` is leeg, dus er is geen
   bestemming.

   WAT DIT WEL BLOOTLEGT. `npm run ast-scan` meldde de dubbele sleutel, als een
   van drie waarschuwingen over dubbele objectsleutels; de andere twee waren
   onschuldig (tweemaal `{}`), en daar verdween deze tussen. Een onschuldige
   waarschuwing die blijft staan, is de schuilplaats van een schuldige.

   DEZE TOETS ROEPT DE SEED AAN IN PRODUCTIESTAND, en dat kan alleen door de
   vlaggen uit de omgeving te halen -- server/testomgeving.js leest ze bij elke
   aanroep, niet bij het laden.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - een tweede `trip: null` eronder gezet (de oude dubbele sleutel, andersom)
     -> "de productieseed kent geen bestemming" ZAKT (RAAK)
   - de bestemming op 'Ibiza' gezet -> zelfde toets ZAKT (RAAK)
   - de vroege uitgang `if (demo) return vol;` omgedraaid
     -> "de demoseed houdt zijn eigen inhoud" ZAKT (RAAK)

   Los: node --test test/productieseed.test.js */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

/* De seed in productiestand. NODE_ENV blijft met opzet op 'development' en gaat
   niet naar 'production': testomgeving.actief() geeft voor allebei false, en
   'production' zet elders in het huis dingen aan die deze toets niet nodig
   heeft. Wat hier bewezen wordt is de GEWONE echte start -- een server zonder
   vlaggen, en dat is nu juist het geval dat een keer misging. */
function inProductiestand(werk) {
  const oud = {
    magnaat: process.env.RTG_MAGNAAT_TEST,
    demo: process.env.RTG_DEMO,
    node: process.env.NODE_ENV
  };
  delete process.env.RTG_MAGNAAT_TEST;
  delete process.env.RTG_DEMO;
  process.env.NODE_ENV = 'development';
  try {
    delete require.cache[require.resolve('../server/seed')];
    return werk(require('../server/seed')());
  } finally {
    for (const [sleutel, waarde] of [['RTG_MAGNAAT_TEST', oud.magnaat],
      ['RTG_DEMO', oud.demo], ['NODE_ENV', oud.node]]) {
      if (waarde === undefined) delete process.env[sleutel];
      else process.env[sleutel] = waarde;
    }
    delete require.cache[require.resolve('../server/seed')];
  }
}

test('de productieseed kent geen bestemming', () => {
  inProductiestand((v) => {
    /* Op de VORM en op de BESTEMMING apart, en dat is het punt van deze toets.
       De vorm houdt vast wat de rest van het huis als "geen reis" kent; de
       bestemming is de belofte uit de kop van het seed-blok. Een tweede sleutel
       `trip` in datzelfde literaal kan allebei stil omzetten. */
    assert.deepEqual(v.trip, { dest: '', dates: '', days: 0, items: [] },
      'de lege reisvorm is wat kern/initdata en test/demostand als "geen reis" kennen');
    assert.equal(v.trip.dest, '',
      'een productie-installatie hoort geen bestemming te kennen die niemand boekte');
    assert.deepEqual(v.trip.items, [], 'en geen reisonderdelen');
  });
});

test('de productieseed laat geen verzonnen inhoud staan', () => {
  inProductiestand((v) => {
    /* De buren van `trip` in hetzelfde blok. Ze staan hier omdat een dubbele
       sleutel elk van hen op dezelfde manier stil had kunnen overschrijven, en
       omdat een toets die alleen `trip` bewaakt de volgende keer niets vangt. */
    for (const sleutel of ['suppliers', 'posts', 'partners', 'partnerTrips', 'invoices', 'contacts']) {
      assert.deepEqual(v[sleutel], [], sleutel + ' hoort leeg te zijn zonder demostand');
    }
    assert.deepEqual(v.creatorCredit, {}, 'de creator-tellers horen leeg te zijn');
    assert.deepEqual(v.creatorLikes, {}, 'de creator-tellers horen leeg te zijn');
    assert.deepEqual(v.livingLab.labs, [], 'een echt lab wordt door de RTF zelf neergezet');
    assert.deepEqual(v.muziekUitgaven.lijst, [], 'de zaal begint leeg en vult zich met echte uitgaven');
  });
});

test('de demoseed houdt zijn eigen inhoud', () => {
  /* De positieve controle. Zonder deze zou "alles leeg" ook slagen als de seed
     kapot was en overal niets meer teruggaf -- en dan bewaakt de toets hierboven
     niets. De toetsronde draait zelf in Magnaat Test, dus dit is de gewone weg. */
  delete require.cache[require.resolve('../server/seed')];
  const v = require('../server/seed')();
  assert.ok(v.suppliers.length > 0, 'de demostand heeft voorbeeldzaken');
  assert.ok(v.posts.length > 0, 'de demostand heeft voorbeeldposts in De Salon');
  assert.ok(v.trip && v.trip.dest, 'de demostand heeft wel een voorbeeldreis met bestemming');
});
