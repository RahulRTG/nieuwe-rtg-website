/* DE WACHTWIJZE VAN DE SCHERMTOETSEN (scripts/wachtwijze.js + WACHTWIJZE.json).

   WAAROM DEZE TOETS ER IS. TAKEN.md 4.67 zei dat de omzetting van
   `waitUntil: 'load'` af was "op twee gemeten uitzonderingen na". Nageteld op
   3 september 2026 stonden er 42 navigaties met `load` in 23 bestanden. Er was
   geen meter, dus dat getal kon jaren blijven staan terwijl de code de andere
   kant op liep -- dezelfde vorm als 4.71 en 4.72, nu in de toetsen zelf
   (LAT.md regel 6: een belofte in tekst zonder handhaver).

   WAT `load` KOST. page.goto met `waitUntil: 'load'` wacht op ELK subverzoek --
   elk plaatje, elk lettertype, elk script dat zichzelf bijlaadt -- terwijl de
   regel eronder meestal al op het echte teken wacht. Dat houdt stand op een
   rustige machine en valt onder belasting om.

   DRIE DINGEN DIE HIER VASTLIGGEN:

     1. DE REDEN WORDT GECITEERD EN NIET GERADEN. Een uitleg telt alleen als hij
        DIRECT boven de navigatie staat en het woord `load` noemt. Zou "er staat
        ergens commentaar in dit bestand" volstaan, dan verklaart de kop van het
        bestand alles eronder en staat de meter morgen op nul zonder dat er iets
        is gebeurd -- de gevaarlijkste uitslag die er is.
     2. DE UITLEG HOUDT OP BIJ DE EERSTE REGEL CODE. Anders leunt een navigatie
        op de verantwoording van de navigatie ervoor.
     3. DE RATEL GAAT MAAR EEN KANT OP. Een `load` erbij zonder reden laat de
        meter zakken.

   Draai los: node --test test/wachtwijze.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const meter = require('../scripts/wachtwijze.js');

const WORTEL = path.join(__dirname, '..');

function draai(args) {
  const r = spawnSync(process.execPath, [path.join(WORTEL, 'scripts', 'wachtwijze.js'), ...(args || [])],
    { cwd: WORTEL, encoding: 'utf8' });
  return { uit: (r.stdout || '') + (r.stderr || ''), code: r.status };
}

function metVervangen(rel, van, naar, doe) {
  const vol = path.join(WORTEL, rel);
  const origineel = fs.readFileSync(vol, 'utf8');
  assert.ok(origineel.includes(van), 'de aanname onder deze mutatie klopt niet meer: ' + van);
  /* ALLE voorkomens, en dat is hier geen netheid maar de proef zelf: de uitleg
     in zegel-ui noemt `load` twee keer, en een mutatie die er een laat staan
     bewijst niets over het citaat. */
  try { fs.writeFileSync(vol, origineel.split(van).join(naar)); doe(); }
  finally { fs.writeFileSync(vol, origineel); }
}

test('de stand is nul onverklaarde load-navigaties', () => {
  const nu = meter.meet();
  assert.deepEqual(nu.zonderReden, [],
    'deze navigaties wachten op meer dan hun bewering nodig heeft, zonder reden: ' +
    nu.zonderReden.map(r => r.bestand + ':' + r.regel).join(', '));
  assert.equal(draai().code, 0);
});

test('de drie die blijven staan, dragen ALLEMAAL een reden die iets zegt', () => {
  /* Zonder deze eis is "met reden" een vinkje. Elke uitzondering hier draagt een
     METING in het bestand (hoeveel rondes zakten er waarop), want een
     uitzondering zonder cijfer is een voorkeur. */
  const nu = meter.meet();
  assert.ok(nu.metReden.length >= 3, 'de bekende uitzonderingen zijn verdwenen; klopt de meter nog?');
  for (const r of nu.metReden) {
    assert.ok(r.reden && r.reden.length >= meter.REDEN_MINSTENS,
      r.bestand + ':' + r.regel + ' draagt geen reden die iets zegt');
  }
});

test('GRENS 1: de uitleg moet het woord `load` NOEMEN', () => {
  const regels = [
    '    /* Deze pagina heeft een lange lijst en dat duurt even, dus we geven hem',
    '       ruim de tijd voordat we iets beweren over wat er staat. */',
    "    await page.goto(base + '/a', { waitUntil: 'load' });"
  ];
  assert.equal(meter.redenBoven(regels, 2), null,
    'een uitleg die niet over de navigatie-eis gaat, verklaart hem mee');
});

test('GRENS 2: de uitleg houdt op bij de eerste regel CODE', () => {
  /* Anders erft navigatie twee de verantwoording van navigatie een, en dan
     verklaart een reden zichzelf steeds opnieuw naar beneden. */
  const uitleg = '    /* Hier blijft `load` staan omdat de bank van de werktafel achteraan een keten hangt ' +
    'die zichzelf bijlaadt; vier van de vijf rondes zakten op domcontentloaded. */';
  const met = [uitleg, "    await page.goto(base + '/a', { waitUntil: 'load' });"];
  assert.ok(meter.redenBoven(met, 1), 'de uitleg er direct boven telt niet mee');

  const zonder = [uitleg, "    await page.click('#x');", "    await page.goto(base + '/b', { waitUntil: 'load' });"];
  assert.equal(meter.redenBoven(zonder, 2), null,
    'de tweede navigatie leent de reden van de eerste');
});

test('GRENS 3: een korte uitleg is geen uitleg', () => {
  const regels = ['    // load', "    await page.goto(base + '/a', { waitUntil: 'load' });"];
  assert.equal(meter.redenBoven(regels, 1), null);
});

test('MUTATIE: een load-navigatie zonder reden laat de meter ZAKKEN', () => {
  metVervangen('test/plaatsmotor.e2e.js',
    "waitUntil: 'domcontentloaded'", "waitUntil: 'load'", () => {
      const nu = meter.meet();
      assert.equal(nu.zonderReden.length, 1);
      assert.equal(nu.zonderReden[0].bestand, 'plaatsmotor.e2e.js');
      const r = draai();
      assert.match(r.uit, /ZAKT: zonderReden 0 -> 1/);
      assert.equal(r.code, 1, 'een onverklaarde load hoort de meter te laten zakken');
    });
});

test('MUTATIE: verdwijnt het woord `load` uit een reden, dan telt hij niet meer', () => {
  /* De hele reden dat de reden een CITAAT is en geen aanwezigheid. */
  metVervangen('test/zegel-ui.e2e.js',
    '`load`', '`die eis`', () => {
      const nu = meter.meet();
      assert.ok(nu.zonderReden.some(r => r.bestand === 'zegel-ui.e2e.js'),
        'de reden telt nog mee terwijl hij niet meer over de navigatie-eis gaat');
      assert.equal(draai().code, 1);
    });
});

test('WACHTWIJZE.json loopt niet achter op de meting', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'WACHTWIJZE.json'), 'utf8'));
  const nu = meter.meet();
  assert.equal(reg.gemeten.zonderReden, nu.zonderReden.length);
  assert.equal(reg.gemeten.metReden, nu.metReden.length);
  assert.equal(reg.gemeten.loadNavigaties, nu.totaal);
  assert.deepEqual(reg.metReden.map(r => r.bestand + ':' + r.regel),
    nu.metReden.map(r => r.bestand + ':' + r.regel),
    'het register wijst naar andere regels dan de meting; draai npm run wachtwijze -- --vastleggen');
});

test('het npm-commando bestaat, want een getal dat je niet kunt narekenen is geen getal', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.wachtwijze, 'node scripts/wachtwijze.js');
});
