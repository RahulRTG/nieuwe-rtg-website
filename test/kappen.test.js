/* AFKAPPEN IS HUISHOUDEN, EN HUISHOUDEN HOORT NIET IN EEN VERZOEK.

   WAAROM DIT BESTAAT. Drie collecties hadden hun bovengrens in de schrijfroute
   zelf staan: `db.data.clipsMeldingen = ...slice(-200)` middenin meld(), en
   twee van dezelfde soort in snapSturen() en verhaalPlaatsen(). In rust haalt
   zo'n kap een rij per verzoek weg en valt hij onder elke grens.

   Maar staat een collectie ooit ver boven zijn kap -- na een import, na een
   herstel, of omdat iemand het getal verlaagt -- dan wil de kap er in EEN keer
   honderden of duizenden weghalen. Zou server/opzet/begroting.js daar een grens
   op handhaven, dan wordt die weigering geen weigering maar een STORING DIE
   ZICHZELF IN STAND HOUDT: de collectie blijft te groot, dus het volgende
   verzoek loopt tegen precies dezelfde weigering aan. KRIMP.json noemt die drie
   met naam, en het is de reden dat ze niet gehandhaafd konden worden.

   De reparatie is een verhuizing en geen uitzondering: de kap draait nu in de
   onderhoudsronde (server/opzet/onderhoud.js), buiten elk verzoek, waar de
   begroting per ontwerp niets van vindt.

   WAT DEZE TOETS BEWAAKT: dat de kap werkt, dat hij de bestanden meeneemt, dat
   hij niet omvalt over zijn buren -- en vooral dat hij NIET terugkomt in de
   schrijfroute. Dat laatste is de bewering die telt; de rest is de kap zelf.

   Draai los: node --test test/kappen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { maakKappen } = require('../server/kern/kappen');
const { onderhoudsronde } = require('../server/opzet/onderhoud');

const WORTEL = path.join(__dirname, '..');
const rijen = (n, m) => Array.from({ length: n }, (_, i) => ({ id: i, foto: m ? 'f' + i : null }));

function opzet(data) {
  const db = { data: data };
  let bewaard = 0;
  const gewist = [];
  const kappen = maakKappen({
    db, save: () => { bewaard++; },
    media: { verwijder: (ref) => gewist.push(ref) },
    log: { warn: () => {}, info: () => {} }
  });
  return { db, kappen, gewist, bewaard: () => bewaard };
}

test('een collectie boven zijn kap wordt ingekort tot precies de kap', () => {
  const o = opzet({ clipsMeldingen: rijen(250), snaps: [], stories: [] });
  const uit = o.kappen.ronde();
  assert.equal(uit.totaal, 50, 'er hoorden er vijftig af te gaan');
  assert.equal(o.db.data.clipsMeldingen.length, 200);
  /* De NIEUWSTE blijven staan. Andersom knippen gooit precies weg wat iemand
     nog wil zien, en dat verschil is aan de uitkomst niet te zien als je alleen
     de lengte telt. */
  assert.equal(o.db.data.clipsMeldingen[0].id, 50, 'de oudste rijen horen eraf, niet de nieuwste');
  assert.equal(o.db.data.clipsMeldingen[199].id, 249);
  assert.equal(o.bewaard(), 1, 'er hoort een keer bewaard te worden, en alleen als er iets afging');
});

test('onder de kap gebeurt er niets, en er wordt ook niet bewaard', () => {
  const o = opzet({ clipsMeldingen: rijen(199), snaps: rijen(10), stories: rijen(10) });
  const uit = o.kappen.ronde();
  assert.equal(uit.totaal, 0);
  assert.equal(o.db.data.clipsMeldingen.length, 199);
  assert.equal(o.bewaard(), 0, 'een ronde die niets doet, hoort ook niet te schrijven');
});

test('een weggeknipte snap neemt zijn BESTAND mee', () => {
  /* Zonder deze bewering verhuist de kap wel, maar blijft er bij elke ronde een
     stapel foto's op schijf achter die niemand meer kan opvragen -- een lek dat
     pas maanden later opvalt, aan de schijf. */
  const o = opzet({ clipsMeldingen: [], snaps: rijen(2003, true), stories: rijen(1002, true) });
  const uit = o.kappen.ronde();
  assert.equal(uit.totaal, 5);
  assert.deepEqual(uit.per, { snaps: 3, stories: 2 });
  assert.deepEqual(o.gewist, ['f0', 'f1', 'f2', 'f0', 'f1'],
    'de bestanden van de weggeknipte snaps en verhalen worden niet opgeruimd');
});

test('een kap die omvalt neemt de andere niet mee', () => {
  /* Dit is onderhoud. Onderhoud dat het proces raakt is erger dan onderhoud dat
     een ronde overslaat. */
  const o = opzet({ clipsMeldingen: rijen(250), stories: rijen(1002, true) });
  Object.defineProperty(o.db.data, 'snaps', {
    enumerable: true, configurable: true,
    get() { throw new Error('opslag even weg'); }
  });
  const uit = o.kappen.ronde();
  assert.equal(o.db.data.clipsMeldingen.length, 200, 'de eerste kap hoort gewoon te zijn gedaan');
  assert.equal(o.db.data.stories.length, 1000, 'en de derde ook, ondanks de tweede');
  assert.equal(uit.totaal, 52);
});

test('de onderhoudsronde roept de kappen aan, en meldt hoeveel er af ging', () => {
  const o = opzet({ clipsMeldingen: rijen(210), snaps: [], stories: [] });
  const uit = onderhoudsronde({ kappen: o.kappen, nu: 1000 });
  assert.equal(uit.gekapt, 10, 'de ronde telt de gekapte rijen niet mee');
  assert.equal(o.db.data.clipsMeldingen.length, 200);
});

test('zonder kappen draait de onderhoudsronde gewoon door', () => {
  /* De ronde wordt door toetsen ook zonder kappen aangeroepen; die mogen niet
     omvallen op een ontbrekend onderdeel. */
  const uit = onderhoudsronde({ nu: 1000 });
  assert.equal(uit.gekapt, 0);
  assert.equal(uit.remmen, 0);
});

test('DE BEWERING DIE TELT: de kap staat NIET meer in de schrijfroute', () => {
  /* Hier komt hij terug als hij terugkomt. Iemand die morgen een bovengrens
     nodig heeft, zet hem uit gewoonte in de route waar de rij bij komt -- en
     dan is de collectie stilletjes weer niet te handhaven, zonder dat er iets
     rood wordt. Deze bewering is de enige die dat merkt. */
  const kap = /db\.data\.(clipsMeldingen|snaps|stories)\s*=\s*[^;\n]*\.slice\(/;
  for (const rel of ['server/kern/clips.js', 'server/kern/sociaal/snaps.js']) {
    const bron = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    assert.equal(kap.test(bron), false,
      rel + ' kapt een van de drie collecties weer af in zijn eigen pad. Zet de bovengrens ' +
      'in server/kern/kappen.js, anders kan er nooit een grens op die collectie (KRIMP.json).');
  }
  /* En de tegenproef: de zeef herkent zo'n regel ook echt. Zonder haar zou hij
     hierboven altijd groen zijn omdat hij niets kan vinden. */
  assert.equal(kap.test('  db.data.snaps = db.data.snaps.slice(-2000);'), true,
    'de zeef herkent een kap in de schrijfroute niet');
});

test('de drie kappen die KRIMP.json noemt, staan er alle drie in', () => {
  const o = opzet({});
  const namen = o.kappen.KAPPEN.map(k => k.collectie).sort();
  assert.deepEqual(namen, ['clipsMeldingen', 'snaps', 'stories'],
    'de kappen wijken af van wat KRIMP.json als kap-collecties noemt');
  for (const k of o.kappen.KAPPEN) {
    assert.ok(Number.isFinite(k.houd) && k.houd > 0, k.collectie + ' heeft geen bruikbare bovengrens');
  }
});
