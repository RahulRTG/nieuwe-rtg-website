/* ============================================================================
   DE VERSIE VAN HET BESTAND IN HAAR ADRES.

   Een herhaalbezoek aan /apps/app.html deed 67 verzoeken bij de server, waarvan
   62 een 304, en duurde 900 ms terwijl er maar 43 KB over de lijn ging. Die
   tijd zat in het navragen zelf. Met de vingerafdruk in het adres is navragen
   zinloos en mag het antwoord blijven staan. Gemeten (echte browser, HTTP/2,
   80 ms latentie, weg-en-terug navigatie, mediaan van vijf):

                        zonder            met
     terugkeer      908 ms / 67 verz.   637 ms / 29 verz.

   Vier dingen moeten kloppen, anders is dit erger dan geen vingerafdruk -- want
   `immutable` betekent dat een fout een JAAR blijft staan:

     1. HET ADRES VERANDERT ALS HET BESTAAND VERANDERT. Zo niet, dan houdt een
        browser na een update een jaar lang oude code vast.
     2. ALLEEN EIGEN, KALE PADEN. Een vreemde server of een adres dat al een
        querystring draagt (de twee bundels) blijft ongemoeid.
     3. EEN BESTAND DAT NIET BESTAAT KRIJGT NIETS. Anders krijgt een typefout
        een jaar cache.
     4. UIT IS ECHT UIT (RTG_VINGERAFDRUK=0).

   Draai los: node --test test/versieadres.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const M = require('../server/middleware/versieadres');

const map = fs.mkdtempSync(path.join(os.tmpdir(), 'vinger-'));
fs.mkdirSync(path.join(map, 'shared'), { recursive: true });
const schrijf = (rel, inhoud) => fs.writeFileSync(path.join(map, rel), inhoud);
schrijf('shared/klok.js', 'var a = 1;');
schrijf('shared/stijl.css', '.a{color:red}');

const vinger = (html) => (html.match(/\?v=([A-Za-z0-9-]+)/) || [])[1] || null;

test('1. een eigen .js en .css krijgen de vingerafdruk mee', () => {
  const uit = M.herschrijfHtml('<script src="/shared/klok.js"></script><link href="/shared/stijl.css" rel="stylesheet">', map);
  assert.match(uit, /src="\/shared\/klok\.js\?v=[^"]+"/);
  assert.match(uit, /href="\/shared\/stijl\.css\?v=[^"]+"/);
});

test('2. verandert het bestand, dan verandert het adres mee', () => {
  /* Dit draagt de immutable-kop. Beweegt de vingerafdruk niet mee, dan houdt
     een browser na een update een JAAR lang de oude code vast -- precies de
     storing die compressie.js beschrijft, maar dan onherstelbaar. */
  const voor = vinger(M.herschrijfHtml('<script src="/shared/klok.js"></script>', map));
  const st = fs.statSync(path.join(map, 'shared/klok.js'));
  fs.writeFileSync(path.join(map, 'shared/klok.js'), 'var a = 1; var b = 2;');
  fs.utimesSync(path.join(map, 'shared/klok.js'), st.atime, new Date(st.mtimeMs + 5000));
  const na = vinger(M.herschrijfHtml('<script src="/shared/klok.js"></script>', map));
  assert.ok(voor && na, 'beide keren een vingerafdruk');
  assert.notEqual(voor, na, 'andere inhoud, ander adres');
});

test('3. een adres dat al een querystring draagt blijft ongemoeid', () => {
  /* De stijl- en scriptbundel dragen hun lijst in de querystring en hebben hun
     eigen ETag-laag. Daar gaat hier niets overheen. */
  const html = '<link href="/stijlbundel.css?f=abc" rel="stylesheet"><script src="/scriptbundel.js?f=def"></script>';
  assert.equal(M.herschrijfHtml(html, map), html);
});

test('4. een vreemde server krijgt niets', () => {
  for (const slecht of ['//elders.example/x.js', 'https://elders.example/x.js', '/pad met spatie.js']) {
    const html = '<script src="' + slecht + '"></script>';
    assert.equal(M.herschrijfHtml(html, map), html, slecht + ' hoort ongemoeid te blijven');
  }
  assert.equal(M.GOED.test('//elders.example/x.js'), false, 'een dubbele streep is een vreemde server');
  assert.equal(M.GOED.test('/shared/klok.js'), true);
});

test('4b. uit de map breken lukt niet -- ook niet naar een bestand dat ECHT bestaat', () => {
  /* Deze toets slaagde eerder om de verkeerde reden: het doelbestand bestond
     toch al niet, dus elke controle "werkte". Nu ligt er een echt bestand
     buiten public/, en dan moet de padcontrole het werk doen. Zou hij dat niet
     doen, dan verraadt de vingerafdruk grootte en wijzigingstijd van bestanden
     buiten de webmap -- en die staan gewoon in de html van elke bezoeker. */
  const buiten = path.join(map, '..', 'geheim-' + path.basename(map) + '.js');
  fs.writeFileSync(buiten, 'var geheim = 1;');
  try {
    const rel = '/../' + path.basename(buiten);
    assert.equal(M.vingerVan(map, rel), null, 'vingerVan hoort buiten de map niets te geven');
    const html = '<script src="' + rel + '"></script>';
    assert.equal(M.herschrijfHtml(html, map), html, 'en de html blijft onveranderd');
  } finally { fs.unlinkSync(buiten); }
});

test('5. een bestand dat niet bestaat krijgt geen vingerafdruk', () => {
  /* Anders zou een typefout een jaar lang gecachet worden als 404. */
  const html = '<script src="/shared/bestaat-niet.js"></script>';
  assert.equal(M.herschrijfHtml(html, map), html);
  assert.equal(M.vingerVan(map, '/shared/bestaat-niet.js'), null);
});

test('6. alleen .js en .css -- geen html, geen beeld', () => {
  for (const rel of ['/apps/app.html', '/icon.svg', '/manifest.webmanifest']) {
    const html = '<link href="' + rel + '" rel="x">';
    assert.equal(M.herschrijfHtml(html, map), html, rel + ' hoort ongemoeid te blijven');
  }
});

test('7. de cache geeft geen oude vingerafdruk terug na een wijziging', () => {
  const a = M.vingerVan(map, '/shared/stijl.css');
  const st = fs.statSync(path.join(map, 'shared/stijl.css'));
  fs.writeFileSync(path.join(map, 'shared/stijl.css'), '.a{color:blue}.b{color:green}');
  fs.utimesSync(path.join(map, 'shared/stijl.css'), st.atime, new Date(st.mtimeMs + 9000));
  assert.notEqual(M.vingerVan(map, '/shared/stijl.css'), a, 'de cache hoort op mtime te verversen');
});

test('8. heeftVinger herkent alleen een verzoek met ?v=', () => {
  assert.equal(M.heeftVinger({ query: { v: 'abc' } }), true);
  assert.equal(M.heeftVinger({ query: {} }), false);
  assert.equal(M.heeftVinger({}), false);
  assert.equal(M.heeftVinger(null), false);
});

test('9. binnen een <script> of <style> blijft alles staan', () => {
  /* Daar is src="/x.js" geen attribuut maar TEKST. /apps/websitestudio.html
     bouwt in een inline script de HTML van een website die een lid EXPORTEERT,
     met daarin letterlijk '<link href="/fonts/fonts.css" rel="stylesheet">'.
     Zonder deze grens plakte deze laag onze eigen bestandsstempel in elke
     geexporteerde site, en verklapte hij de wijzigingstijden van onze
     bestanden aan iedereen die zo'n export opent. */
  const binnenScript = '<script>var h = \'<link href="/shared/stijl.css" rel="stylesheet">\';</script>';
  assert.equal(M.herschrijfHtml(binnenScript, map), binnenScript, 'een script blijft heel');

  const binnenStyle = '<style>/* zie href="/shared/stijl.css" */</style>';
  assert.equal(M.herschrijfHtml(binnenStyle, map), binnenStyle, 'een stijlblok ook');

  // maar ERBUITEN wordt er gewoon gestempeld, ook als er een script naast staat
  const gemengd = '<link href="/shared/stijl.css" rel="stylesheet">' + binnenScript +
                  '<script src="/shared/klok.js"></script>';
  const uit = M.herschrijfHtml(gemengd, map);
  assert.match(uit, /<link href="\/shared\/stijl\.css\?v=[^"]+"/, 'de echte link krijgt wel een stempel');
  assert.match(uit, /src="\/shared\/klok\.js\?v=[^"]+"/, 'en het externe script ook');
  assert.ok(uit.includes('\'<link href="/shared/stijl.css" rel="stylesheet">\''),
    'terwijl dezelfde tekst BINNEN het script onaangeraakt blijft');
});

test('10. alleen een echt src=/href=-attribuut, niet data-src of xlink:href', () => {
  /* Met `\b` ervoor matchte ook data-src= en xlink:href-- een woordgrens valt
     immers ook na een streepje of dubbele punt. Vandaag staat zo'n attribuut
     met een .js of .css in geen enkel scherm, dus het is nu nog niemands
     probleem; maar de dag dat iemand een eigen lazy-loader met data-src
     schrijft, zou die stilzwijgend een ?v= krijgen van een laag die daar niets
     mee te maken heeft. */
  const echt = '<script src="/shared/klok.js"></script>';
  assert.match(M.herschrijfHtml(echt, map), /\?v=/, 'een echt src= krijgt zijn stempel');
  for (const anders of ['<img data-src="/shared/klok.js">',
                        '<div xlink:href="/shared/stijl.css">',
                        '<x mysrc="/shared/klok.js">']) {
    assert.equal(M.herschrijfHtml(anders, map), anders, anders + ' hoort ongemoeid te blijven');
  }
  // en de witruimte ervoor blijft staan zoals hij stond
  const twee = '<link rel="stylesheet" href="/shared/stijl.css">';
  assert.match(M.herschrijfHtml(twee, map), /rel="stylesheet" href="\/shared\/stijl\.css\?v=/);
});
