/* ============================================================================
   HET AFGESPLITSTE STIJLBLOK: WAT ER WEG MAG, EN VOORAL WAT NIET.

   Over alle 258 schermen is 74% van de HTML inline CSS en JS. Bij /apps/app.html
   is het ene <style>-blok 92 KB van de 185 KB, en dat gaat bij elk bezoek
   opnieuw over de lijn en door de compressor. Afgesplitst: 5,54 -> 2,71 ms per
   bezoek en 52.636 -> 28.386 bytes bij een herhaalbezoek.

   Verplaatsen mag alleen als de pagina er hetzelfde uitziet. Vier dingen kunnen
   dat breken, en dit bestand bewaakt ze alle vier:

     1. DE CASCADE. De <link> moet op EXACT de plek van het blok komen. Schuift
        hij, dan wint er opeens iets anders.
     2. RELATIEVE url(). Die wordt opgelost tegen de URL van het BLAD, niet van
        het document. Zo'n blok hoort dus te blijven staan.
     3. @import. Alleen geldig bovenaan een blad; zo'n blok blijft ook staan.
     4. EEN BLOK MET ATTRIBUTEN. media= of een eigen type= hangt gedrag aan het
        blok dat een <link> anders invult.

   En de deur: het adres draagt zelf welk bestand en welk blok (er staat niets
   in het geheugen van de server), dus dat adres is door iedereen te verzinnen.
   Wat eruit mag komen is daarom scherp begrensd.

   Draai los: node --test test/stijlafsplitsing.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { herschrijfHtml, blokUit, magVerhuizen, decodeer, PAD, DREMPEL, GOED_PAGINA } =
  require('../server/middleware/stijlafsplitsing');

const groot = (vul) => '.x{color:red}' + '/*' + 'a'.repeat(DREMPEL) + '*/' + (vul || '');
const blokTag = (css, attrs) => '<style' + (attrs || '') + '>' + css + '</style>';
const verwijzing = (html) => {
  const m = new RegExp('<link href="' + PAD.replace('.', '\\.') + '\\?f=([^&"]+)&i=(\\d+)&v=([^"]+)"').exec(html);
  return m ? { pad: decodeer(m[1]), i: Number(m[2]), v: m[3] } : null;
};

test('1. een groot kaal blok wordt een verwijzing op exact dezelfde plek', () => {
  const html = '<head><link href="/a.css" rel="stylesheet">' + blokTag(groot()) + '<link href="/b.css" rel="stylesheet"></head>';
  const uit = herschrijfHtml(html, '/apps/app.html');
  const v = verwijzing(uit);
  assert.ok(v, 'er staat een verwijzing');
  assert.equal(v.pad, '/apps/app.html', 'de verwijzing draagt zelf welk bestand');
  assert.equal(v.i, 0, 'en welk blok');
  assert.equal(uit.indexOf('<style'), -1, 'het blok zelf is weg');
  /* De cascade: a.css stond ervoor en b.css erna, en dat hoort zo te blijven.
     Dit is de assertie die de hele ingreep draagt. */
  assert.ok(uit.indexOf('/a.css') < uit.indexOf(PAD), 'a.css blijft voor het blok staan');
  assert.ok(uit.indexOf(PAD) < uit.indexOf('/b.css'), 'b.css blijft erna staan');
});

test('2. een klein blok blijft staan -- een extra verzoek weegt daar niet op', () => {
  const html = '<head>' + blokTag('.x{color:red}') + '</head>';
  assert.equal(herschrijfHtml(html, '/apps/app.html'), html, 'onveranderd');
});

test('3. een relatieve url() blijft inline -- die zou na verhuizing verkeerd wijzen', () => {
  const html = '<head>' + blokTag(groot('.y{background:url(plaatje.png)}')) + '</head>';
  assert.equal(herschrijfHtml(html, '/apps/app.html'), html, 'onveranderd');
  assert.equal(magVerhuizen('.y{background:url(plaatje.png)}'), false);
  // absoluut, data: en een volledig adres mogen wel
  assert.equal(magVerhuizen('.y{background:url(/p.png)}'), true);
  assert.equal(magVerhuizen('.y{background:url(data:image/gif;base64,AA)}'), true);
  assert.equal(magVerhuizen('.y{background:url("https://x/p.png")}'), true);
});

test('4. een @import blijft inline -- die is alleen bovenaan een blad geldig', () => {
  const html = '<head>' + blokTag('@import url(/a.css);' + groot()) + '</head>';
  assert.equal(herschrijfHtml(html, '/apps/app.html'), html, 'onveranderd');
});

test('5. een blok met attributen blijft staan -- daar hangt gedrag aan', () => {
  const html = '<head>' + blokTag(groot(), ' media="print"') + '</head>';
  assert.equal(herschrijfHtml(html, '/apps/app.html'), html, 'onveranderd');
});

test('6. de index telt ALLE blokken, ook de blokken die blijven staan', () => {
  /* Zou de index alleen de verhuisde blokken tellen, dan wijst de verwijzing
     bij het uitleveren het verkeerde blok aan zodra er een klein blok voor
     staat -- en dan krijgt de pagina andermans opmaak. */
  const klein = blokTag('.k{color:blue}');
  const html = '<head>' + klein + blokTag(groot()) + '</head>';
  const uit = herschrijfHtml(html, '/apps/app.html');
  assert.equal(verwijzing(uit).i, 1, 'het tweede blok is index 1');
  assert.equal(blokUit(html, 1).css.length >= DREMPEL, true, 'en index 1 is inderdaad het grote blok');
  assert.equal(blokUit(html, 0).css, '.k{color:blue}', 'index 0 blijft het kleine blok');
});

test('7. verandert het blok, dan verandert het adres mee', () => {
  /* Dit draagt de immutable-kop: hetzelfde adres is per definitie dezelfde
     inhoud. Zou de vingerafdruk niet meebewegen, dan houdt een browser na een
     wijziging een jaar lang de oude opmaak vast. */
  const a = verwijzing(herschrijfHtml('<head>' + blokTag(groot('.a{}')) + '</head>', '/apps/app.html'));
  const b = verwijzing(herschrijfHtml('<head>' + blokTag(groot('.b{}')) + '</head>', '/apps/app.html'));
  assert.notEqual(a.v, b.v, 'andere inhoud, ander adres');
});

test('8. de deur: alleen een gewoon .html-pad onder public/', () => {
  const html = '<head>' + blokTag(groot()) + '</head>';
  // een pagina die niet deugt wordt niet herschreven: dan blijft het blok
  // gewoon inline en is er niets kapot
  for (const slecht of ['/../geheim.html', '//elders.example/x.html', '/apps/app.js', 'apps/app.html']) {
    assert.equal(herschrijfHtml(html, slecht), html, slecht + ' hoort niet herschreven te worden');
  }
  assert.equal(GOED_PAGINA.test('//elders.example/x.html'), false, 'een dubbele streep is een vreemde server');
  assert.equal(GOED_PAGINA.test('/apps/app.html'), true);
});
