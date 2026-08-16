/* DE TOESTANDSVINGERAFDRUK: ziet hij een wijziging, en draagt hij geen inhoud?

   Twee vragen, en de tweede is de zwaarste. Een meetinstrument dat gegevens
   meedraagt is zelf een lek -- en dan heeft het instrument dat lekken moest
   vinden er een gemaakt. Er staat hier dus net zo goed een toets op wat er NIET
   in de vingerafdruk mag zitten als op wat hij ziet.

   Draai los: node --test test/vingerafdruk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { vingerafdruk, verschil, gelijk, MAX_RIJEN } = require('../server/lib/vingerafdruk');

/* ---------- ziet hij het? ---------- */

test('een rij erbij verandert het aantal', () => {
  const a = vingerafdruk({ notities: [{ t: 'een' }] });
  const b = vingerafdruk({ notities: [{ t: 'een' }, { t: 'twee' }] });
  const d = verschil(a, b);
  assert.equal(d.aantal, 1);
  assert.equal(d.gewijzigd[0].wat, 'aantal');
  assert.deepEqual(d.collecties, ['notities']);
});

test('een rij WIJZIGEN verandert de hash, ook als het aantal gelijk blijft', () => {
  /* Dit is waarvoor de rij-hashes bestaan. Op alleen een teller zou "een bedrag
     van 10 naar 10.000 zetten" geen wijziging zijn. */
  const a = vingerafdruk({ pay: [{ centen: 10 }] });
  const b = vingerafdruk({ pay: [{ centen: 10000 }] });
  const d = verschil(a, b);
  assert.equal(d.aantal, 1);
  assert.equal(d.gewijzigd[0].wat, 'inhoud');
});

test('diep verstopt telt ook mee', () => {
  const a = vingerafdruk({ x: [{ a: { b: { c: [1, 2] } } }] });
  const b = vingerafdruk({ x: [{ a: { b: { c: [1, 3] } } }] });
  assert.equal(gelijk(a, b), false);
});

test('een object-collectie telt zijn SLEUTELS, en de sleutelnaam telt mee', () => {
  /* Zonder de sleutel in de hash is "de vlag van lid A" niet te onderscheiden
     van "de vlag van lid B" -- twee heel verschillende toestanden. */
  const a = vingerafdruk({ vlaggen: { A: { vast: true } } });
  const b = vingerafdruk({ vlaggen: { B: { vast: true } } });
  assert.equal(gelijk(a, b), false);
  assert.equal(verschil(a, b).gewijzigd[0].wat, 'inhoud');
});

test('de volgorde van rijen is GEEN wijziging', () => {
  /* Anders slaat elke sortering aan als een schrijfactie, en dan meet de proef
     ruis in plaats van gedrag. */
  const a = vingerafdruk({ x: [{ i: 1 }, { i: 2 }, { i: 3 }] });
  const b = vingerafdruk({ x: [{ i: 3 }, { i: 1 }, { i: 2 }] });
  assert.equal(gelijk(a, b), true);
});

test('niets veranderen is niets zien', () => {
  const data = { a: [1, 2], b: { x: 1 } };
  assert.equal(gelijk(vingerafdruk(data), vingerafdruk(data)), true);
  assert.equal(verschil(vingerafdruk(data), vingerafdruk(data)).aantal, 0);
});

/* ---------- de eerste-aanraking ---------- */

test('een LEGE collectie die verschijnt is geen wijziging', () => {
  /* Bijna elke kern doet `if (!db.data.x) db.data.x = []`. De la gaat open bij
     de eerste aanraking, ook als het verzoek daarna met 404 wordt afgewezen.
     Zonder deze regel meldde de staatproef "geweigerd en toch veranderd" over
     routes die niets deden. */
  const a = vingerafdruk({ bestaand: [1] });
  const b = vingerafdruk({ bestaand: [1], nieuweLa: [] });
  assert.equal(gelijk(a, b), true);
});

test('maar zodra er iets IN die la ligt, telt hij gewoon mee', () => {
  const a = vingerafdruk({ bestaand: [1] });
  const b = vingerafdruk({ bestaand: [1], nieuweLa: [{ iets: 1 }] });
  const d = verschil(a, b);
  assert.equal(d.aantal, 1);
  assert.equal(d.gewijzigd[0].wat, 'nieuw');
});

/* ---------- en wat er NIET in mag ---------- */

test('de vingerafdruk draagt geen inhoud, geen sleutels en geen namen', () => {
  const geheim = {
    leden: [{ naam: 'Rahul Imran Ismail', email: 'roellie.i@gmail.com', iban: 'NL91ABNA0417164300' }],
    saldi: { 'rek:lid:abc': 137 }
  };
  const afdruk = vingerafdruk(geheim);
  const tekst = JSON.stringify(afdruk);
  for (const naald of ['Rahul', 'Imran', 'Ismail', 'roellie', 'gmail', 'NL91ABNA', 'rek:lid:abc', 'naam', 'email', 'iban']) {
    assert.equal(tekst.includes(naald), false, 'de vingerafdruk lekt: ' + naald);
  }
  /* Een willekeurige hexhash kan toevallig de drie tekens "137" bevatten;
     zoeken in de hash zelf maakte deze toets ongeveer eens per honderd
     processen rood zonder dat er inhoud lekte. Leg daarom de uitvoervorm
     exact vast en zoek korte waarden alleen buiten de afdrukvelden. */
  assert.deepEqual(Object.keys(afdruk).sort(), ['aantalCollecties', 'collecties', 'zoutId']);
  for (const collectie of Object.values(afdruk.collecties)) {
    assert.deepEqual(Object.keys(collectie).sort(), ['h', 'n']);
    assert.equal(collectie.n, 1);
    assert.match(collectie.h, /^[0-9a-f]{16}$/);
  }
  assert.match(afdruk.zoutId, /^[0-9a-f]{8}$/);
  const zonderAfdrukken = JSON.stringify(afdruk, (sleutel, waarde) =>
    sleutel === 'h' || sleutel === 'zoutId' ? '<afdruk>' : waarde);
  assert.equal(zonderAfdrukken.includes('137'), false, 'de vingerafdruk lekt de saldo-inhoud buiten een hash');
  // wat er WEL in staat: de collectienaam en een aantal
  assert.ok(tekst.includes('leden'));
  assert.ok(tekst.includes('saldi'));
});

test('het verschil noemt collectienamen en getallen, nooit inhoud', () => {
  const a = vingerafdruk({ leden: [{ naam: 'Rahul' }] });
  const b = vingerafdruk({ leden: [{ naam: 'Rahul' }, { naam: 'Imran' }] });
  const tekst = JSON.stringify(verschil(a, b));
  assert.equal(tekst.includes('Rahul'), false);
  assert.equal(tekst.includes('Imran'), false);
  assert.ok(tekst.includes('leden'));
});

test('twee processen geven verschillende hashes over dezelfde data', () => {
  /* Het zout wordt per proces getrokken. Daardoor is een hash uit een logregel
     van vorige week nergens meer mee te vergelijken -- en een ongezouten hash
     over een klein waardebereik (een bedrag, een ja/nee) is gewoon terug te
     rekenen met een woordenboek. */
  const { execFileSync } = require('child_process');
  const code = "const v=require('./server/lib/vingerafdruk');" +
    "console.log(v.vingerafdruk({x:[{a:1}]}).collecties.x.h)";
  const een = execFileSync(process.execPath, ['-e', code], { encoding: 'utf8', cwd: __dirname + '/..' }).trim();
  const twee = execFileSync(process.execPath, ['-e', code], { encoding: 'utf8', cwd: __dirname + '/..' }).trim();
  assert.notEqual(een, twee, 'zonder zout per proces is de hash een woordenboekaanval waard');
  assert.match(een, /^[0-9a-f]{16}$/);
});

/* ---------- de grenzen, hardop ---------- */

test('een collectie boven de rijgrens krijgt h:null met een reden, geen verzonnen hash', () => {
  const groot = new Array(MAX_RIJEN + 1).fill(0).map((_, i) => ({ i }));
  const v = vingerafdruk({ groot });
  assert.equal(v.collecties.groot.h, null);
  assert.equal(v.collecties.groot.n, MAX_RIJEN + 1);
  assert.match(v.collecties.groot.reden, /rijgrens/);
});

test('en zo een collectie telt als ONMEETBAAR, niet als ongewijzigd', () => {
  /* De val is dat "geen hash" leest als "geen verschil". Dan verdwijnt precies
     de grootste collectie stil uit het zicht. */
  const groot = new Array(MAX_RIJEN + 1).fill(0).map((_, i) => ({ i }));
  const a = vingerafdruk({ groot });
  const b = vingerafdruk({ groot });
  const d = verschil(a, b);
  assert.equal(d.onmeetbareCollecties, 1);
  assert.equal(d.aantal, 0, 'op het AANTAL is hij nog wel te beoordelen');
});

test('interne velden blijven buiten de vingerafdruk', () => {
  const v = vingerafdruk({ __schema: 1, echt: [1] });
  assert.equal(v.collecties.__schema, undefined);
  assert.equal(v.aantalCollecties, 1);
});
