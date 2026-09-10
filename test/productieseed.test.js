/* DE PRODUCTIESEED HOUDT ZIJN EIGEN BELOFTE.

   Boven `trip: null` in server/seed/index.js staat uitgeschreven waarom hij daar
   staat: een productie-installatie hoort geen bestemming te kennen die niemand
   boekte. Drie regels lager stond `trip: { dest: '', dates: '', days: 0,
   items: [] }` in HETZELFDE objectliteraal. In JavaScript wint de laatste, dus
   de belofte werd stil overschreven en `db.data.trip` was in productie een
   object in plaats van null.

   WAAROM GEEN ENKELE TOETS DIT ZAG. Het blok staat achter `if (demo) return
   vol;`. Elke toets in dit huis draait in Magnaat Test, neemt die vroege uitgang
   en komt er dus nooit langs. De fout kon alleen bestaan op een echte
   installatie -- precies de plek waar niemand kijkt. `npm run ast-scan` meldde
   hem wel, als een van drie waarschuwingen over dubbele objectsleutels; de
   andere twee waren onschuldig (tweemaal `{}`), en daar verdween deze tussen.
   Dat is de tweede les: een onschuldige waarschuwing die blijft staan, is de
   schuilplaats van een schuldige.

   DEZE TOETS ROEPT DE SEED AAN IN PRODUCTIESTAND, en dat kan alleen door de
   vlaggen uit de omgeving te halen -- server/testomgeving.js leest ze bij elke
   aanroep, niet bij het laden.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `trip: { dest: '', dates: '', days: 0, items: [] },` teruggezet onder
     `trip: null` -> "de productieseed kent geen reis" ZAKT (RAAK)
   - `trip: null` vervangen door `trip: {}` -> zelfde toets ZAKT (RAAK)
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

test('de productieseed kent geen reis', () => {
  inProductiestand((v) => {
    assert.equal(v.trip, null,
      'db.data.trip hoort null te zijn op een echte installatie; een object -- ook een leeg -- ' +
      'is waar, dus elke `if (trip)` neemt dan de tak "er is een komende reis"');
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
