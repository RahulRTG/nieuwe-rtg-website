/* DE TAALSCHIL: werkt een taal werkelijk zonder netwerk?

   Het gat dat deze laag dicht is GEMETEN en niet vermoed. De vertaallaag kan
   114 talen, maar alleen MET verbinding: tekst wordt van het scherm geschraapt
   en bij /api/vertaal/ui opgehaald. Wie voor het eerst offline binnenkwam,
   kreeg Nederlands -- ook met een allang gekozen taal. Gemeten: het offline
   oppervlak is 13.965 unieke teksten, waarvan 1413 in de voorgecachete schil.

   WAT HIER HARD WORDT GEMAAKT, en waarom elk punt uit een echt risico komt:

     1. de twee lijsten lopen niet uit elkaar (sw.js tegenover het register)
     2. een onbekende taalcode laat het register vallen, stil overslaan mag niet
     3. alleen `goed` wordt meegeleverd -- `verdacht` is getoond, nooit permanent
     4. een ontbrekende regel wordt WEGGELATEN en niet met de bron gevuld
     5. het meegeleverde bestand draagt geen tijdstempel (anders churnt de cache)
     6. de leesweg is kast, dan schil, dan net

   MUTATIES (LAT.md regel 2). Vier keer gebroken, en dit viel om:
     de keuring in vertaalSchil overslaan          -> 3
     een afgewezen regel als bron wegschrijven     -> 4
     stempel() terug in het meegeleverde bestand   -> 5
     een schilpad uit sw.js halen                  -> 1                        */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const register = require('../server/taalschil');
const bouwer = require('../scripts/taalschil');

test('1. sw.js en het register noemen exact dezelfde schilbestanden', () => {
  /* Een service worker kan niets requiren, dus de paden staan daar letterlijk.
     Twee lijsten die uit elkaar lopen is hier duur: een pad dat sw.js mist,
     wordt offline nooit gevonden, en een pad dat alleen sw.js kent, laat de
     hele `addAll` -- en daarmee de complete installatie -- mislukken. */
  const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
  const inSw = [...sw.matchAll(/'(\/shared\/taalschil\/[^']+)'/g)].map(m => m[1]).sort();
  assert.deepEqual(inSw, register.schilPaden().slice().sort(),
    'public/sw.js en server/taalschil.js noemen niet dezelfde schilbestanden');
});

test('2. elk meegeleverd schilbestand bestaat ook echt', () => {
  /* `cache.addAll` is alles-of-niets: een enkel ontbrekend bestand laat de
     installatie van de hele app-schil mislukken, niet alleen die ene taal. */
  for (const p of register.schilPaden()) {
    const f = path.join(ROOT, 'public', p.replace(/^\//, ''));
    assert.ok(fs.existsSync(f), p + ' staat in de schil maar bestaat niet');
  }
});

test('3. alleen `goed` wordt meegeleverd; verdacht en afgewezen niet', async () => {
  /* De vorige ronde legde vast dat `verdacht` wel getoond maar nooit BEWAARD
     wordt. Een meegeleverd bestand is de meest permanente vorm die er is. */
  const bron = ['Betaal EUR 65', 'Opslaan', 'Welkom bij Rahul Travel Group'];
  const nep = async () => ([
    { text: 'EUR 95 をお支払い', translated: true, from: 'nl' },  // bedrag veranderd -> afgewezen
    { text: '保存', translated: true, from: 'nl' },              // in orde
    { text: 'ラフル旅行団体へようこそ', translated: true, from: 'nl' } // merk vertaald -> afgewezen
  ]);
  const uit = await bouwer.vertaalSchil(bron, 'ja', nep);
  assert.deepEqual(Object.keys(uit.regels), ['Opslaan'],
    'de keuring hield de foute regels niet tegen: ' + JSON.stringify(uit.regels));
  assert.equal(uit.tel.afgewezen, 2);
});

test('4. een regel zonder vertaling wordt weggelaten, niet met de bron gevuld', async () => {
  /* Zou de bron worden weggeschreven, dan kan een lezer -- mens of meter --
     een onvertaalde regel niet onderscheiden van een gekeurde vertaling, en
     leest de dekking te hoog. */
  const bron = ['Bestellen', 'Splits'];
  const nep = async () => ([
    { text: 'Bestellen', translated: false, from: 'nl' },
    { text: '分割', translated: true, from: 'nl' }
  ]);
  const uit = await bouwer.vertaalSchil(bron, 'ja', nep);
  assert.equal(uit.regels.Bestellen, undefined, 'een onvertaalde regel hoort er niet in te staan');
  assert.equal(uit.regels.Splits, '分割');
  assert.equal(uit.tel.onvertaald, 1);
});

test('5. het meegeleverde bestand draagt geen tijdstempel', () => {
  /* De cachenaam van sw.js is een sha256 OVER deze bestanden. Een tijdstempel
     erin geeft bij elke herbouw een nieuwe vingerafdruk, ook zonder inhoudelijke
     wijziging -- en dan haalt elk toestel de complete app-schil opnieuw op. */
  for (const p of register.schilPaden()) {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', p.replace(/^\//, '')), 'utf8'));
    assert.equal(j.stempel, undefined, p + ' draagt een stempel; dan churnt de cache bij elke bouw');
    assert.ok(j.grens && j.grens.length > 40, p + ' zegt niet wat het NIET aantoont');
    assert.equal(j.betekenis, 'ongemeten', p + ' beweert iets over de betekenis');
  }
});

test('6. het register in de wortel draagt WEL een stempel', () => {
  /* Wat niet deterministisch is, hoort in de wortel en niet in het product --
     maar het moet er wel zijn: een register zonder datum is niet na te lopen. */
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'TAALSCHIL.json'), 'utf8'));
  assert.ok(j.stempel && j.stempel.op && j.stempel.commit, 'TAALSCHIL.json draagt geen bruikbaar stempel');
  assert.ok(j.grens && j.grens.length > 40, 'TAALSCHIL.json zegt niet wat het NIET aantoont');
});

test('7. de leesweg is kast, dan schil, dan net', () => {
  /* De kast is VERSER (hij kent ook schermen buiten de schil), de schil is
     BREDER bij een koude start, en het net is de enige stap die iets kost. */
  const bron = fs.readFileSync(path.join(ROOT, 'public/shared/i18n/i18n-00b.js'), 'utf8');
  const kast = bron.indexOf('KAST.van(taal).get(st.bron)');
  const schil = bron.indexOf('SCHIL.van(taal).get(st.bron)');
  const net = bron.indexOf('groepen.set(st.bron');
  assert.ok(kast > 0 && schil > 0 && net > 0, 'de drie stappen staan niet alle drie in voeg()');
  assert.ok(kast < schil, 'de schil wordt vóór de kast geraadpleegd');
  assert.ok(schil < net, 'er wordt om het net gevraagd voordat de schil is bekeken');
});

test('8. een onbekende taalcode laat het register vallen', () => {
  /* Stil overslaan zou een taal uit de schil laten verdwijnen zonder dat iemand
     het merkt -- en sw.js zou dan een bestand voorcachen dat niemand vult. */
  const bron = fs.readFileSync(path.join(ROOT, 'server/taalschil.js'), 'utf8');
  assert.match(bron, /throw new Error\('taalschil: onbekende taalcode/,
    'het register valt niet hard op een code die server/talen.js niet kent');
  assert.ok(register.SCHILTALEN.every(c => require('../server/talen').bestaat(c)));
  assert.equal(register.DOELTALEN.includes(register.BRON), false,
    'de brontaal hoort geen eigen schilbestand te krijgen');
});
