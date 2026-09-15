'use strict';
/* ============================================================================
   DE STILLEZINGMETER, EN OF HIJ ZELF DEUGT.

   STILLEZING.json telt lezers die een ONLEESBAAR bewijs als een AFWEZIG bewijs
   behandelen. Dat is een schuldgetal waarop gestuurd wordt, dus het moet aan
   drie eisen voldoen die niets met het huis te maken hebben en alles met de
   meter: hij moet kunnen uitslaan, hij mag niet achterlopen op de bron, en zijn
   adressen moeten kloppen.

   Toets 1 is de belangrijkste en komt uit een fout die hier echt is gemaakt: de
   eerste versie kon de uitkomst `onderscheidt` NIET TOEKENNEN -- die categorie
   zat niet in `deelIn()` -- en meldde daarom trots nul. Dat las als "niemand in
   dit huis doet het goed" terwijl het "deze meter kan het niet zien" betekende.

   De marker `loopt achter` zet dit bestand in npm run registerklopt; die lijst
   wordt afgeleid uit deze conventie en niet met de hand bijgehouden.
   ============================================================================ */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { meet, deelIn, ijk, IJKVOORBEELDEN } = require('../scripts/stillezing.js');
const REGISTER = JSON.parse(fs.readFileSync(path.join(WORTEL, 'STILLEZING.json'), 'utf8'));

test('1. de meter kan alle vijf zijn uitgangen toekennen', () => {
  assert.deepEqual(ijk(), [], 'elk voorbeeld hoort in zijn eigen bak te vallen');

  /* DE MUTATIE, want een ijking die je niet hebt zien zakken is geen ijking.
     Haal het merk uit het onderscheidende voorbeeld en het moet omslaan naar
     de schuldbak -- precies de fout die de eerste versie structureel maakte. */
  const zonderMerk = IJKVOORBEELDEN.onderscheidt.replace('ONLEESBAAR', 'leeg');
  assert.equal(deelIn(zonderMerk), 'anders',
    'zonder merk is het geen onderscheider meer');
  assert.equal(deelIn('return null;'), 'smeltSamen');
  assert.equal(deelIn(''), 'smeltSamen',
    'een lege vanger smelt samen; een toelichting maakt hem niet minder stil');
  assert.equal(deelIn('   /* uitleg weggeplet */   '.replace(/[^ ]/g, ' ')), 'smeltSamen',
    'met regelsHeel wordt een toelichting spaties, en die telt nog steeds als leeg');
});

test('2. het register loopt achter op de bron noch op zichzelf', () => {
  const vers = meet();
  for (const wereld of ['server', 'scripts']) {
    const g = REGISTER.gemeten[wereld];
    const lijst = vers.uit[wereld];
    assert.equal(g.smeltSamen, lijst.filter(r => r.soort === 'smeltSamen').length,
      wereld + '/: het vastgelegde aantal samensmeltingen wijkt af van een verse meting -- ' +
      'draai npm run stillezing:vast');
    assert.equal(g.bewijslezingen, vers.bereik[wereld],
      wereld + '/: het bereik loopt achter -- draai npm run stillezing:vast');
    assert.equal(g.onderscheidt, lijst.filter(r => r.soort === 'onderscheidt').length,
      wereld + '/: het aantal onderscheiders loopt achter');
  }
});

test('3. een telling staat nooit naast een lege lijst', () => {
  for (const wereld of ['server', 'scripts']) {
    const g = REGISTER.gemeten[wereld];
    const som = g.smeltSamen + g.zegtHet + g.onderscheidt + g.gooit + g.anders;
    assert.equal(som, g.metVanger,
      wereld + '/: de vijf bakken horen samen precies de vangers te zijn');
    assert.equal(g.smeltSamen, REGISTER.plekken[wereld].filter(r => r.soort === 'smeltSamen').length,
      wereld + '/: de telling hoort bij de lijst en niet naast de lijst');
  }
});

test('4. de twee werelden staan apart en worden nergens opgeteld', () => {
  assert.ok(REGISTER.gemeten.server && REGISTER.gemeten.scripts,
    'server/ en scripts/ dragen elk hun eigen telling');
  const plat = JSON.stringify(REGISTER.gemeten);
  assert.ok(!/"totaal"|"samen"|"alles"/.test(plat),
    'er hoort geen samengeteld schuldgetal te staan: in server/ staat een HANDELING ' +
    'tegenover die lezing, in scripts/ een METING. Een som is een getal waarop niemand kan sturen.');
});

test('5. elk gemeld adres landt op een echte catch-regel', () => {
  /* DE FOUT DIE DIT AFVANGT. zonderCommentaar() KORT de bron in, dus een
     regelnummer uit de gestripte tekst wijst in het echte bestand naar iets
     anders. De eerste versie meldde omkeerbaar.js:22 en dat was een
     commentaarblok. `{ regelsHeel: true }` houdt de posities gelijk. */
  const alles = [...REGISTER.plekken.server, ...REGISTER.plekken.scripts];
  assert.ok(alles.length > 0, 'zonder plekken bewijst deze toets niets');
  let gekeken = 0;
  for (const r of alles) {
    const regels = fs.readFileSync(path.join(WORTEL, r.bestand), 'utf8').split('\n');
    const regel = regels[r.regel - 1] || '';
    assert.ok(/\bcatch\b/.test(regel),
      r.bestand + ':' + r.regel + ' hoort een catch te zijn maar zegt: ' + regel.trim().slice(0, 70));
    gekeken++;
  }
  assert.ok(gekeken >= 50, 'besturingsproef: er horen er tientallen te zijn, niet een handvol');
});

test('6. besturingsproef -- de meter vindt werkelijk iets', () => {
  /* Nul samensmeltingen zou geen schoon huis betekenen maar een meter die niets
     herkent. Zolang er schuld is, hoort hij die te zien; wordt hij ooit echt
     nul, dan zakt deze toets en dwingt hij iemand om te bewijzen dat het klopt. */
  const vers = meet();
  assert.ok(vers.bereik.server + vers.bereik.scripts > 100,
    'de meter hoort honderden bewijslezingen te vinden; vindt hij er nauwelijks, ' +
    'dan is de registerlijst of de leesherkenning stuk');
  assert.ok(vers.uit.scripts.length > 0, 'en minstens een vanger eromheen');
});
