/* HET STEMPEL: WANNEER IS EEN METING ONREPRODUCEERBAAR?

   `boomVuil` beantwoordt een vraag met gevolgen: hoort deze uitslag bij de
   commit die eronder staat, of bij iets wat nergens is vastgelegd? De meter
   `registersUitVuileBoom` en de deltapoortregel `bewijs-uit-vuile-boom` hangen
   er allebei aan, dus een verkeerd antwoord hier is een verkeerd oordeel daar.

   DE FOUT DIE DEZE TOETS VASTHOUDT. `boomVuil` vroeg `git status --porcelain`
   over de HELE boom. Daarmee was een schone stand onbereikbaar: zodra de eerste
   generator van een meetronde zijn register wegschrijft, is de boom vuil, en
   stempelt elke volgende meting van diezelfde ronde zichzelf als
   onreproduceerbaar. Op 2 september 2026 gemeten: van drie generatoren achter
   elkaar kwam alleen de EERSTE schoon binnen.

   Dat is exact dezelfde fout die `versheid()` in hetzelfde bestand al een keer
   had -- daar vergeleek hij de commit met HEAD, waardoor het committen van de
   verse registers de meting van een minuut oud verouderd verklaarde. De les is
   ook dezelfde en staat in de kop van dat blok: een meter die nooit groen kan
   worden, meet niets (LAT.md regel 9).

   DE TWEE BEWERINGEN hieronder zijn elkaars tegenproef, en dat is met opzet:
   zonder de tweede zou `boomVuil: false` teruggeven altijd slagen, en zonder de
   eerste zou `true` teruggeven altijd slagen.

   Los: node --test test/stempel.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { stempel, CODE, WORTEL } = require('../scripts/lib/stempel');

/* Draait git in de wortel en geeft de uitvoer, of '' als git niet kan. */
function git(args) {
  try { return execFileSync('git', args, { cwd: WORTEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch (e) { return ''; }
}

/* Zet een bestand neer, meet, en ruim het HOE DAN OOK weer op.

   Het opruimen staat in een finally omdat een gezakte assertie er anders
   overheen springt en het bestand blijft staan -- dat is eerlijkheidspunt 6.11
   en 6.7 in TAKEN.md, en het is deze sessie nog een keer echt gebeurd. Een
   ijkbestand dat blijft liggen, laat elke latere meting van die ronde
   meebewegen. */
function metBestand(rel, inhoud, doe) {
  const vol = path.join(WORTEL, rel);
  fs.writeFileSync(vol, inhoud);
  try { return doe(); } finally { try { fs.rmSync(vol, { force: true }); } catch (e) {} }
}

test('een ongecommit CODEbestand maakt de meting onreproduceerbaar', () => {
  /* De richting die eronder ligt: als dit NIET meer uitslaat, dan stempelt een
     meting zich schoon terwijl de code waarop hij is gemeten nergens staat. */
  const uit = metBestand('server/kern/zz-proef-stempel.js', 'module.exports = 1;\n',
    () => stempel());
  assert.equal(uit.boomVuil, true,
    'met een ongecommit bestand in server/ hoort boomVuil true te zijn -- die meting hoort ' +
    'bij code die nergens is vastgelegd');
});

test('een ongecommit REGISTER doet dat niet: een uitkomst is geen invoer', () => {
  /* Dit is de bewering die de reparatie draagt. Zakt hij, dan is een volledige
     meetronde weer onmogelijk: de tweede generator zou zichzelf vuil stempelen
     omdat de eerste net iets had weggeschreven.

     De proef gebruikt een register dat ECHT bestaat en gewoon een andere inhoud
     krijgt, want dat is het geval dat in het echt optreedt -- een generator
     die zijn eigen register herschrijft. */
  const schoon = git(['status', '--porcelain', '--'].concat(CODE)) === '';
  if (!schoon) {
    /* Draait deze toets in een boom met ongecommitte code, dan kan hij zijn
       bewering niet doen. Dat MELDT hij en hij slaat zichzelf niet over met
       groen: niet gemeten is geen bewijs (LAT.md regel 3). */
    assert.fail('deze toets vraagt een boom zonder ongecommitte code; nu staat er wel wat. ' +
      'Commit eerst, of draai hem los.');
  }
  const uit = metBestand('ZZPROEF-STEMPEL.json', '{ "uitleg": "tijdelijk register" }\n',
    () => stempel());
  assert.equal(uit.boomVuil, false,
    'een ongecommit REGISTER in de wortel hoort de meting NIET onreproduceerbaar te maken. ' +
    'Zou dat wel zo zijn, dan kan een meetronde nooit meer dan een schoon register opleveren.');
});

test('de lijst met wat als code telt, bevat wat een meetuitkomst kan veranderen', () => {
  /* Geen smaaktoets maar een grendel op een stille verslapping: wie `test` of
     `package.json` uit de lijst haalt, maakt de mutatiemotor en de
     dependencies-meter stilzwijgend "reproduceerbaar" terwijl ze het niet zijn.
     Juist op package.json is deze sessie een keuring omgevallen. */
  for (const nodig of ['server', 'scripts', 'public', 'test', 'package.json']) {
    assert.ok(CODE.includes(nodig), nodig + ' hoort mee te tellen als code');
  }
  assert.ok(!CODE.some(p => /\.md$/.test(p)), 'documenten veranderen geen meetuitkomst');
});

test('zonder git is de uitslag ONBEKEND en niet "schoon"', () => {
  /* De derde stand hoort te bestaan. Een stempel dat bij een mislukte
     git-aanroep `false` zou invullen, meldt een meting als reproduceerbaar
     terwijl niemand het heeft nagekeken. */
  const uit = stempel();
  assert.ok(uit.boomVuil === true || uit.boomVuil === false || uit.boomVuil === null,
    'boomVuil kent drie standen: waar, onwaar, en niet vast te stellen');
  assert.ok(uit.op && uit.node, 'en het stempel draagt altijd wanneer en waarop');
});
