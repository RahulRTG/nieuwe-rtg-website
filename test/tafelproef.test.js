/* DE TAFELPROEF (scripts/tafelproef.js) -- de eerste gouden keten.

   MAATSTAF.md par. 7 kiest horeca als eerste volledige verhaal over actoren
   heen. Dit bestand bewaakt de PROEF, niet de keten: die draait in het script
   zelf tegen een wegwerpserver en duurt daar minuten. Wat hier staat is wat er
   misgaat als niemand op de proef let.

   WAAROM DAT NODIG IS, met een voorbeeld uit deze proef zelf. Schakel 9 stond
   bij de eerste ronde op GESLOTEN met `gastbeeld: undefined` eronder: hij
   toetste `openstaand === 0 && gesloten === true`, en dat zijn allebei velden
   uit het antwoord van de ZAAK. De proef die bestaat om de ONTVANGER te meten,
   keek dus naar de bron -- en had daar nooit van kunnen zakken. Toets 3 hier
   houdt vast dat elke schakel een andere actor noemt of uitlegt waarom niet.

   Draai los: node --test test/tafelproef.test.js
   De keten zelf: npm run tafelproef */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'tafelproef.js'), 'utf8');
const REG = path.join(WORTEL, 'TAFELPROEF.json');

test('0. de proef zakt op een open schakel: dat mag geen rapportcijfer worden', () => {
  assert.match(bron, /process\.exit\(u\.sluit \? 0 : 1\)/,
    'zonder foutcode is dit een meting en geen proef -- de bouw merkt een gebroken keten dan niet');
  assert.match(bron, /sluit = t\.open === 0 && t\.stuk === 0 && t\.gebroken === 0/,
    'sluit hoort ALLE drie de slechte uitkomsten te tellen, niet een gemiddelde ervan (LAT.md regel 11)');
});

test('1. een ondergrens op het aantal schakels: een lege keten sluit niet', () => {
  assert.match(bron, /t\.schakels >= 9/,
    'zonder ondergrens zou een proef die nul schakels aflegt "sluit" melden -- precies de meter die niet kan zakken');
});

test('2. de proef draait op een wegwerpserver met een eigen datamap', () => {
  assert.match(bron, /require\('\.\/lib\/wegwerpserver'\)/,
    'een tiende eigen serverstart erbij is LAT.md regel 4');
  assert.doesNotMatch(bron, /localhost:3000|127\.0\.0\.1:3000/,
    'een proef die de ontwikkelserver aanroept, schrijft in de echte database');
});

test('3. elke schakel meet een ONTVANGER, of zegt waarom hij bij zichzelf blijft', () => {
  /* schakel(nr, van, naar, ...) -- van en naar mogen gelijk zijn (een invariant
     binnen een actor, zoals de splitsing die op de cent moet sluiten), maar dan
     hoort de omschrijving dat te dragen. Het gevaar is de andere kant op: een
     schakel die van->naar OVER actoren belooft en dan de bron uitleest. */
  const schakels = [...bron.matchAll(/schakel\((\d+), '([a-z]+)', '([a-z]+)', '([^']+)'/g)]
    .map(m => ({ nr: +m[1], van: m[2], naar: m[3], wat: m[4] }));
  assert.ok(schakels.length >= 9, 'minder dan negen schakels in de bron: ' + schakels.length);
  assert.deepEqual(schakels.map(s => s.nr), schakels.map((_, i) => i + 1), 'de nummers lopen niet door');
  const overActoren = schakels.filter(s => s.van !== s.naar);
  assert.ok(overActoren.length >= 6,
    'te weinig schakels die werkelijk van de ene actor naar de andere lopen: ' + overActoren.length);
});

test('4. de uitslag draagt zijn eigen grens', () => {
  assert.match(bron, /grens:/, 'een proef zonder uitgeschreven grens laat lezers denken dat hij alles dekt');
  assert.match(bron, /retour|creditnota/i,
    'de ontbrekende naad naar een creditnota hoort in de grens te staan en niet stil te blijven');
});

test('5. elke storing noemt zijn belofte, en de belofte is geen statuscode', () => {
  const beloften = [...bron.matchAll(/noteer\('([^']+)',\s*\n?\s*'([^']+)'/g)].map(m => ({ naam: m[1], belofte: m[2] }));
  assert.ok(beloften.length >= 4, 'minder dan vier storingen: ' + beloften.length);
  for (const b of beloften) {
    assert.ok(b.belofte.length > 20, b.naam + ': de belofte is te kort om iets te beweren');
    assert.doesNotMatch(b.belofte, /^\s*(status|http)?\s*\d{3}\s*$/i,
      b.naam + ': een statuscode is geen belofte -- zeg wat het systeem doet');
  }
});

test('6. de naam botst met niets: keten en verhaal waren bezet', () => {
  /* De les van scripts/overdracht.js, dat test/overdracht.test.js overschreef.
     Deze toets is goedkoop en vangt precies dat geval. */
  for (const naam of ['tafelproef']) {
    const elders = ['server/kern/' + naam + '.js', 'scripts/lib/' + naam + '.js'];
    for (const p of elders)
      assert.ok(!fs.existsSync(path.join(WORTEL, p)),
        p + ' bestaat ook: twee dingen met dezelfde naam lopen uiteen (LAT.md regel 4)');
  }
});

test('7. het register bestaat, sluit, en telt op', () => {
  if (!fs.existsSync(REG)) {
    assert.fail('TAFELPROEF.json ontbreekt -- draai: npm run tafelproef:vast');
  }
  const j = JSON.parse(fs.readFileSync(REG, 'utf8'));
  const t = j.telling;
  assert.equal(t.gesloten + t.open + t.stuk, t.schakels, 'de schakelstanden tellen niet op tot het geheel');
  assert.equal(t.gehouden + t.gebroken, t.storingen, 'de storingstanden tellen niet op tot het geheel');
  assert.ok(t.schakels >= 9, 'te weinig schakels in het register');
  assert.ok(t.storingen >= 4, 'te weinig storingen in het register');
  assert.equal(j.sluit, true, 'de laatste vastgelegde ronde sluit niet -- draai npm run tafelproef en repareer');
});

test('8. de vastgelegde ronde toont wat elke ontvanger ZAG, niet alleen dat het lukte', () => {
  const j = JSON.parse(fs.readFileSync(REG, 'utf8'));
  const metOntvanger = j.schakels.filter(s => s.van !== s.naar);
  for (const s of metOntvanger)
    assert.ok(s.ziet && String(s.ziet).length > 10,
      'schakel ' + s.nr + ' (' + s.van + '->' + s.naar + ') legt niet vast wat de ontvanger zag');
  /* De concrete waarde hoort erin te staan, niet "true". Dat is wat schakel 9
     de eerste keer verried. */
  for (const s of metOntvanger)
    assert.notEqual(String(s.ziet).trim(), 'true', 'schakel ' + s.nr + ' legt een booleaan vast in plaats van de waarde');
});
