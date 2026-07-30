/* De randen van het scherm: instellingen van de bovenrand, Rahul van de
   onderrand. Deze test bewaakt de afspraken die je niet aan de code ziet als
   je er los naar kijkt -- vooral dat er nergens weer een zwevende knop
   terugsluipt, en dat elke pagina die het paneel laadt ook de randen laadt. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(WORTEL, p), 'utf8');

function paginas() {
  const uit = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(path.join(WORTEL, map))) {
      const rel = map + '/' + naam;
      if (fs.statSync(path.join(WORTEL, rel)).isDirectory()) { loop(rel); continue; }
      if (naam.endsWith('.html')) uit.push(rel);
    }
  })('public');
  return uit;
}

test('randen.js is geldige JS en levert RTGRanden', () => {
  const bron = lees('public/shared/randen.js');
  assert.doesNotThrow(() => new Function(bron));
  assert.match(bron, /w\.RTGRanden = \{/);
});

test('elke pagina met het bedieningspaneel laadt ook de randen', () => {
  const mist = [];
  for (const p of paginas()) {
    const html = lees(p);
    if (html.includes('shared/bediening.js') && !html.includes('shared/randen.js')) mist.push(p);
  }
  assert.deepStrictEqual(mist, [], 'zonder randen.js valt het paneel niet te openen');
});

test('het bedieningspaneel bouwt geen eigen zwevende ingang', () => {
  const bron = lees('public/shared/bediening/bediening-02.js');
  // een knop die permanent in beeld staat is precies wat deze ronde opruimde
  assert.ok(!/position:fixed/.test(bron), 'geen vaste knop in het paneel zelf');
  assert.match(bron, /w\.RTGBediening = \{ open: open, sluit: sluit, aanwezig: true \}/);
});

test('de chatbalk van Rahul begint weggelegd en kan weer weg', () => {
  const bron = lees('public/shared/rahul-mond.js');
  assert.match(bron, /className = 'rmond rm-weg'/, 'start onzichtbaar');
  assert.match(bron, /window\.RTGRahul\.sluit = function/, 'kan opgeruimd worden');
  assert.ok(!/rm-dicht/.test(bron), 'geen half ingeklapte pil meer, alleen weg of open');
});

test('de Rahul-laag ligt boven de werkschillen van de apps', () => {
  // #station en de andere schillen staan vast op z-index 60 en hoger; een
  // chatbalk die je oproept moet daaroverheen, anders roep je iets op dat je
  // niet ziet (dat ging eerder mis).
  for (const [bestand, klassen] of [
    ['public/shared/rahul-mond.js', ['.rmond', '.rm-uit']],
    ['public/shared/metgezel/metgezel-01.js', ['.mgz-knop', '.mgz-sheet', '.mgz-banner']]
  ]) {
    const bron = lees(bestand);
    for (const k of klassen) {
      const stuk = bron.slice(bron.indexOf(k + '{'));
      const m = /z-index:(\d+);/.exec(stuk.slice(0, 400));
      assert.ok(m, k + ' heeft geen z-index');
      assert.ok(Number(m[1]) > 200, k + ' ligt op ' + m[1] + ', onder de app-schillen');
    }
  }
});

test('de onderrand laat de home-pil van het OS met rust', () => {
  // omhoog vegen op de pil betekent al "naar het bureaublad"; twee betekenissen
  // op precies dezelfde plek zou een gok worden
  assert.match(lees('public/shared/randen.js'), /closest\('\.os-thuis-pill'\)/);
});
