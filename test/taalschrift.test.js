/* Het schriftregister: in welk schrift hoort een taal geschreven te zijn?

   De toewijzingen in server/taalschrift.js zijn een BEWERING. Deze toetsen
   houden die bewering tegen bronnen die er niet van weten -- het met de hand
   geschreven wereld-kernwoordenboek, en de RTL-lijst van de browserlaag. Twee
   bronnen die elkaar niet kennen; loopt er een uit de pas, dan zakt dit. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const schrift = require('../server/taalschrift');
const { TALEN } = require('../server/talen');
const { KERN, dictVan, TALEN_MET_KERN } = require('../server/translate/woordenboek/wereld');

const ROOT = path.join(__dirname, '..');

test('elke taal in het register heeft een schrift, en er staat er geen te veel', () => {
  const zonder = TALEN.filter(t => !schrift.schriftenVan(t.code)).map(t => t.code);
  assert.deepEqual(zonder, [], 'talen zonder schrift');
  const wees = Object.keys(schrift.SCHRIFTEN).filter(c => !TALEN.some(t => t.code === c));
  assert.deepEqual(wees, [], 'schriften voor een taal die niet bestaat');
});

test('het register spreekt het handgeschreven kernwoordenboek nergens tegen', () => {
  /* De onafhankelijke getuige. Zegt het register "Amhaars is Ethiopisch" en
     staat er in de tabel een Latijns woord, dan is er een fout -- in het
     register of in de tabel -- en die hoort hier te vallen. */
  const strijd = [];
  for (const code of TALEN_MET_KERN) {
    const d = dictVan(code);
    if (!d) continue;
    for (const nl of KERN) {
      const w = d[nl];
      if (!w || !schrift.heeftLetters(w)) continue;
      if (!schrift.draagtSchrift(w, code)) strijd.push(code + ':' + nl + '=' + w);
    }
  }
  assert.deepEqual(strijd, [], 'tabel en register spreken elkaar tegen');
});

test('de RTL-lijst van de server en die van de browser zijn dezelfde negen', () => {
  const bron = fs.readFileSync(path.join(ROOT, 'public/shared/i18n/i18n-00b.js'), 'utf8');
  const m = /var RTL = new Set\(\[([^\]]*)\]\)/.exec(bron);
  assert.ok(m, 'de browserlaag noemt zijn RTL-talen');
  const inBrowser = m[1].split(',').map(x => x.trim().replace(/^'|'$/g, '')).filter(Boolean).sort();
  const opServer = TALEN.filter(t => schrift.rtl(t.code)).map(t => t.code).sort();
  assert.deepEqual(opServer, inBrowser, 'server en browser zijn het oneens over schrijfrichting');
});

test('beslissend zegt eerlijk waar schrift GEEN bewijs is', () => {
  /* De asymmetrie die niet weggepoetst mag worden: bij Japans sluit schrift een
     Engels antwoord uit, bij Frans niet. Een lezer hoort dat verschil te zien. */
  assert.equal(schrift.beslissend('ja'), true);
  assert.equal(schrift.beslissend('ar'), true);
  assert.equal(schrift.beslissend('fr'), false, 'Frans deelt zijn letters met Engels');
  assert.equal(schrift.beslissend('sr'), false, 'Servisch aanvaardt ook Latijn, dus niet beslissend');
  const beslissend = TALEN.filter(t => schrift.beslissend(t.code)).length;
  assert.ok(beslissend >= 40 && beslissend < TALEN.length,
    'ongeveer een derde is beslissend toetsbaar, gemeten: ' + beslissend);
});

test('een taal met twee schriften aanvaardt ze allebei', () => {
  /* Servisch wordt in beide schriften geschreven en beide zijn officieel. Een
     register dat er een verplicht stelt, wijst juist een goede vertaling af. */
  assert.equal(schrift.draagtSchrift('школа', 'sr'), true);
  assert.equal(schrift.draagtSchrift('skola', 'sr'), true);
  assert.equal(schrift.draagtSchrift('学校', 'sr'), false);
  // Japans mengt drie schriften in een zin
  assert.equal(schrift.draagtSchrift('こんにちは', 'ja'), true);
  assert.equal(schrift.draagtSchrift('宿題', 'ja'), true);
});

test('een tekst zonder letters zakt nooit op schrift', () => {
  assert.equal(schrift.heeftLetters('2026'), false);
  assert.equal(schrift.heeftLetters('{naam}'), true);
  assert.equal(schrift.heeftLetters('€ 65,00'), false);
});
