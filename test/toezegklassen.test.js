/* DE TOEZEGKLASSEN (AFBOUWPROGRAMMA.md, scripts/lib/toezegklassen.js).

   Twee dingen mogen niet stil gebeuren, en deze toets zakt op allebei:
     1 een citaat in TOEZEGKLASSEN.json staat niet meer letterlijk in zijn
       document (ROT) -- dan zou een afwijzing of een blokkade blijven tellen
       terwijl de grond eronder weg is;
     2 een onderdeel draagt een klasse buiten de vier.

   Beide worden VERS gerekend op de documenten van deze boom, niet gelezen uit
   APPWERKT.json: een register dat de toets zelf leest, kan hem niet laten
   zakken. Of het blok in APPWERKT.json bij de documenten hoort, is een andere
   vraag (versheid) en die stelt `npm run appwerkt:inventaris:controle`.

   En de toets ijkt zichzelf: in een wegwerpwortel MOET een rot citaat en een
   vijfde klasse gevonden worden. Een toets die je niet hebt zien zakken is geen
   toets (LAT.md). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const tk = require('../scripts/lib/toezegklassen');

const WORTEL = path.join(__dirname, '..');
const INV = tk.inventaris(WORTEL);

test('1. geen enkel citaat in het besluitbestand is rot', () => {
  assert.deepEqual(INV.rot.map((r) => r.document + ': ' + r.citaat), [],
    'een citaat staat niet meer letterlijk in zijn document. Werk het citaat bij of haal het item weg -- nooit stil laten tellen.');
  assert.deepEqual(INV.fouten, [], 'het besluitbestand heeft items die niet aan de vorm voldoen');
});

test('2. elk onderdeel valt in een van de vier klassen, en de telling klopt', () => {
  assert.deepEqual(Object.keys(tk.KLASSEN).sort(), ['afgewezen-met-grens', 'extern', 'toegezegd', 'vraagt-besluit']);
  const buiten = INV.items.filter((i) => !Object.prototype.hasOwnProperty.call(tk.KLASSEN, i.klasse));
  assert.deepEqual(buiten.map((i) => i.document + ':' + i.regel + ' ' + i.klasse), []);
  const som = Object.values(INV.telling).reduce((a, b) => a + b, 0);
  assert.equal(som, INV.items.length);
  assert.ok(INV.telling.toegezegd > 0 && INV.telling['afgewezen-met-grens'] > 0 &&
    INV.telling['vraagt-besluit'] > 0 && INV.telling.extern > 0, 'een klasse is leeg -- dan meet de inventaris niets');
});

test('3. elk item draagt een citaat dat letterlijk op zijn regel staat (onafhankelijk nagelezen)', () => {
  const cache = {};
  for (const it of INV.items) {
    const regels = cache[it.document] || (cache[it.document] = fs.readFileSync(path.join(WORTEL, it.document), 'utf8').split('\n'));
    assert.ok(it.citaat && regels[it.regel - 1].includes(it.citaat),
      it.document + ':' + it.regel + ' -- het citaat staat niet op die regel');
  }
});

test('4. elk geblokkeerd item zegt welke voorwaarde vervuld moet zijn', () => {
  const besluit = JSON.parse(fs.readFileSync(path.join(WORTEL, tk.BESLUITBESTAND), 'utf8'));
  for (const b of besluit.items) {
    if (b.klasse === 'vraagt-besluit' || b.klasse === 'extern') assert.ok(b.voorwaarde && b.voorwaarde.length > 10, b.onderdeel);
    if (b.klasse !== 'toegezegd') assert.ok(b.reden && b.reden.length > 10, b.onderdeel);
  }
});

test('5. de stand wordt streng gelezen: gemengd, doorgestreept of "genomen" is geen stand', () => {
  assert.equal(tk.normaliseerStand('**staat**'), 'staat');
  assert.equal(tk.normaliseerStand('staat (2 sep 2026)'), 'staat');
  assert.equal(tk.normaliseerStand('**een stap weg**'), 'een-stap-weg');
  assert.equal(tk.normaliseerStand('jaren weg'), 'jaren-weg');
  assert.equal(tk.normaliseerStand('**vraagt een besluit**'), 'vraagt-besluit');
  assert.equal(tk.normaliseerStand('een besluit nodig'), 'vraagt-besluit');
  assert.equal(tk.normaliseerStand('staat (zaak) / ontbreekt (lid)'), null);
  assert.equal(tk.normaliseerStand('besluit genomen'), null);
  assert.equal(tk.normaliseerStand('~~een stap weg~~'), null);
  assert.equal(tk.normaliseerStand('gedekt'), null);
  assert.equal(tk.normaliseerStand('bestaat niet'), null);
});

test('6. tabellen en koppen worden gelezen, lopende tekst niet', () => {
  const d = tk.leesDocument('X.md', [
    '| onderdeel | stand |', '|---|---|', '| de brug | **een stap weg** |', '| het anker | gedekt |', '',
    '| # | wat | oordeel |', '|---|---|---|', '| 12 | de wacht | **vraagt een besluit** |', '',
    '## 3. Het mandaat \u2014 **jaren weg**', '',
    'Dit is **staat** in lopende tekst, en dat wordt niet geraden.',
    '```', '| code | **staat** |', '```'
  ].join('\n'));
  assert.deepEqual(d.items.map((i) => [i.regel, i.onderdeel, i.stand, i.klasse]), [
    [3, 'de brug', 'een-stap-weg', 'toegezegd'],
    [8, '12 de wacht', 'vraagt-besluit', 'vraagt-besluit'],
    [10, 'Het mandaat', 'jaren-weg', 'toegezegd']
  ]);
  assert.equal(d.proza, 1);
  assert.equal(d.standOnbekend, 1);
});

/* De ijking: een wegwerpwortel waarin de toets MOET zakken. */
function wegwerp(items) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toezeg-'));
  fs.writeFileSync(path.join(dir, 'A.md'), '| onderdeel | stand |\n|---|---|\n| een ding | **staat** |\n\nEr komt geen `Ding`-object.\n');
  fs.writeFileSync(path.join(dir, tk.BESLUITBESTAND), JSON.stringify({ items }));
  return dir;
}

test('7. ijking: een rot citaat wordt ROT en telt niet mee', () => {
  const dir = wegwerp([
    { document: 'A.md', citaat: 'Er komt geen `Ding`-object.', onderdeel: 'Ding', klasse: 'afgewezen-met-grens', reden: 'de meting rechtvaardigt het niet' },
    { document: 'A.md', citaat: 'Deze zin stond er ooit maar nu niet meer.', onderdeel: 'Weg', klasse: 'afgewezen-met-grens', reden: 'de grond is verdwenen' }
  ]);
  const inv = tk.inventaris(dir);
  assert.equal(inv.rot.length, 1);
  assert.equal(inv.rot[0].onderdeel, 'Weg');
  assert.equal(inv.telling['afgewezen-met-grens'], 1, 'een rot item mag niet stil meetellen');
  assert.equal(inv.telling.toegezegd, 1);
  const { inventarisOordeel } = require('../scripts/appwerkt');
  assert.ok(inventarisOordeel(inv, inv).some((b) => b.startsWith('ROT:')), 'de controle van appwerkt moet op ROT zakken');
});

test('8. ijking: een vijfde klasse en een blokkade zonder voorwaarde worden geweigerd', () => {
  const dir = wegwerp([
    { document: 'A.md', citaat: 'Er komt geen `Ding`-object.', onderdeel: 'Ding', klasse: 'misschien', reden: 'niemand weet het precies' },
    { document: 'A.md', citaat: '| een ding | **staat** |', onderdeel: 'een ding', klasse: 'extern', reden: 'hangt aan een leverancier' }
  ]);
  const inv = tk.inventaris(dir);
  assert.equal(inv.fouten.length, 2);
  assert.ok(inv.fouten[0].includes('buiten de vier'));
  assert.ok(inv.fouten[1].includes('zonder voorwaarde'));
  assert.ok(inv.items.every((i) => Object.prototype.hasOwnProperty.call(tk.KLASSEN, i.klasse)));
});

test('9. het besluitbestand wint op dezelfde regel als een gelezen markering', () => {
  const dir = wegwerp([
    { document: 'A.md', citaat: '| een ding | **staat** |', onderdeel: 'een ding', klasse: 'extern',
      reden: 'hangt aan een leverancier', voorwaarde: 'de leverancier heeft getekend' }
  ]);
  const inv = tk.inventaris(dir);
  assert.equal(inv.items.length, 1);
  assert.equal(inv.items[0].klasse, 'extern');
  assert.equal(inv.items[0].herkomst, 'tabel+besluitbestand');
  assert.equal(inv.geblokkeerd.extern.length, 1);
});

test('10. APPWERKT.json draagt het blok, en alleen met de vier klassen', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'APPWERKT.json'), 'utf8'));
  assert.ok(reg.toezegklassen, 'APPWERKT.json draagt geen blok toezegklassen -- draai npm run appwerkt:inventaris');
  assert.deepEqual(Object.keys(reg.toezegklassen.telling).sort(), Object.keys(tk.KLASSEN).sort());
  assert.ok(reg.toezegklassen.items.every((i) => Object.prototype.hasOwnProperty.call(tk.KLASSEN, i.klasse) && i.citaat));
  assert.deepEqual(reg.toezegklassen.rot, []);
});

test('11. alleen het blok bijwerken laat elk ander veld van APPWERKT.json staan', () => {
  const { metInventaris } = require('../scripts/appwerkt');
  const oud = { uitleg: 'u', stempel: { commit: 'abc' }, defecten: [], regels: [1, 2] };
  const nieuw = metInventaris(oud, { telling: {} });
  assert.deepEqual(Object.keys(nieuw), ['uitleg', 'stempel', 'defecten', 'toezegklassen', 'regels']);
  assert.deepEqual(nieuw.stempel, oud.stempel);
  assert.deepEqual(nieuw.regels, oud.regels);
});
