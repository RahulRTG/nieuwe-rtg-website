/* ============================================================================
   HET AFGESPLITSTE SCRIPTBLOK: WAT ER WEG MAG, EN VOORAL WAT NIET.

   146 inline <script>-blokken in 143 schermen, samen 2,33 MB, die bij elk
   bezoek opnieuw over de lijn gaan -- een pagina draagt een eigen nonce, dus er
   valt niets te hergebruiken. Bij /apps/app.html is het blok 42 KB.

   Gemeten na afsplitsing, op /apps/app.html:
     rauwe HTML     94.442 -> 51.883 bytes (45% kleiner)
     over de lijn   29.378 -> 13.910 bytes gzip (53% kleiner)
     CPU/verzoek      3,50 ->  1,05 ms (70% minder)
     plafond           285 ->   948 pagina's/seconde per proces

   Verplaatsen mag alleen als de pagina zich hetzelfde gedraagt. Vijf dingen
   kunnen dat breken, en dit bestand bewaakt ze alle vijf:

     1. DE VOLGORDE. Het <script> moet op EXACT de plek van het blok komen; een
        gewoon extern script blokkeert de ontleder net zo goed als een inline
        blok, dus dan is de staat van het document bij uitvoeren gelijk.
     2. document.write(). Dat schrijft op de plek van het script in de ontleder.
        Zo'n blok blijft staan.
     3. document.currentScript. Dat wijst na verhuizing naar een ander element.
     4. EEN BLOK MET ATTRIBUTEN. type="module", defer, async: allemaal ander
        gedrag dat een gewone <script src> niet nadoet.
     5. DE INDEX. De uitleverkant zoekt het blok op VOLGNUMMER in de bron; telt
        de pagina-kant anders, dan levert de pagina het VERKEERDE script uit.
        Daarom draait deze laag als eerste in voordeur.js, op de rauwe bron.

   Draai los: node --test test/scriptafsplitsing.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { herschrijfHtml, blokUit, magVerhuizen, decodeer, PAD, DREMPEL, GOED_PAGINA } =
  require('../server/middleware/scriptafsplitsing');

const groot = (vul) => 'var a=1;' + '/*' + 'x'.repeat(DREMPEL) + '*/' + (vul || '');
const tag = (js, attrs) => '<script' + (attrs || '') + '>' + js + '</script>';
const verwijzing = (html) => {
  const m = new RegExp('<script src="' + PAD.replace('.', '\\.') + '\\?f=([^&"]+)&i=(\\d+)&v=([^"]+)"').exec(html);
  return m ? { pad: decodeer(m[1]), i: Number(m[2]), v: m[3] } : null;
};

test('1. een groot kaal blok wordt een verwijzing op exact dezelfde plek', () => {
  const html = '<body><script src="/a.js"></script>' + tag(groot()) + '<script src="/b.js"></script></body>';
  const uit = herschrijfHtml(html, '/apps/app.html');
  const v = verwijzing(uit);
  assert.ok(v, 'er staat een verwijzing');
  assert.equal(v.pad, '/apps/app.html');
  assert.equal(v.i, 1, 'het tweede script-element');
  /* De volgorde draagt de hele ingreep: a.js ervoor, b.js erna. */
  assert.ok(uit.indexOf('/a.js') < uit.indexOf(PAD), 'a.js blijft ervoor');
  assert.ok(uit.indexOf(PAD) < uit.indexOf('/b.js'), 'b.js blijft erna');
  assert.equal(uit.indexOf('var a=1;'), -1, 'de inhoud zelf is weg uit de pagina');
});

test('2. een klein blok blijft staan', () => {
  const html = '<body>' + tag('var a=1;') + '</body>';
  assert.equal(herschrijfHtml(html, '/apps/app.html'), html);
});

test('3. document.write blijft inline -- dat schrijft op de plek van het script', () => {
  const html = '<body>' + tag(groot('document.write("<p>x</p>");')) + '</body>';
  assert.equal(herschrijfHtml(html, '/apps/app.html'), html);
  assert.equal(magVerhuizen('document.write("x")'), false);
  assert.equal(magVerhuizen('document . write ("x")'), false, 'ook met spaties');
});

test('4. currentScript blijft inline -- dat wijst na verhuizing ergens anders heen', () => {
  const html = '<body>' + tag(groot('var s=document.currentScript;')) + '</body>';
  assert.equal(herschrijfHtml(html, '/apps/app.html'), html);
  assert.equal(magVerhuizen('document.currentScript'), false);
});

test('5. een blok met attributen blijft staan -- daar hangt gedrag aan', () => {
  for (const at of [' type="module"', ' defer', ' async', ' src="/x.js"', ' type="application/json"']) {
    const html = '<body>' + tag(groot(), at) + '</body>';
    assert.equal(herschrijfHtml(html, '/apps/app.html'), html, at + ' hoort te blijven staan');
  }
});

test('6. de index telt ALLE script-elementen, ook die blijven staan', () => {
  /* Zou de index alleen de verhuisde blokken tellen, dan wijst de verwijzing
     bij het uitleveren het verkeerde script aan zodra er iets voor staat -- en
     dan draait de pagina ANDERE code dan er hoort. */
  const html = '<body><script src="/eerst.js"></script>' + tag('var k=1;') + tag(groot()) + '</body>';
  const uit = herschrijfHtml(html, '/apps/app.html');
  assert.equal(verwijzing(uit).i, 2, 'het derde script-element is index 2');
  assert.equal(blokUit(html, 1).inhoud, 'var k=1;', 'index 1 is het kleine blok');
  assert.ok(blokUit(html, 2).inhoud.length >= DREMPEL, 'index 2 is het grote blok');
  assert.equal(blokUit(html, 0).inhoud, '', 'index 0 is het externe script, zonder inhoud');
});

test('7. verandert het blok, dan verandert het adres mee', () => {
  const a = verwijzing(herschrijfHtml('<body>' + tag(groot('var b=1;')) + '</body>', '/apps/app.html'));
  const b = verwijzing(herschrijfHtml('<body>' + tag(groot('var b=2;')) + '</body>', '/apps/app.html'));
  assert.notEqual(a.v, b.v, 'andere inhoud, ander adres');
});

test('8. de deur: alleen een gewoon .html-pad onder public/', () => {
  const html = '<body>' + tag(groot()) + '</body>';
  for (const slecht of ['/../geheim.html', '//elders.example/x.html', '/apps/app.js', 'apps/app.html']) {
    assert.equal(herschrijfHtml(html, slecht), html, slecht + ' hoort niet herschreven te worden');
  }
  assert.equal(GOED_PAGINA.test('//elders.example/x.html'), false);
  assert.equal(GOED_PAGINA.test('/apps/app.html'), true);
});
