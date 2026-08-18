/* ============================================================================
   DE GRENS OP DE BOEKINGEN: WAT ERBUITEN VALT, VALT NIET WEG.

   De levende boekingen-collectie heeft een plafond (50000). Dat plafond moet
   blijven: zonder grootboek -- de json- en de geheugen-stand -- wordt die
   collectie in haar geheel geserialiseerd, en ongebonden loopt dat op den duur
   tegen de maximale stringlengte aan.

   Maar het kappen zelf was `st.arr.length = cap`. Boeking 50.001 duwde de
   oudste eruit: geen regel in de log, geen kopie ergens, geen manier om er
   later achter te komen. Een bevestigde boeking hoort niet te verdwijnen omdat
   er een nieuwere bij kwam.

   Wat deze test vastlegt:
   1. tot de grens verandert er niets;
   2. wat erbuiten valt staat compleet en leesbaar in archief/ -- dezelfde map
      die de backup al meeneemt -- voordat het uit het werkgeheugen gaat;
   3. elke volgende afkapping wordt aangevuld, niet overschreven;
   4. kan de staart NIET weggeschreven worden, dan wordt er ook niet gekapt.
      Anders is een volle schijf precies de omstandigheid waarin de boekingen
      alsnog verdwijnen.

   De cap staat hier op 5 (TX_BOEKINGEN_CAP) -- hetzelfde gedrag als op 50000,
   alleen beproefbaar. Eigen bestand, want die omgevingsvariabele wordt bij het
   laden gelezen en zou de vergelijkingen in txindex.test.js uithollen.

   Draai los: node --test test/txkap.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATA = process.env.RTG_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-txkap-'));
process.env.TX_BOEKINGEN_CAP = '5';
const { db } = require('../server/db');
/* Rechtstreeks uit server/db/tx -- zie test/txindex.test.js voor het waarom. */
const { boekingMetRef, boekingenVoegToe } = require('../server/db/tx');

const BESTAND = path.join(DATA, 'archief', 'boekingen-afgekapt.jsonl');
const maakB = i => ({ ref: 'RTG-C-' + i, supplierCode: 'PONTO', customerKey: 'user-1',
  bedrag: 100 + i, status: 'bevestigd', at: new Date().toISOString() });
const gelezen = () => fs.readFileSync(BESTAND, 'utf8').trim().split('\n').map(r => JSON.parse(r));

test('1. tot de grens blijft alles staan en wordt er niets weggeschreven', () => {
  db.data = { orders: [], boekingen: [] };
  for (let i = 0; i < 5; i++) boekingenVoegToe(maakB(i));
  assert.equal(db.data.boekingen.length, 5);
  assert.ok(boekingMetRef('RTG-C-0'), 'de oudste staat er gewoon nog');
  assert.equal(fs.existsSync(BESTAND), false, 'er is nog niets afgekapt');
});

test('2. daarboven gaat de staart EERST naar het archief, compleet', () => {
  boekingenVoegToe(maakB(5));
  assert.equal(db.data.boekingen.length, 5, 'de collectie blijft op de grens');
  assert.equal(boekingMetRef('RTG-C-0'), undefined, 'de oudste is uit het werkgeheugen');

  assert.ok(fs.existsSync(BESTAND), 'en staat op schijf: ' + BESTAND);
  const regels = gelezen();
  assert.equal(regels.length, 1, 'precies de ene die eruit ging');
  assert.equal(regels[0].ref, 'RTG-C-0');
  assert.equal(regels[0].bedrag, 100, 'met de hele boeking erin, niet alleen de ref');
});

test('3. elke volgende afkapping vult aan, hij overschrijft niet', () => {
  for (let i = 6; i < 9; i++) boekingenVoegToe(maakB(i));
  assert.deepEqual(gelezen().map(x => x.ref), ['RTG-C-0', 'RTG-C-1', 'RTG-C-2', 'RTG-C-3'],
    'elke afgekapte boeking staat er, oudste eerst');
  assert.equal(db.data.boekingen.length, 5, 'en de levende collectie groeit niet mee');
});

test('4. kan de staart niet weg, dan wordt er niet gekapt', () => {
  db.data = { orders: [], boekingen: [] };
  const map = path.join(DATA, 'archief');
  fs.rmSync(map, { recursive: true, force: true });
  fs.writeFileSync(map, 'geen map');   // een BESTAND op de plek van de map: mkdir en open falen allebei
  try {
    for (let i = 0; i < 8; i++) boekingenVoegToe({ ref: 'RTG-D-' + i, customerKey: 'user-2', at: new Date().toISOString() });
    assert.equal(db.data.boekingen.length, 8, 'liever een te grote collectie dan een boeking die nergens meer staat');
    assert.ok(boekingMetRef('RTG-D-0'), 'de oudste staat er nog gewoon');
  } finally {
    fs.rmSync(map, { force: true });
  }
});

test.after(() => { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {} });
