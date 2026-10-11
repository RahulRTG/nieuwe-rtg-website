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

/* ---------------------------------------------------------------------------
   RONDE 2 (11 oktober 2026, AFBOUWPROGRAMMA.md par. 6a, 7a en bijlage A).
   --------------------------------------------------------------------------- */
const as2 = require('../scripts/lib/toezegsoort');

test('12. een legenda is geen onderdeel; een tabel met een betekeniskolom en de stand achteraan wel', () => {
  const d = tk.leesDocument('X.md', [
    '| bak | betekenis |', '|---|---|', '| **staat** | het draait |', '| **vraagt een besluit** | het kan, maar |', '',
    '| dimensie | betekenis | stand |', '|---|---|---|', '| **werkrol** | wat iemand doet | staat |'
  ].join('\n'));
  assert.equal(d.legenda, 2);
  assert.deepEqual(d.items.map((i) => [i.regel, i.onderdeel, i.klasse]), [[8, 'werkrol', 'toegezegd']]);
});

test('13. een rij die zichzelf afwijst is geen toezegging, en een voorwaarde blijft toegezegd', () => {
  const d = tk.leesDocument('X.md', [
    '| # | punt | stand | wat |', '|---|---|---|---|',
    '| 50 | Edge als runtime surface | jaren weg | Als engine of autoriteit komt hij er niet: dat botst met grens 1. |',
    '| 17 | record → replay | **jaren** | vraagt productie, en botst met de bewaartermijnen |',
    '| 116 | één design runtime | een stap weg | voeden, niet bouwen; er komt geen zevende |'
  ].join('\n'));
  assert.deepEqual(d.items.map((i) => [i.regel, i.klasse]), [[3, 'afgewezen-met-grens'], [4, 'afgewezen-met-grens'], [5, 'toegezegd']]);
  assert.ok(/komt hij er niet/.test(d.items[0].reden), 'de reden is de zin met de afwijzing');
  /* En op de echte documenten: precies de twee rijen die de opdracht noemde. */
  const echt = INV.items.filter((i) => /\+afwijzing$/.test(i.herkomst)).map((i) => i.document);
  assert.deepEqual(echt.sort(), ['EDGE.md', 'VERANDERING.md']);
});

test('14. de soort is gesloten, onbepaald staat apart en wordt nooit opgeteld', () => {
  assert.deepEqual(Object.keys(as2.SOORTEN).sort(), ['eis', 'functie', 'integratie', 'product']);
  assert.equal(as2.soortVan('Elke weigering is verklaarbaar').soort, 'eis');
  assert.equal(as2.soortVan('wens → case').soort, 'integratie');
  assert.equal(as2.soortVan('21 Work deck').soort, 'product');
  assert.equal(as2.soortVan('Proof Cache').soort, 'functie');
  assert.equal(as2.soortVan('Brug scherm → route').soort, 'onbepaald', 'twee regels die elkaar tegenspreken zijn onbepaald, nooit een keuze');
  assert.equal(as2.soortVan('employment.js verwees naar een bestand').soort, 'onbepaald');
  assert.equal(as2.soortVan('Wanbetaling is een standenmachine').soort, 'onbepaald');
  for (const it of INV.items) assert.ok(it.soortGrond, it.document + ':' + it.regel + ' heeft geen soortGrond');
  const soorten = Object.values(INV.soortTelling).reduce((a, b) => a + b, 0);
  assert.equal(soorten + INV.onbepaald, INV.items.length);
  assert.equal(INV.onbepaald, INV.items.filter((i) => i.soort === 'onbepaald').length);
  assert.ok(!('onbepaald' in INV.soortTelling), 'onbepaald hoort niet tussen de soorten te staan');
});

test('15. besloten elders: de bron moet letterlijk staan, en besloten is geen vijfde klasse', () => {
  const ok = (bron) => [{ document: 'A.md', citaat: '| een ding | **staat** |', onderdeel: 'een ding', klasse: 'toegezegd',
    reden: 'het besluit staat in B.md', besloten: bron }];
  const dir = wegwerp(ok({ document: 'B.md', citaat: 'Besluit 1 is genomen: bouwen.', datum: '2026-10-11' }));
  fs.writeFileSync(path.join(dir, 'B.md'), '# B\n\nBesluit 1 is genomen: bouwen.\n');
  let inv = tk.inventaris(dir);
  assert.equal(inv.beslotenElders, 1);
  assert.equal(inv.items[0].besloten.regel, 3);
  assert.deepEqual(Object.keys(inv.telling).sort(), Object.keys(tk.KLASSEN).sort());
  fs.writeFileSync(path.join(dir, 'B.md'), '# B\n\nHet besluit is weer open.\n');
  inv = tk.inventaris(dir);
  assert.equal(inv.rot.length, 1, 'een besluit zonder vindbare bron is een bewering en telt niet');
  assert.ok(inv.rot[0].reden.startsWith('de BRON'));
  const fout = wegwerp([{ document: 'A.md', citaat: '| een ding | **staat** |', onderdeel: 'een ding', klasse: 'vraagt-besluit',
    reden: 'tegelijk open en besloten', voorwaarde: 'iets dat vervuld moet zijn', besloten: { document: 'A.md', citaat: '| een ding | **staat** |', datum: '2026-10-11' } }]);
  assert.ok(tk.inventaris(fout).fouten.some((f) => f.includes('besloten en tegelijk vraagt-besluit')));
  /* Een markering die zichzelf als besluitbron citeert, is een herschreven rij
     en geen besluit (tegenlezer ronde 2). */
  const kring = wegwerp(ok({ document: 'A.md', citaat: '| een ding | **staat** |', datum: '2026-10-11' }));
  const ki = tk.inventaris(kring);
  assert.equal(ki.beslotenElders, 0);
  assert.ok(ki.fouten.some((f) => f.includes('eigen regel van de markering')));
});

test('16. de vingerafdruk ziet afdrukken en levende getallen niet, een echt document wel', () => {
  const dir = wegwerp([]);
  fs.writeFileSync(path.join(dir, 'BEWIJS.md'), '# afdruk\n');
  fs.writeFileSync(path.join(dir, 'R.md'), '# Rapport\n\n_Automatisch geschreven door een script. Niet met de hand bijwerken._\n');
  const a = tk.inventaris(dir);
  assert.deepEqual(a.bron.afdrukkenUitgesloten, ['BEWIJS.md', 'R.md']);
  fs.writeFileSync(path.join(dir, 'BEWIJS.md'), '# afdruk, opnieuw geschreven\n');
  fs.writeFileSync(path.join(dir, 'R.md'), '# Rapport\n\n_Automatisch geschreven door een script. Niet met de hand bijwerken._\n\nnieuw\n');
  fs.appendFileSync(path.join(dir, 'A.md'), '\nTotaal <!--getal:x.y-->12<!--/getal--> stuks.\n');
  const b = tk.inventaris(dir);
  fs.writeFileSync(path.join(dir, 'A.md'), fs.readFileSync(path.join(dir, 'A.md'), 'utf8').replace('-->12<', '-->13<'));
  assert.equal(tk.inventaris(dir).bron.vingerafdruk, b.bron.vingerafdruk, 'een levend getal mag het blok niet laten verouderen');
  assert.notEqual(b.bron.vingerafdruk, a.bron.vingerafdruk, 'een echt document moet het blok wel laten verouderen');
  fs.writeFileSync(path.join(dir, 'BEWIJS.md'), '# nog een afdruk\n');
  assert.equal(tk.inventaris(dir).bron.vingerafdruk, b.bron.vingerafdruk, 'een afdruk mag het blok niet laten verouderen');
});

test('17. elk open besluit staat in bijlage A, onder zijn document en onderdeel', () => {
  const tekst = fs.readFileSync(path.join(WORTEL, 'AFBOUWPROGRAMMA.md'), 'utf8');
  const i = tekst.indexOf('## Bijlage A.');
  assert.ok(i > 0, 'AFBOUWPROGRAMMA.md heeft geen bijlage A');
  const bijlage = tekst.slice(i);
  const mist = INV.items.filter((it) => it.klasse === 'vraagt-besluit')
    .filter((it) => !bijlage.includes(it.document + ': ' + it.onderdeel)).map((it) => it.document + ': ' + it.onderdeel);
  assert.deepEqual(mist, [], 'een open besluit staat niet in de bijlage voor de eigenaar');
});

test('18. de voorzieningen bestaan, en een rij zonder verwijzing krijgt er geen', () => {
  assert.deepEqual(as2.voorzieningenVan('zie `server/kern/stuur/mandaat.js` en `lib/keten.js`, plus de ritproef'),
    ['kern/stuur', 'keten:ritproef', 'lib/keten']);
  assert.deepEqual(as2.voorzieningenVan('| een ding | **staat** | niets genoemd |'), []);
  const weg = INV.voorzieningen.groepen.filter((g) => !g.bestaat).map((g) => g.voorziening);
  assert.deepEqual(weg, [], 'een rij noemt een voorziening die niet in de boom staat');
  assert.equal(INV.voorzieningen.metVoorziening + INV.voorzieningen.zonderVoorziening, INV.items.length);
});

test('19. npm run check stelt de versheidsvraag zelf (regel 76), met dezelfde functie, en het blok is vers', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'check.js'), 'utf8');
  assert.ok(/76\) de inventaris van toezeggingen/.test(bron) && /tk\.oordeel\(reg\.toezegklassen, vers\)/.test(bron),
    'scripts/check.js hoort regel 76 te dragen en toezegklassen.oordeel aan te roepen');
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'APPWERKT.json'), 'utf8'));
  assert.deepEqual(tk.oordeel(reg.toezegklassen, INV), [], 'het blok loopt achter -- draai npm run appwerkt:inventaris');
});
