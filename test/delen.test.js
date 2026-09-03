/* DE SUITE IN DELEN, EN DE VLOER DAAROVERHEEN.

   Sinds de CI de unit-suite en de schermtoetsen over vier runners verdeelt,
   hangen er twee nieuwe manieren aan waarop deze keten stil minder kan gaan
   toetsen dan hij belooft:

   1. EEN BESTAND DAT IN GEEN ENKEL DEEL VALT. Vier groene delen, en niemand die
      merkt dat toets 700 nergens meer draait. Daarom: de delen samen zijn de
      hele lijst, en ze overlappen nergens.
   2. EEN VLOER DIE PER DEEL REKENT. --test-coverage-lines rekent per proces; met
      vier delen haalt geen enkel deel de vloer, en wie hem dan verlaagt tot een
      kwart hem haalt, heeft een vloer die niets meer bewaakt.
      scripts/dekkingsvloer.js telt de delen eerst op. Hier staat dat hij dat
      echt doet -- en dat hij weigert te oordelen als er niets te tellen valt.

   MUTATIES die zijn gedraaid (LAT.md regel 2):
   - `i % totaal === nr - 1` veranderd in `i % totaal === nr`
     -> "de delen samen zijn de hele lijst" ZAKT (RAAK)
   - in voegSamen() de DA-teller laten overschrijven in plaats van optellen
     -> "een regel die in het ene deel geraakt is, telt" ZAKT (RAAK)
   - de lege-invoer-controle uit dekkingsvloer.js gehaald
     -> "geen lcov is geen honderd procent" ZAKT (RAAK)

   Los: node --test test/delen.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { ontleedDeel, verdeel, indeling, zetDuren } = require('../scripts/lib/delen');
const { IJKINGEN, KORT } = require('../scripts/lib/ijkingen');
const vloer = require('../scripts/dekkingsvloer');

test('--deel neemt alleen N/M met 1 <= N <= M', () => {
  assert.deepEqual(ontleedDeel('2/4'), { nr: 2, totaal: 4 });
  assert.equal(ontleedDeel('0/4'), null);
  assert.equal(ontleedDeel('5/4'), null);
  assert.equal(ontleedDeel('2'), null);
  assert.equal(ontleedDeel(''), null);
  assert.equal(ontleedDeel('2/4 '), null);
});

test('de delen samen zijn de hele lijst, en ze overlappen nergens', () => {
  for (const totaal of [2, 3, 4, 7]) {
    for (const lengte of [0, 1, 5, 139, 973]) {
      const lijst = Array.from({ length: lengte }, (_, i) => 'toets-' + i + '.test.js');
      const delen = [];
      for (let nr = 1; nr <= totaal; nr++) delen.push(verdeel(lijst, { nr, totaal }));
      const samen = delen.flat();
      assert.equal(samen.length, lengte, `${lengte} bestanden over ${totaal} delen: er raakt er een kwijt`);
      assert.equal(new Set(samen).size, lengte, 'geen enkel bestand hoort in twee delen');
      assert.deepEqual([...samen].sort(), [...lijst].sort());
      /* En evenwichtig: het grootste en het kleinste deel schelen hoogstens een. */
      const maten = delen.map(d => d.length);
      assert.ok(Math.max(...maten) - Math.min(...maten) <= 1, 'de delen lopen te ver uiteen: ' + maten.join('/'));
    }
  }
});

test('zonder --deel draait alles, en de lijst blijft ongemoeid', () => {
  const lijst = ['a', 'b', 'c'];
  assert.deepEqual(verdeel(lijst, null), lijst);
  assert.notEqual(verdeel(lijst, null), lijst, 'een kopie, zodat de aanroeper niet per ongeluk de bron sorteert');
});

/* Twee kleine lcov-bestanden die dezelfde bron uit twee delen beschrijven: in
   deel 1 is regel 10 geraakt en regel 11 niet, in deel 2 andersom. Samen is dat
   twee van de twee, en dat is precies wat er vroeger in een proces gebeurde. */
const DEEL_EEN = ['TN:', 'SF:server/proef.js', 'FN:10,alfa', 'FN:20,beta',
  'FNDA:3,alfa', 'FNDA:0,beta', 'DA:10,3', 'DA:11,0',
  'BRDA:10,0,0,1', 'BRDA:10,0,1,-', 'end_of_record'].join('\n');
const DEEL_TWEE = ['TN:', 'SF:server/proef.js', 'FN:10,alfa', 'FN:20,beta',
  'FNDA:0,alfa', 'FNDA:5,beta', 'DA:10,0', 'DA:11,7',
  'BRDA:10,0,0,-', 'BRDA:10,0,1,2', 'end_of_record'].join('\n');

test('een regel die in het ene deel geraakt is, telt ook als het andere deel hem miste', () => {
  const kaart = vloer.voegSamen(new Map(), DEEL_EEN);
  vloer.voegSamen(kaart, DEEL_TWEE);
  const uit = vloer.tel(kaart);
  assert.equal(uit.bestanden, 1, 'hetzelfde bronbestand uit twee delen is een bestand');
  assert.deepEqual(uit.ruw.regels, [2, 2], 'beide regels geraakt, elk in een ander deel');
  assert.deepEqual(uit.ruw.functies, [2, 2], 'beide functies aangeroepen, elk in een ander deel');
  assert.deepEqual(uit.ruw.takken, [2, 2], 'beide takken genomen, elk in een ander deel');
  assert.equal(uit.regels, 100);
});

test('een deel alleen haalt de honderd niet -- dat is het hele punt', () => {
  const alleen = vloer.tel(vloer.voegSamen(new Map(), DEEL_EEN));
  assert.equal(alleen.regels, 50);
  assert.equal(alleen.functies, 50);
});

test('geen lcov is geen honderd procent maar een fout', () => {
  const leeg = fs.mkdtempSync(path.join(os.tmpdir(), 'vloer-leeg-'));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'dekkingsvloer.js'), leeg],
      { encoding: 'utf8' });
    assert.equal(r.status, 1, 'een lege map hoort te zakken, niet te slagen');
    assert.match(r.stderr, /Geen lcov-gegevens/);
  } finally {
    fs.rmSync(leeg, { recursive: true, force: true });
  }
});

test('de vloeren staan waar de meting ze zette', () => {
  assert.deepEqual(vloer.VLOER, { regels: 70, takken: 67, functies: 47 });
});

/* DE DERDE MANIER WAAROP DEZE KETEN STIL MINDER KAN TOETSEN, en de reden dat
   deze toets bestaat. De zes bronmuterende ijkingen worden sinds 27 augustus
   2026 UIT de delen gelaten (--zonder-ijkingen) en krijgen elk een eigen job in
   ci.yml. Dat zijn twee plekken die hetzelfde moeten zeggen. Loopt de matrix
   achter op de lijst, dan is de nieuwe ijking uit de delen gehaald zonder dat
   er een job voor is -- hij draait dan NERGENS, en alle jobs zijn groen.

   MUTATIE (LAT.md regel 2): een naam uit de matrix in ci.yml weggehaald
   -> "elke ijking heeft een eigen job in de keten" ZAKT (RAAK). */
test('elke ijking heeft een eigen job in de keten', () => {
  const yml = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');
  const regel = /^\s*ijking:\s*\[([^\]]+)\]\s*$/m.exec(yml);
  assert.ok(regel, 'ci.yml heeft geen matrix `ijking: [...]`; dan draait geen enkele ijking meer');
  const inKeten = regel[1].split(',').map(x => x.trim()).filter(Boolean).sort();
  assert.deepEqual(inKeten, [...KORT].sort(),
    'de matrix in ci.yml en scripts/lib/ijkingen.js zeggen niet hetzelfde: ' +
    inKeten.join(', ') + '  vs  ' + KORT.join(', '));
  /* En de bestanden moeten ook echt bestaan -- een ijking die hernoemd is en in
     beide lijsten netjes meeverhuisde, maar niet op schijf staat, geeft een
     groene job over nul toetsen. */
  for (const naam of IJKINGEN) {
    assert.ok(fs.existsSync(path.join(__dirname, naam)), 'ijking ontbreekt op schijf: ' + naam);
  }
});

/* ---- DE GEWOGEN VERDELING (1 september 2026) ----

   De verdeling ging van "om en om over de gesorteerde lijst" naar "zwaarste
   eerst, naar het lichtste deel", op de gemeten duur uit TOETSDUUR.json. Dat
   maakt de verdeling afhankelijk van een REGISTER, en daarmee komen er twee
   nieuwe manieren bij waarop deze keten stil minder kan toetsen dan hij belooft:

   3. EEN BESTAND DAT NIET IN HET REGISTER STAAT. Elke nieuwe toets is dat, en
      als de weging hem overslaat draait hij nergens terwijl vier delen groen
      melden. Hij hoort om en om verdeeld te worden, nooit weggelaten.
   4. EEN ONTBREKEND OF KAPOT REGISTER. Dan is alles ongemeten, en dan hoort
      deze functie zich exact te gedragen zoals hij zich altijd heeft gedragen:
      trager, nooit stiller.

   MUTATIES die zijn gedraaid (LAT.md regel 2):
   - de ongemeten-lus uit indeling() gehaald
     -> "een bestand zonder gewicht valt nooit buiten de boot" ZAKT (RAAK)
   - het lichtste deel gekozen met `>` in plaats van `<` (dus het zwaarste)
     -> "de zwaarste bestanden komen niet bij elkaar" ZAKT (RAAK) */

/* Een weging waarin een van de bestanden alles domineert: zonder weging komt
   hij samen met drie andere in deel 1 en is dat deel vier keer zo zwaar. */
const WEGING = {
  'zwaar.test.js': 100000,
  'middel-a.test.js': 20000, 'middel-b.test.js': 20000, 'middel-c.test.js': 20000,
  'licht-a.test.js': 1000, 'licht-b.test.js': 1000, 'licht-c.test.js': 1000, 'licht-d.test.js': 1000
};
const ALLE = Object.keys(WEGING).sort();

test('de zwaarste bestanden komen niet bij elkaar in een deel', () => {
  zetDuren(WEGING);
  try {
    const bakken = indeling(ALLE, 4);
    const last = bakken.map(b => b.reduce((s, n) => s + WEGING[n], 0));
    /* De som is 164.000, dus het ideaal is 41.000. Zonder weging zou het
       zwaarste deel 103.000 zijn (zwaar + drie lichte, op alfabet). */
    assert.equal(last.reduce((a, b) => a + b, 0), 164000);
    assert.ok(Math.max(...last) <= 100000 * 1.05,
      'het zwaarste deel draagt meer dan het zwaarste BESTAND: ' + last.join('/'));
    /* En het zwaarste bestand ligt alleen: er kan niets meer bij zonder het
       kritieke pad te verlengen. */
    const bakVanZwaar = bakken.find(b => b.includes('zwaar.test.js'));
    assert.deepEqual(bakVanZwaar, ['zwaar.test.js']);
  } finally { zetDuren(null); }
});

test('een bestand zonder gewicht valt nooit buiten de boot', () => {
  zetDuren(WEGING);
  try {
    /* Vier nieuwe toetsen die nog nooit hebben gedraaid, tussen de gemeten. */
    const nieuw = ['nieuw-1.test.js', 'nieuw-2.test.js', 'nieuw-3.test.js', 'nieuw-4.test.js'];
    const lijst = [...ALLE, ...nieuw].sort();
    const bakken = indeling(lijst, 4);
    const samen = bakken.flat();
    assert.equal(samen.length, lijst.length, 'er raakt er een kwijt');
    assert.equal(new Set(samen).size, lijst.length, 'geen enkel bestand in twee delen');
    for (const n of nieuw) {
      assert.equal(bakken.filter(b => b.includes(n)).length, 1, n + ' zit niet in precies een deel');
    }
    /* En ze liggen verspreid, niet allemaal op een hoop. */
    assert.equal(new Set(nieuw.map(n => bakken.findIndex(b => b.includes(n)))).size, 4,
      'vier ongemeten bestanden horen over vier delen, niet in een');
  } finally { zetDuren(null); }
});

test('zonder register gedraagt de verdeling zich als vroeger: om en om', () => {
  zetDuren({});
  try {
    const lijst = Array.from({ length: 9 }, (_, i) => 'toets-' + i + '.test.js');
    const bakken = indeling(lijst, 4);
    assert.deepEqual(bakken[0], ['toets-0.test.js', 'toets-4.test.js', 'toets-8.test.js']);
    assert.deepEqual(bakken[1], ['toets-1.test.js', 'toets-5.test.js']);
    assert.deepEqual(bakken.flat().length, 9);
  } finally { zetDuren(null); }
});

test('dezelfde invoer geeft altijd dezelfde verdeling, ook bij een gelijk gewicht', () => {
  zetDuren({ 'a.test.js': 500, 'b.test.js': 500, 'c.test.js': 500, 'd.test.js': 500 });
  try {
    const eerst = indeling(['a.test.js', 'b.test.js', 'c.test.js', 'd.test.js'], 2);
    const nogeens = indeling(['d.test.js', 'c.test.js', 'b.test.js', 'a.test.js'], 2);
    assert.deepEqual(eerst, nogeens,
      'de uitkomst hangt van de invoerVOLGORDE af; dan verdeelt de ene scherf anders dan de andere');
  } finally { zetDuren(null); }
});

/* scripts/a11y.js verdeelt SCHERMEN met dezelfde functie, en die staan per
   definitie niet in een toetsduurregister. Ze horen dus onveranderd om en om te
   worden verdeeld -- anders zou een weging voor de unit-suite stilletjes de
   a11y-ronde herschikken, en dat is precies het soort gevolg dat je pas ziet
   als een deel omvalt. */
test('een lijst die geen toetsbestanden bevat (a11y-schermen) blijft om en om', () => {
  const paginas = ['/apps/app.html', '/apps/bank.html', '/apps/cel.html',
    '/apps/dok.html', '/apps/eten.html'];
  const bakken = indeling(paginas, 2);
  assert.deepEqual(bakken[0], ['/apps/app.html', '/apps/cel.html', '/apps/eten.html']);
  assert.deepEqual(bakken[1], ['/apps/bank.html', '/apps/dok.html']);
});

/* DE ZWAARSTE SCHATTING VOOR EEN ONGEMETEN BESTAND (1 september 2026).

   Deze regel komt uit scripts/scherf.js, dat tot 28 augustus 2026 in ci.yml
   stond. Een nieuw toetsbestand heeft nog geen gewicht, en de gok die je dan
   maakt bepaalt de wandklok: nul of het gemiddelde laten de keten SNELLER
   lijken dan hij is, en dan staat er een scherf een half uur alleen na te
   hijgen. Een hoge gok is de andere kant op -- onbekend telt als duur. Dat is
   de hoofdregel van KEURING.md in een regel code.

   HOE HOOG PRECIES is sindsdien twee keer veranderd, en dat staat NIET meer in
   deze toets: eerst het maximum, toen de p99 over alles, nu de p99 van de eigen
   klasse. Deze toets zegt alleen nog dat de gok naar BOVEN gaat; welke prijs
   het precies wordt en waarom, staat in scripts/lib/duurprijs.js met
   test/duurprijs.test.js ernaast. Twee plekken die allebei een prijs bewaken,
   lopen uit elkaar (LAT.md regel 4) -- deze bewaakt de richting, die de hoogte.

   MUTATIE (LAT.md regel 2): `gewicht.get(naam) || prijsVoor(naam)` vervangen
   door `gewicht.get(naam) || 0`
   -> "een ongemeten bestand telt als duur" ZAKT (RAAK). */
test('een ongemeten bestand telt als duur, niet als nul', () => {
  /* DE OPSTELLING IS AANGEPAST OMDAT DE OUDE NIET KON ZAKKEN, en dat is pas
     gebleken toen de mutatie hierboven werd gedraaid. Er stonden drie bestanden
     in twee bakken (zwaar 100.000, licht 1.000, ongemeten). Bij welke prijs dan
     ook -- de p99, het minimum, nul -- gaat het zwaarste bestand in zijn eentje,
     want de greedy legt het eerste bestand in een lege bak en alles daarna in de
     andere. De bewering "hij kruipt niet bij de zwaarste" was dus waar door de
     vorm van de proef en niet door de regel. Precies wat scripts/tandeloos.js
     telt.

     Drie bijna even zware bestanden in twee bakken laat de prijs wel meetellen:
     100 / 60 / 60 vult beide bakken tot 100 en 120, en dan beslist de prijs van
     het ongemeten bestand of hij nog bij de zwaarste past. */
  zetDuren({ 'zwaar.test.js': 100, 'licht-a.test.js': 60, 'licht-b.test.js': 60 });
  try {
    const bakken = indeling(
      ['zwaar.test.js', 'licht-a.test.js', 'licht-b.test.js', 'nieuw.test.js'], 2);
    const metZwaar = bakken.find(b => b.includes('zwaar.test.js'));
    assert.ok(!metZwaar.includes('nieuw.test.js'),
      'een ongemeten bestand kruipt bij de zwaarste; dan is de gok naar beneden gedaan');
  } finally { zetDuren(null); }
});

/* ===========================================================================
   HET KOSTENMODEL, EN HOEVEEL HET WAARD IS.

   Dit blok komt uit een fout die hier echt is gemaakt en die van binnen
   PERFECT oogde. TOETSDUUR.json was lokaal gemeten, zonder dekking, op vier
   kernen; de keten draait op een runner MET dekking. De verdeler deed precies
   wat hem gevraagd was en meldde 1,00x op zijn eigen projectie -- en de
   werkelijke ronde liep 1348s tegen 526s uit elkaar. Een verdeling op het
   verkeerde kostenmodel ziet er niet verkeerd uit; hij is alleen verkeerd.

   Vandaar drie beweringen: de modus wordt gelezen, een andere modus is
   BRUIKBAAR MAAR NIET VERTROUWD, en dat wantrouwen heeft een gevolg dat je kunt
   zien -- anders is het een woord in een JSON-veld.
   =========================================================================== */
const fs2 = require('node:fs');
const os2 = require('node:os');
const path2 = require('node:path');

/* Een register op schijf neerzetten waar delen.js hem zoekt, en netjes
   terugzetten. Zonder dit toetst dit blok de opgelegde weging in plaats van
   het lezen ervan, en juist het LEZEN ging fout. */
function metRegister(inhoud, fn) {
  const REG = require('../scripts/lib/delen').REGISTER;
  let oud = null, bestond = false;
  try { oud = fs2.readFileSync(REG); bestond = true; } catch (e) { /* geen register */ }
  const oudeModus = process.env.RTG_TOETSMODUS;
  try {
    fs2.writeFileSync(REG, JSON.stringify(inhoud));
    zetDuren(null);
    return fn();
  } finally {
    if (bestond) fs2.writeFileSync(REG, oud); else { try { fs2.unlinkSync(REG); } catch (e) {} }
    if (oudeModus === undefined) delete process.env.RTG_TOETSMODUS;
    else process.env.RTG_TOETSMODUS = oudeModus;
    zetDuren(null);
  }
}

const { weging } = require('../scripts/lib/delen');

test('de gevraagde modus wordt gelezen, en niet die van de buurman', () => {
  const reg = { versie: 2, modi: {
    normaal: { duur: { 'a.test.js': 1000, 'b.test.js': 2000 } },
    dekking: { duur: { 'a.test.js': 9000, 'b.test.js': 1000 } }
  } };
  metRegister(reg, () => {
    process.env.RTG_TOETSMODUS = 'dekking';
    zetDuren(null);
    const w = weging(['a.test.js', 'b.test.js']);
    assert.equal(w.modus, 'dekking', 'de dekkingsmodus hoort gelezen te worden');
    assert.equal(w.vertrouwen, 'geldig');
    /* Onder dekking is a het zwaarst, onder normaal is b dat. Leest hij de
       verkeerde modus, dan komt de verkeerde eerst en zakt deze bewering. */
    const bakken = indeling(['a.test.js', 'b.test.js'], 2);
    assert.ok(bakken[0].includes('a.test.js'),
      'het zwaarste bestand VAN DEZE MODUS hoort als eerste geplaatst te worden');
  });
});

test('een andere modus is bruikbaar maar niet vertrouwd', () => {
  const reg = { versie: 2, modi: { normaal: { duur: { 'a.test.js': 1000 } } } };
  metRegister(reg, () => {
    process.env.RTG_TOETSMODUS = 'dekking';
    zetDuren(null);
    const w = weging(['a.test.js']);
    assert.equal(w.vertrouwen, 'twijfelachtig',
      'gewichten uit een andere modus mogen nooit als geldig doorgaan');
    assert.equal(w.modus, 'normaal', 'en er hoort bij te staan WELKE modus het dan was');
  });
});

test('een register van voor de modi telt als een andere modus, niet als geldig', () => {
  metRegister({ duur: { 'a.test.js': 1000 } }, () => {
    process.env.RTG_TOETSMODUS = 'normaal';
    zetDuren(null);
    /* Versie 1 droeg geen modus. Hem stilzwijgend als `normaal` aannemen is
       precies de gok die de hele fout veroorzaakte. */
    assert.equal(weging(['a.test.js']).vertrouwen, 'twijfelachtig');
  });
});

test('zonder register is er geen weging om te vertrouwen', () => {
  const REG = require('../scripts/lib/delen').REGISTER;
  let oud = null, bestond = false;
  try { oud = fs2.readFileSync(REG); bestond = true; } catch (e) {}
  try {
    try { fs2.unlinkSync(REG); } catch (e) {}
    zetDuren(null);
    assert.equal(weging(['a.test.js']).vertrouwen, 'ongeldig');
  } finally {
    if (bestond) fs2.writeFileSync(REG, oud);
    zetDuren(null);
  }
});

test('bij twijfel begrenst de marge hoeveel bestanden een scherf krijgt', () => {
  /* Een gewicht dat er faliekant naast zit: een bestand dat honderd keer zo
     zwaar LIJKT trekt bij pure weging alle andere naar de overkant. Klopt dat
     gewicht niet, dan staat er een scherf met een handvol bestanden naast een
     scherf met de rest. De marge bindt dat: bij twijfel nooit meer dan zijn
     deel. */
  const reg = { versie: 2, modi: { normaal: { duur: {
    'zwaar.test.js': 100000, 'a.test.js': 10, 'b.test.js': 10, 'c.test.js': 10
  } } } };
  const lijst = ['zwaar.test.js', 'a.test.js', 'b.test.js', 'c.test.js'];

  const zonderMarge = metRegister(reg, () => {
    process.env.RTG_TOETSMODUS = 'normaal';       // geldig -> geen marge
    zetDuren(null);
    assert.equal(weging(lijst).vertrouwen, 'geldig');
    return indeling(lijst, 2).map((b) => b.length).sort();
  });
  const metMarge = metRegister(reg, () => {
    process.env.RTG_TOETSMODUS = 'dekking';       // twijfelachtig -> marge
    zetDuren(null);
    assert.equal(weging(lijst).vertrouwen, 'twijfelachtig');
    return indeling(lijst, 2).map((b) => b.length).sort();
  });

  assert.deepEqual(zonderMarge, [1, 3], 'bij een vertrouwd gewicht mag een scherf gerust klein zijn');
  assert.deepEqual(metMarge, [2, 2], 'bij twijfel hoort geen scherf meer dan zijn deel te krijgen');
});

test('de marge laat nooit een bestand vallen', () => {
  /* De gevaarlijkste manier waarop een plafond fout gaat: alles zit vol en het
     laatste bestand komt nergens meer terecht. Volledigheid gaat voor de
     marge, altijd. */
  const reg = { versie: 2, modi: { normaal: { duur: { 'a.test.js': 5 } } } };
  metRegister(reg, () => {
    process.env.RTG_TOETSMODUS = 'dekking';
    zetDuren(null);
    const lijst = ['a.test.js', 'b.test.js', 'c.test.js', 'd.test.js', 'e.test.js'];
    const bakken = indeling(lijst, 2);
    assert.deepEqual([].concat(...bakken).sort(), [...lijst].sort(),
      'elk bestand hoort in precies een scherf te zitten');
  });
});

test('de terugval kiest de modus die DEZE bestanden kent, niet de eerste op naam', () => {
  /* Dit is een echte regressie die bijna is doorgeglipt. Toen e2e.js zijn eigen
     modus (`normaal`) ging declareren, bestond die nog niet in het register.
     De terugval pakte toen op naamvolgorde `dekking` -- 1259 unit-bestanden en
     GEEN ENKEL e2e-bestand -- terwijl er een modus naast lag die ze allemaal
     kende. De schermtoetsen waren daarmee in een klap ongewogen. */
  const reg = { versie: 2, modi: {
    dekking: { duur: { 'unit-a.test.js': 5000, 'unit-b.test.js': 5000 } },
    onbekend: { duur: { 'scherm-a.e2e.js': 900, 'scherm-b.e2e.js': 100 } }
  } };
  metRegister(reg, () => {
    process.env.RTG_TOETSMODUS = 'normaal';   // bestaat niet -> terugval
    zetDuren(null);
    const lijst = ['scherm-a.e2e.js', 'scherm-b.e2e.js'];
    const w = weging(lijst);
    assert.equal(w.modus, 'onbekend',
      'de terugval hoort de modus te kiezen die deze bestanden kent');
    assert.equal(w.vertrouwen, 'twijfelachtig', 'en hem nog steeds niet te vertrouwen');
    /* En hij weegt ook echt: scherm-a is negen keer zo zwaar, dus die twee
       horen uit elkaar te gaan. */
    const bakken = indeling(lijst, 2);
    assert.equal(bakken[0].length, 1, 'met een echte weging gaan ze uit elkaar');
  });
});

test('kent geen enkele modus deze bestanden, dan is er niets te wegen', () => {
  const reg = { versie: 2, modi: { dekking: { duur: { 'unit-a.test.js': 5000 } } } };
  metRegister(reg, () => {
    process.env.RTG_TOETSMODUS = 'normaal';
    zetDuren(null);
    assert.equal(weging(['heel-iets-anders.e2e.js']).vertrouwen, 'ongeldig',
      'een modus die deze lijst niet kent is geen weging, ook al staat hij vol');
  });
});

test('een ongemeten bestand telt als duur, maar niet als de uitschieter', () => {
  /* HIER STOND Math.max, EN DAT IS GEEN MAAT MAAR EEN UITSCHIETER.

     Gemeten op het eerste CI-register: p50 5,3s, p90 9,8s, p99 46s -- en de
     zwaarste 1272s, want ast-grens.test.js is in zijn eentje 14% van al het
     werk. Elk ongemeten bestand kreeg daarmee 27x de p99.

     Wat dat deed in ronde 33518796922: twee nieuwe toetsbestanden reserveerden
     elk 1272s. Scherf 2 en 3 planden 2732s en deden er 512s en 516s over.

     De regel blijft "onbekend telt als duur" -- de p99 is hoger dan 99 van de
     100 bestanden. Wat vervalt is dat een enkele uitschieter bepaalt hoe duur. */
  const kaart = {};
  for (let i = 0; i < 100; i++) kaart['k' + i + '.test.js'] = 10;
  kaart['uitschieter.test.js'] = 10000;

  zetDuren(kaart);
  try {
    const bakken = indeling(['uitschieter.test.js', 'nieuw.test.js'], 2);
    const metNieuw = bakken.find((b) => b.includes('nieuw.test.js'));
    assert.ok(!metNieuw.includes('uitschieter.test.js'),
      'het ongemeten bestand hoort niet bij de uitschieter te belanden');

    /* De maat zelf: zou hij de uitschieter krijgen, dan is hij even zwaar en
       hangt de volgorde alleen nog van de naam af. Met de p99 is de uitschieter
       aantoonbaar zwaarder en gaat die als EERSTE de verdeling in. */
    const drie = indeling(['uitschieter.test.js', 'nieuw.test.js', 'k0.test.js'], 2);
    const bijUitschieter = drie.find((b) => b.includes('uitschieter.test.js'));
    assert.equal(bijUitschieter.length, 1,
      'de uitschieter hoort in zijn eentje te staan; deelt het ongemeten bestand ' +
      'zijn gewicht, dan verdeelt de greedy ze als gelijken');
  } finally { zetDuren(null); }
});

test('de maat van een ongemeten bestand ligt tussen de bulk en de uitschieter', () => {
  /* Deze toets meet de MAAT en niet alleen de plaatsing, want juist de maat is
     wat er veranderde. In een bak van een is de volgorde van de verdeling de
     aflopende kostenvolgorde -- daaruit is af te lezen waar een ongemeten
     bestand tussen valt.

     De verdeling is met opzet gevormd als het echte register: een dikke bulk,
     een dunne staart, en een uitschieter. Bij een KLEINE verzameling valt de
     p99 samen met het zwaarste bestand -- dat is geen fout maar rekenkunde, en
     daarom staan hier tweehonderd bestanden. */
  const kaart = {};
  for (let i = 0; i < 196; i++) kaart['bulk' + i + '.test.js'] = 10;
  kaart['lichter.test.js'] = 50;
  kaart['midden.test.js'] = 100;      // hier valt de p99 op, en die staat NIET in de proef
  kaart['zwaarder.test.js'] = 150;
  kaart['uitschieter.test.js'] = 10000;

  zetDuren(kaart);
  try {
    const volgorde = indeling(
      ['uitschieter.test.js', 'zwaarder.test.js', 'nieuw.test.js', 'lichter.test.js'], 1)[0];
    assert.deepEqual(volgorde,
      ['uitschieter.test.js', 'zwaarder.test.js', 'nieuw.test.js', 'lichter.test.js'],
      'een ongemeten bestand hoort onder de uitschieter en boven de bulk te vallen');
  } finally { zetDuren(null); }
});

/* ===========================================================================
   DE ZWARE TOETSEN: uit de scherven, maar niet uit de keten.

   ast-grens.test.js is uit de vier scherven gehaald omdat hij onder dekking
   1272s deed -- in zijn eentje de bodem van het kritieke pad. Hij draait nu in
   een eigen job zonder dekking (272s).

   Dat is precies het soort verplaatsing dat stil fout gaat, en op drie
   manieren. Alle drie staan ze hieronder, want een toets die nergens meer
   draait ziet niemand: hij is niet rood, hij is er gewoon niet.
   =========================================================================== */
const { ZWAAR, KORT: ZWAAR_KORT } = require('../scripts/lib/zwaar');

test('elke zware toets heeft een eigen job in de keten', () => {
  const yml = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');
  const regel = /^\s*zwaar:\s*\[([^\]]+)\]\s*$/m.exec(yml);
  assert.ok(regel, 'ci.yml heeft geen matrix `zwaar: [...]`; dan draait geen enkele zware toets meer');
  const inKeten = regel[1].split(',').map((x) => x.trim()).filter(Boolean).sort();
  assert.deepEqual(inKeten, [...ZWAAR_KORT].sort(),
    'de matrix in ci.yml en scripts/lib/zwaar.js zeggen niet hetzelfde: ' +
    inKeten.join(', ') + '  vs  ' + ZWAAR_KORT.join(', '));
  for (const naam of ZWAAR) {
    assert.ok(fs.existsSync(path.join(__dirname, naam)), 'zware toets ontbreekt op schijf: ' + naam);
  }
});

test('de scherven laten de zware toetsen ook echt weg', () => {
  /* De vlag bestaat, maar geeft de keten hem ook mee? Zonder deze bewering
     draait ast-grens gewoon door in een scherf MET dekking, naast zijn eigen
     job -- twee keer het werk, en de hele winst weg zonder dat iets rood wordt. */
  const yml = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');
  const scherf = /npm run test:deel --[^\n]*--deel=\$\{\{ matrix\.scherf \}\}[^\n]*/.exec(yml);
  assert.ok(scherf, 'de scherfstap is niet te vinden in ci.yml');
  assert.match(scherf[0], /--zonder-zware/,
    'de scherven halen de zware toetsen niet weg; dan draaien ze dubbel');
});

test('het eindoordeel wacht op de zware toetsen', () => {
  /* De gevaarlijkste van de drie: de beschermde check heet "Tests, checks en
     build" en is wat een merge tegenhoudt. Staat `zware` niet in zijn needs,
     dan laat een GEZAKTE zware toets die check gewoon groen. Een toets
     verplaatsen mag nooit betekenen dat hij ophoudt te tellen. */
  const yml = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');
  const needs = /^\s*needs: \[([^\]]*toetsscherf[^\]]*)\]\s*$/m.exec(yml);
  assert.ok(needs, 'het eindoordeel heeft geen needs met de scherven erin');
  assert.match(needs[1], /\bzware\b/,
    'het eindoordeel wacht niet op de zware toetsen; dan telt een gezakte niet mee');
});

test('een zware toets draait nog steeds mee als je hem niet wegvraagt', () => {
  /* Lokaal hoort `npm test` gewoon alles te draaien. De vlag is er voor de
     keten, niet om een toets uit te zetten. */
  const { ontleedDeel } = require('../scripts/lib/delen');
  assert.ok(ontleedDeel, 'delen.js hoort bereikbaar te zijn');
  for (const naam of ZWAAR) {
    assert.ok(!require('../scripts/lib/geisoleerd').isGeisoleerd(naam),
      naam + ' hoort NIET in de isolatielijst te staan: die gaat over gedeelde ' +
      'staat, deze lijst over kosten. Twee redenen, twee lijsten.');
  }
});
