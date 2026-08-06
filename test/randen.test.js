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

test('html en script van dezelfde bouw, en een mismatch herstelt zichzelf een keer', () => {
  /* Het zwarte scherm waar dit vandaan komt: de browser had de pagina vers en
     het script nog uren oud (of andersom). Zo'n mix bouwt het beginscherm niet
     op en zegt niets -- geen fout in de console, alleen zwart. Het is hier
     meer dan eens gebeurd, en elke keer duurde het lang voor iemand doorhad
     dat de code al gerepareerd was.

     Drie dingen moeten waar blijven: beide bestanden dragen DEZELFDE stempel
     (anders herlaadt elke bezoeker meteen), het script vergelijkt ze, en het
     doet dat met een merk in sessionStorage zodat een blijvend verschil geen
     herlaadlus wordt. Die laatste is de gevaarlijkste: een lus is erger dan
     het zwarte scherm dat we repareren. */
  const html = lees('public/apps/app.html');
  const js = lees('public/apps/app-main.js');
  const inHtml = /<meta name="rtg-bouw" content="([^"]+)">/.exec(html);
  const inJs = /var RTG_BOUW = '([^']+)';/.exec(js);
  assert.ok(inHtml, 'app.html draagt een bouwstempel');
  assert.ok(inJs, 'app-main.js draagt een bouwstempel');
  assert.equal(inHtml[1], inJs[1], 'html en script komen uit dezelfde bouw');
  assert.notEqual(inHtml[1], '0', 'npm run build heeft de stempel echt gezet');
  assert.match(js, /sessionStorage\.setItem\('rtg_bouw_ververst'/, 'een tweede poging wordt onthouden');
  assert.match(js, /verversen hielp niet, we gaan door/, 'en dan gaat de app door in plaats van te blijven herladen');
});

test('de service worker vraagt na bij de server, ook als de browser denkt vers te zijn', () => {
  /* "Network-first" stond in de kop, maar fetch(e.request) mag gewoon uit de
     browsercache komen. Een script dat daar nog uren als vers in ligt werd dus
     zonder navragen geserveerd, terwijl de pagina er wel vers doorheen kwam --
     precies de mix hierboven. */
  const sw = lees('public/sw.js');
  assert.match(sw, /new Request\(e\.request, \{ cache: 'no-cache' \}\)/,
    'de service worker vraagt na in plaats van de browsercache te geloven');
});

test('een kapotte kaart maakt het beginscherm niet zwart', () => {
  /* Het gemelde beeld was: "ik zie alleen de AI-balk". Dat is geen balk die te
     veel doet maar een scherm dat niet gebouwd wordt. renderAll() riep twintig
     opbouwfuncties na elkaar aan zonder vangnet; struikelde de eerste, dan
     stierf de rest mee en bleef alleen over wat vast in de HTML staat.

     Een zwart scherm is bovendien de slechtste foutmelding die er is: het zegt
     niet wat er stuk is en niet dat de rest het nog zou doen. Elke stap loopt
     nu door stap(), die de fout bij naam noemt en doorgaat. In een echte
     browser nagemeten met een expres stukgemaakte renderHome: tien tabbladen,
     Salon en Betalen gewoon gevuld, en in de console "onderdeel renderHome van
     het beginscherm ging mis". */
  const bron = lees('public/apps/app-main.js');
  assert.match(bron, /function stap\(naam, fn\) \{\s*try \{ fn\(\); \} catch/,
    'stap() vangt een struikelende kaart op');
  assert.match(bron, /console\.error\('\[rtg\] onderdeel "' \+ naam/,
    'en noemt hem bij naam, anders is het nog steeds een raadsel');
  for (const stap of ['renderHome', 'renderSalon', 'renderTerPlaatse', 'laadBestellen']) {
    assert.match(bron, new RegExp("stap\\('" + stap + "', " + stap + "\\)"),
      stap + ' loopt door het vangnet');
  }
  assert.ok(!/\n\s+renderHome\(\);/.test(bron),
    'en niet meer kaal, want dan neemt hij de rest weer mee');
});
