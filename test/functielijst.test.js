/* ============================================================================
   DE AFDRUK VAN FUNCTIES.md LAAT NIETS VALLEN.

   WAAROM DIT ER IS, EN WAT HET KOSTTE. FUNCTIES.md is een afdruk geworden:
   scripts/functielijst.js leidt de drie lijsten af uit de registers en laat de
   met de hand geschreven delen staan. De eerste versie van dat script liet EEN
   regel weg -- de opsomming van de genre-caps -- niet uit een besluit maar
   omdat ik hem niet had gezien.

   Dat gaf geen enkele zichtbare fout. De keuring bleef groen (die draait
   test/genrecap.test.js niet), en het bleek pas uit de sabotageronde: twee
   wachters meldden "al rood voordat er iets gesaboteerd was", en bewezen
   daarmee niets meer. Een weggevallen regel kostte dus geen fout maar een blind
   gat in de handhaving.

   Deze toets bewaakt de vorm van de afdruk zelf, zodat de volgende die dit
   script aanpast het merkt in de suite in plaats van in een sabotageronde.

   DE MUTATIE: haal de caps-opsomming uit scripts/functielijst.js -> "de
   caps-opsomming staat in de afdruk" zakt (en test/genrecap.test.js met hem).
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { DOEL, bouw } = require('../scripts/functielijst');
const { FUNCTIES } = require('../server/functies/register');
const { APPS } = require('../server/kern/appcatalogus-data');
const GENRES = require('../server/seed/genres-lijst');

const afdruk = bouw();

test('FUNCTIES.md op schijf is gelijk aan de afdruk', () => {
  assert.equal(fs.readFileSync(DOEL, 'utf8'), afdruk, 'draai: npm run functielijst');
});

test('de drie lijsten dragen hun eigen aantal, uit de registers', () => {
  assert.match(afdruk, new RegExp('# 1\\. De ' + FUNCTIES.length + ' functieschakelaars'));
  assert.match(afdruk, new RegExp('# 2\\. De ' + APPS.length + ' apps'));
  assert.match(afdruk, new RegExp('# 3\\. De ' + Object.keys(GENRES).length + ' genres'));
});

test('de caps-opsomming staat in de afdruk, en noemt ze allemaal', () => {
  const caps = new Set();
  Object.values(GENRES).forEach(g => (g.caps || []).forEach(c => caps.add(c)));
  const m = /De (\d+) genre-caps waar de apps naar kijken/.exec(afdruk);
  assert.ok(m, 'de zin die test/genrecap.test.js leest, hoort in de afdruk te staan');
  assert.equal(Number(m[1]), caps.size);
  for (const c of caps) assert.ok(afdruk.includes('`' + c + '`'), 'cap ' + c + ' ontbreekt in de opsomming');
});

test('het handwerk blijft staan: de inleiding en alles vanaf hoofdstuk 4', () => {
  /* Het script knipt op "# 1. " en "# 4. ". Zou het die grenzen niet vinden, dan
     gooit het liever dan te raden -- maar dan hoort dat hier te blijken. */
  assert.match(afdruk, /^# Alle functies van Rahul Travel Group/);
  assert.match(afdruk, /\n# 4\. De lagen die overal doorheen lopen/);
  assert.match(afdruk, /## Wat er bewust ní?et is/, 'het slot is handwerk en blijft staan');
});

test('de getallen in de kop zijn geteld en niet geschat', () => {
  /* Ze stonden er met een tilde ("~2.950") terwijl ze exact te tellen zijn. Een
     schatting naast een geteld getal leest als even hard. */
  const kop = afdruk.slice(0, afdruk.indexOf('# 1. '));
  assert.ok(!/~\s*[\d.]/.test(kop), 'er staat nog een geschat getal in de kop');
  assert.match(kop, /\| API-routes \(uit de router\) \| \*\*\d+\*\* \|/);
});

test('een ontbrekende knipgrens is een fout en geen stilte', () => {
  /* Het script leest FUNCTIES.md van schijf; deze toets voert hem een tekst
     zonder grenzen door de doelnaam tijdelijk te verleggen is te omslachtig.
     In plaats daarvan de belofte uit de code: hij gooit met een leesbare reden. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'functielijst.js'), 'utf8');
  assert.match(bron, /mist de kop "# 1\. " of "# 4\. "; dit script knipt daarop en durft niet te raden/);
});
