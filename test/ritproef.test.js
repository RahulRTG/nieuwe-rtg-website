/* DE RITPROEF EN DE KETENVORM -- de tweede keten, en wat de twee delen.

   scripts/ritproef.js legt een ritketen af zoals scripts/tafelproef.js een
   tafelketen; scripts/ketenvorm.js telt achteraf wat ze werkelijk delen. Dit
   bestand bewaakt die twee instrumenten, niet de ketens zelf -- die draaien
   tegen een wegwerpserver en duren daar minuten.

   DE SCHERPSTE TOETS HIER IS NUMMER 3. De ritproef introduceert een stand
   `openBekend`: een schakel die aantoonbaar niet sluit, met een uitgeschreven
   reden. Dat is een uitweg die makkelijk verwatert tot "alles wat niet werkt
   krijgt een zinnetje". De toets eist daarom dat de reden lang genoeg is om
   iets te beweren EN naar een plek wijst waar het besluit hoort te vallen.

   Draai los: node --test test/ritproef.test.js
   De ketens zelf: npm run tafelproef && npm run ritproef && npm run ketenvorm */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'ritproef.js'), 'utf8');
const vormBron = fs.readFileSync(path.join(WORTEL, 'scripts', 'ketenvorm.js'), 'utf8');
const lees = (n) => JSON.parse(fs.readFileSync(path.join(WORTEL, n), 'utf8'));

test('0. de proef zakt op een open schakel zonder reden, en niet op een bevinding', () => {
  assert.match(bron, /uit\.sluit = .*t\.open === 0 && t\.stuk === 0 && t\.gebroken === 0 && t\.openBekend === 0/,
    'sluit hoort ALLE slechte uitkomsten te tellen, openBekend inbegrepen');
  assert.match(bron, /process\.exit\(u\.sluitMetBevinding \? 0 : 1\)/,
    'zonder foutcode op een echte open schakel is dit een meting en geen proef');
  /* Twee velden en geen samengesteld cijfer: een proef die "sluit" meldt terwijl
     er een gat in staat, is de scorecard die LAT.md regel 11 verbiedt. */
  assert.match(bron, /uit\.sluitMetBevinding =/, 'er is geen apart veld voor "loopt door, met een bevinding"');
});

test('1. de proef draait op een wegwerpserver, met de vervoerder als demo-zaak', () => {
  assert.match(bron, /require\('\.\/lib\/wegwerpserver'\)/);
  assert.match(bron, /DEMO_SUPPLIER: VERVOERDER/, 'zonder deze omgeving logt de proef in bij de verkeerde zaak');
  assert.doesNotMatch(bron, /localhost:3000|127\.0\.0\.1:3000/);
});

test('2. een meting verandert de toestand niet', () => {
  /* Hier stond eerst `ride/status` als bereikbaarheidstest -- een SCHRIJFroute
     in de zie-functie van een schakel. Dat meet de eigen ingreep.

     DE EERSTE VERSIE VAN DEZE TOETS ZAKTE OP ZICHZELF, en dat was leerzaam: hij
     las het COMMENTAAR waarin de reparatie wordt uitgelegd ("hier stond eerst
     ride/status"), en zijn blokgrens liep door tot voorbij de functie. Vandaar
     twee dingen: commentaar eruit met scripts/lib/bron.js (het hulpje dat
     check.js hier al voor heeft), en een afbakening op wat een zie-functie
     werkelijk IS -- alles van `async (` tot de `return {` waarmee hij zijn
     oordeel geeft. Een heuristiek, en zo bedoeld: hij vangt de vorm die hier
     echt is misgegaan. */
  const { zonderCommentaar } = require('../scripts/lib/bron');
  const kaal = zonderCommentaar(bron);
  /* `async (r) => {` of `async () => {` -- dat zijn de zie-functies. De
     stap-functie zelf draagt drie parameters en valt er dus buiten; zonder die
     beperking begon het eerste "blok" bij stap() en liep het door tot de eerste
     return in de wereldopbouw, waar staff/add staat. */
  const blokken = [...kaal.matchAll(/async \((?:r)?\) => \{([\s\S]*?)return \{/g)].map(m => m[1]);
  assert.ok(blokken.length >= 4, 'geen zie-functies gevonden; dan bewaakt deze toets niets');
  for (const b of blokken)
    assert.doesNotMatch(b, /ride\/status|ride\/assign|ride\/pay|staff\/add/,
      'een zie-functie roept een schrijfroute aan; dan meet de proef zijn eigen ingreep');
});

test('3. elke openBekend-schakel draagt een reden die iets beweert en ergens heen wijst', () => {
  const j = lees('RITPROEF.json');
  const bevindingen = j.schakels.filter(s => s.stand === 'openBekend');
  assert.equal(bevindingen.length, (j.bevindingen || []).length, 'de bevindingenlijst loopt niet gelijk met de schakels');
  for (const s of bevindingen) {
    assert.ok(s.bekend && s.bekend.length > 120,
      'schakel ' + s.nr + ': de reden is te kort om een bevinding te zijn in plaats van een etiket');
    assert.match(s.bekend, /MAATSTAF\.md|besluit|register/i,
      'schakel ' + s.nr + ': de reden zegt niet waar het besluit hoort te vallen');
    assert.ok(s.ziet && s.ziet.length > 10,
      'schakel ' + s.nr + ': een bevinding hoort te zeggen wat er WEL gemeten is');
  }
});

test('4. het register sluit en telt op', () => {
  const j = lees('RITPROEF.json');
  const t = j.telling;
  assert.equal(t.gesloten + t.open + t.openBekend + t.stuk, t.schakels, 'de schakelstanden tellen niet op');
  assert.equal(t.gehouden + t.gebroken, t.storingen, 'de storingstanden tellen niet op');
  assert.ok(t.schakels >= 7 && t.storingen >= 4, 'te weinig schakels of storingen');
  assert.equal(t.open, 0, 'er staat een schakel open zonder reden -- draai npm run ritproef en repareer of verklaar');
  assert.equal(t.stuk, 0);
  assert.equal(t.gebroken, 0);
  assert.equal(j.sluitMetBevinding, true);
  assert.ok(j.grens && j.grens.length > 80, 'het register draagt geen uitgeschreven grens');
});

test('5. de proef zet zijn wereld klaar en zegt dat erbij', () => {
  const j = lees('RITPROEF.json');
  assert.ok(j.wereld && j.wereld.chauffeur,
    'de seed geeft de vervoerder geen personeel; wie dat klaarzet zonder het te melden, verbergt de opstelling');
});

test('6. de ketenvorm meet en oordeelt niet', () => {
  assert.doesNotMatch(vormBron, /process\.exit\(1\)[\s\S]{0,200}gedeeld/,
    'de vormmeting hoort niet te zakken op een uitkomst; zij telt');
  assert.match(vormBron, /ondergrens/, 'de meting zegt niet dat een gelijke vorm niets bewijst');
  const j = lees('KETENVORM.json');
  assert.ok(j.grens && /steekproef|dezelfde hand/i.test(j.grens),
    'de uitkomst waarschuwt niet dat twee ketens van dezelfde hand geen bewijs zijn');
});

test('7. wat de ketens delen, is geteld en niet verklaard', () => {
  const j = lees('KETENVORM.json');
  /* Er waren er twee; sinds de toelatingsproef zijn het er drie. De eis is dus
     niet een aantal maar dat de meter ALLE ketens meeneemt -- zie
     test/toelatingsproef.test.js toets 6. */
  assert.ok(j.ketens.length >= 2, 'de ketenvorm leest minder dan twee registers');
  assert.equal(j.ketens.length, j.telling.ketens);
  /* De uitkomst zelf is een MEETRESULTAAT en mag bewegen; wat vastligt is dat
     de meting de drie soorten uit elkaar houdt. */
  for (const veld of ['vorm', 'actoren', 'beloften']) assert.ok(j[veld], veld + ' ontbreekt in de uitslag');
  assert.ok(j.vorm.let && /ondergrens|geen vondst/i.test(j.vorm.let),
    'de gedeelde vorm staat er zonder de waarschuwing dat hij niets bewijst');
  assert.ok(Array.isArray(j.beloften.nietIngedeeld),
    'een belofte die in geen thema past hoort zichtbaar te zijn en niet weg te vallen');
});

test('8. de proeven delen geen module -- de vorm wordt gevonden, niet verklaard', () => {
  const tafel = fs.readFileSync(path.join(WORTEL, 'scripts', 'tafelproef.js'), 'utf8');
  const toelating = fs.readFileSync(path.join(WORTEL, 'scripts', 'toelatingsproef.js'), 'utf8');
  for (const [naam, b] of [['ritproef', bron], ['tafelproef', tafel], ['toelatingsproef', toelating]])
    assert.doesNotMatch(b, /require\(.*(lib\/keten|lib\/ketenvorm|lib\/proefvorm)/,
      naam + ' hangt aan een gedeelde ketenmodule; dan meet ketenvorm.js zijn eigen aanname (de Asset-fout)');
});
