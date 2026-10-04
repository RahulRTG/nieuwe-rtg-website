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
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { stempel, CODE } = require('../scripts/lib/stempel');

function git(wortel, args) {
  return execFileSync('git', args, { cwd: wortel, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

/* Iedere Git-bewering krijgt een eigen tijdelijke repository. De oude toets
   eiste dat de HELE werkboom schoon was en kon daardoor juist tijdens bouwen
   nooit haar onderwerp meten. Een test van vuile bomen hoort zijn eigen boom
   te bezitten. */
function metRepo(doe) {
  const wortel = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stempel-'));
  try {
    for (const map of ['server/kern', 'scripts', 'public', 'test'])
      fs.mkdirSync(path.join(wortel, map), { recursive: true });
    fs.writeFileSync(path.join(wortel, 'server/kern/basis.js'), 'module.exports = 1;\n');
    fs.writeFileSync(path.join(wortel, 'package.json'), '{"name":"stempelproef"}\n');
    git(wortel, ['init', '--quiet']);
    git(wortel, ['add', '.']);
    git(wortel, ['-c', 'user.name=RTG Test', '-c', 'user.email=test@rtg.invalid',
      'commit', '--quiet', '-m', 'basis']);
    return doe(wortel);
  } finally {
    fs.rmSync(wortel, { recursive: true, force: true });
  }
}

/* Zet een bestand neer, meet, en ruim het HOE DAN OOK weer op.

   Het opruimen staat in een finally omdat een gezakte assertie er anders
   overheen springt en het bestand blijft staan -- dat is eerlijkheidspunt 6.11
   en 6.7 in TAKEN.md, en het is deze sessie nog een keer echt gebeurd. Een
   ijkbestand dat blijft liggen, laat elke latere meting van die ronde
   meebewegen. */
function metBestand(wortel, rel, inhoud, doe) {
  const vol = path.join(wortel, rel);
  fs.writeFileSync(vol, inhoud);
  try { return doe(); } finally { try { fs.rmSync(vol, { force: true }); } catch (e) {} }
}

test('een ongecommit CODEbestand maakt de meting onreproduceerbaar', () => {
  /* De richting die eronder ligt: als dit NIET meer uitslaat, dan stempelt een
     meting zich schoon terwijl de code waarop hij is gemeten nergens staat. */
  const uit = metRepo(wortel => metBestand(wortel, 'server/kern/zz-proef-stempel.js',
    'module.exports = 1;\n', () => stempel({}, { wortel })));
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
  const uit = metRepo(wortel => metBestand(wortel, 'ZZPROEF-STEMPEL.json',
    '{ "uitleg": "tijdelijk register" }\n', () => stempel({}, { wortel })));
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
  const wortel = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zonder-git-'));
  let uit;
  try { uit = stempel({}, { wortel }); }
  finally { fs.rmSync(wortel, { recursive: true, force: true }); }
  assert.equal(uit.commit, null);
  assert.equal(uit.boomVuil, null,
    'zonder Git is de vuilheid onbekend en nooit stilletjes schoon');
  assert.ok(uit.op && uit.node, 'en het stempel draagt altijd wanneer en waarop');
});
