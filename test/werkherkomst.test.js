/* ============================================================================
   DE WERKHERKOMST -- van wie is dit werk, en wat zegt dit register NIET?

   Het is een klein bestand met een grote verantwoordelijkheid: kern/connect/
   schrijft op grond hiervan een regel in het dossier van een MENS, in de enige
   trede die buiten Foundation iets betekent. Een fout hier legt bewijs bij de
   verkeerde persoon, en dat is stiller dan het klinkt -- niemand van de twee
   merkt het.

   Vier beweringen, en de laatste twee zijn grenzen en geen gedrag.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakWerkherkomst, MAX } = require('../server/kern/mediaos/werkherkomst');

const wereld = () => {
  const db = { data: {} };
  let saves = 0;
  return { db, saves: () => saves, wh: maakWerkherkomst({ db, save: () => { saves++; } }) };
};

test('1. wat een domein aanmeldt, is precies terug te vinden', () => {
  const { wh } = wereld();
  const a = wh.legWerk('KEY-A', 'video', 'Zo maak je pasta');
  assert.ok(a && a.id, 'er komt een id terug waar de rest van het huis aan kan hangen');
  assert.deepEqual(wh.makerVanWerk(a.id), { sleutel: 'KEY-A', onderwerp: 'video', titel: 'Zo maak je pasta' });
  /* Het ONDERWERP is de soort en niet de titel. Zou de titel het onderwerp zijn,
     dan krijgt een maker evenveel onderwerpen als werken, en zegt de hoogste
     trede per onderwerp niets meer. */
  assert.equal(wh.makerVanWerk(a.id).onderwerp, 'video');
});

test('2. het wijst het JUISTE werk aan, ook met meerdere makers', () => {
  const { wh } = wereld();
  const a = wh.legWerk('KEY-A', 'video', 'a');
  const b = wh.legWerk('KEY-B', 'muziek', 'b');
  assert.equal(wh.makerVanWerk(a.id).sleutel, 'KEY-A');
  assert.equal(wh.makerVanWerk(b.id).sleutel, 'KEY-B');
  assert.equal(wh.makerVanWerk('wk-bestaat-niet'), null, 'en een onbekend id geeft null, geen gok');
});

test('3. lezen laat de opslag met rust', () => {
  /* Dezelfde correctie als bij de drie lezers van kern/connect/: een lezer die
     zijn eigen bak aanlegt, laat de opslag groeien door ernaar te kijken --
     zonder save(), dus onzichtbaar tot een andere handeling toevallig opslaat. */
  const { db, wh, saves } = wereld();
  assert.equal(wh.makerVanWerk('wat dan ook'), null);
  assert.deepEqual(wh.werkenVan('KEY-A'), []);
  assert.deepEqual(db.data, {}, 'na alleen lezen staat er niets');
  assert.equal(saves(), 0, 'en er is niet eens geprobeerd op te slaan');
});

test('4. er is geen weg naar de werken van IEDEREEN', () => {
  /* Dit is een grens en geen ontbrekende functie: een lijst over makers heen is
     een publieke makerslijst, en die hoort niet uit een herkomstregister te
     komen. `werkenVan` eist een sleutel en geeft zonder sleutel niets. */
  const { wh } = wereld();
  wh.legWerk('KEY-A', 'video', 'a');
  wh.legWerk('KEY-B', 'muziek', 'b');
  assert.deepEqual(wh.werkenVan(''), [], 'zonder sleutel: niets');
  assert.deepEqual(wh.werkenVan(null), [], 'ook met null: niets');
  assert.equal(wh.werkenVan('KEY-A').length, 1, 'met een sleutel: alleen die van hem');
  assert.equal(wh.werkenVan('KEY-A')[0].maker, 'KEY-A');
  /* En er is geen andere uitgang. Wie er een toevoegt, voegt een makerslijst toe. */
  assert.deepEqual(Object.keys(wh).sort(), ['MAX', 'legWerk', 'makerVanWerk', 'werkenVan']);
});

test('5. een aanmelding zonder maker of soort wordt niet vastgelegd', () => {
  const { db, wh } = wereld();
  assert.equal(wh.legWerk('', 'video', 't'), null);
  assert.equal(wh.legWerk('KEY-A', '', 't'), null);
  assert.deepEqual(db.data, {}, 'en het laat ook geen lege bak achter');
});

test('6. de noodrem telt wat hij wegsnijdt', () => {
  /* MAX is een noodrem en geen bewaartermijn. Verjaren en afgekapt worden gaan
     nooit op een hoop: het eerste is de termijn die werkt, het tweede de
     belofte die breekt -- dus moet hij het ZEGGEN als hij bijt. */
  const { db, wh } = wereld();
  db.data.mediaWerkherkomst = Array.from({ length: MAX }, (_, i) => ({
    id: 'oud' + i, maker: 'KEY-OUD', soort: 'video', titel: null, at: '2026-01-01T00:00:00.000Z' }));
  const nieuw = wh.legWerk('KEY-A', 'video', 'de druppel');
  assert.equal(nieuw.afgekapt, 1, 'hij zegt hoeveel er afvielen');
  assert.equal(db.data.mediaWerkherkomst.length, MAX);
  assert.ok(wh.makerVanWerk(nieuw.id), 'en het nieuwste staat er nog');
  assert.equal(wh.makerVanWerk('oud0'), null, 'het oudste is eraf');
});
