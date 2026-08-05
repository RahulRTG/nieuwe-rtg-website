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
    /* Het antwoordvenster (.mgz-sheet) zweeft niet meer: het zit in .mgz-blok
       en staat daar gewoon in de stroom. Het BLOK is dus het element dat boven
       de app-schillen moet liggen, en dat is nu wat we hier toetsen. */
    ['public/shared/metgezel/metgezel-01.js', ['.mgz-knop', '.mgz-blok', '.mgz-banner']]
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

/* Hier stond: "de onderrand laat de home-pil van het OS met rust". Die toets
   bewaakte een uitzondering in een gebaar dat er niet meer is -- omhoog vegen
   vanaf de onderrand riep Rahul op, en moest daarbij de home-pil ontwijken.
   Rahul heeft nu overal zijn eigen balk (shared/metgezel.js), dus het gebaar is
   weg en de uitzondering ook. In plaats van de oude toets weg te laten, legt
   deze vast DAT er nog maar een rand is: anders sluipt de tweede er ooit weer
   in zonder dat iemand de afweging opnieuw maakt. */
test('er is nog maar een rand: boven, en die opent alleen het bedieningspaneel', () => {
  const bron = lees('public/shared/randen.js');
  assert.match(bron, /w\.RTGRanden = \{ boven: openBoven \};/, 'de laag levert alleen de bovenrand');
  assert.ok(!/openOnder|rahulDoel/.test(bron), 'geen onderrand-gebaar meer in de laag');
  assert.ok(!/os-thuis-pill/.test(bron), 'en dus ook de uitzondering voor de home-pil niet meer');
});

test('Rahul staat als balk op de pagina, met de lippen als knop en een kleine stand', () => {
  /* De vervanger van het gebaar: een balk die er altijd is en die je zelf klein
     maakt. Zonder deze drie is Rahul nergens meer te bereiken.
     We lezen de BUNDEL en niet een van de delen: welk deel de code draagt is
     een indeling van het huis, geen belofte aan de gebruiker -- deze toets brak
     dan ook meteen toen het blok naar een eigen deel verhuisde. */
  const bron = lees('public/shared/metgezel.js');
  assert.match(bron, /blok\.appendChild\(balk\)[\s\S]{0,400}document\.body\.appendChild\(blok\)/,
    'de balk zit in het blok en dat blok staat echt op de pagina');
  assert.match(bron, /orb\.addEventListener\('click'/, 'de lippen klappen hem klein of groot');
  assert.match(bron, /localStorage\.setItem\(KLEIN/, 'die keuze blijft bewaard');
});

test('Rahul staat nergens overheen: de pagina houdt ruimte voor hem vrij', () => {
  /* De kern van "geintegreerd in plaats van zwevend". Twee dingen samen maken
     dat waar: het antwoord zit IN het blok (en niet als los venster over de
     pagina), en onderaan de body staat een tussenstuk zo hoog als het blok.
     Dat tussenstuk is bewust geen body-padding: pagina's hebben daar hun eigen
     marge staan en die zouden we dan overschrijven. */
  const bron = lees('public/shared/metgezel.js');
  assert.match(bron, /blok\.appendChild\(sheet\)/, 'het antwoord hoort in het blok, niet los over de pagina');
  assert.match(bron, /ruimte\.style\.height/, 'de pagina krijgt een tussenstuk zo hoog als het blok');
  assert.ok(!/body\.style\.paddingBottom/.test(bron), 'en dat gaat niet via de marge van de pagina');
  assert.ok(!/maakSleepbaar\(sheet/.test(bron), 'een venster dat op zijn plek staat hoeft niet versleepbaar te zijn');
});
