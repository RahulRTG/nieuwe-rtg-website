/* De kaart-uitwijk (public/shared/kaart.js): de pure parseGeo() ontleedt de
   geo:-URI's die het huis gebruikt tot iets toonbaars. Getoetst op beide
   vormen (echte coördinaten en het adres-alleen 0,0?q=...), op de nette-maar-
   ongebruikte extra's (;crs=, hoogte) en op rommel-invoer.
   Draai los: node --test test/kaart.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Kaart = require('../public/shared/kaart');

test('1. coördinaten: geo:LAT,LNG?q=LAT,LNG', () => {
  const r = Kaart.parseGeo('geo:52.3702,4.8952?q=52.3702,4.8952');
  assert.equal(r.heeftCoord, true);
  assert.equal(r.lat, 52.3702);
  assert.equal(r.lng, 4.8952);
  assert.equal(r.adres, null);
  assert.equal(r.label, '52.3702, 4.8952');
});

test('2. adres-alleen: geo:0,0?q=<adres> wordt een adres, niet 0,0', () => {
  const r = Kaart.parseGeo('geo:0,0?q=' + encodeURIComponent('Herengracht 1, Amsterdam'));
  assert.equal(r.heeftCoord, false);
  assert.equal(r.lat, null);
  assert.equal(r.lng, null);
  assert.equal(r.adres, 'Herengracht 1, Amsterdam');
  assert.equal(r.label, 'Herengracht 1, Amsterdam');
});

test('3. negatieve/decimale coördinaten blijven intact', () => {
  const r = Kaart.parseGeo('geo:-33.8688,151.2093?q=-33.8688,151.2093');
  assert.equal(r.heeftCoord, true);
  assert.equal(r.lat, -33.8688);
  assert.equal(r.lng, 151.2093);
});

test('4. nette extra\'s (;crs= en hoogte) worden genegeerd', () => {
  const r = Kaart.parseGeo('geo:48.2,16.3,183;crs=wgs84;u=35');
  assert.equal(r.heeftCoord, true);
  assert.equal(r.lat, 48.2);
  assert.equal(r.lng, 16.3);
});

test('5. coördinaten zonder query werken ook', () => {
  const r = Kaart.parseGeo('geo:1.2833,103.8333');
  assert.equal(r.heeftCoord, true);
  assert.equal(r.label, '1.2833, 103.8333');
});

test('6. echte 0,0 zonder q levert geen coördinaat en geen adres', () => {
  const r = Kaart.parseGeo('geo:0,0');
  assert.equal(r.heeftCoord, false);
  assert.equal(r.adres, null);
  assert.equal(r.label, '');
});

test('7. rommel/niet-geo levert null', () => {
  assert.equal(Kaart.parseGeo('https://maps.google.com/?q=1,2'), null);
  assert.equal(Kaart.parseGeo(''), null);
  assert.equal(Kaart.parseGeo(null), null);
  assert.equal(Kaart.parseGeo(undefined), null);
  assert.equal(Kaart.parseGeo(42), null);
});

test('8. q met + als spatie en percent-codering wordt netjes ontleed', () => {
  const r = Kaart.parseGeo('geo:0,0?q=Plein+1+%C2%B7+Den+Haag');
  assert.equal(r.heeftCoord, false);
  assert.equal(r.adres, 'Plein 1 · Den Haag');
});

test('9. de geo-uitwijk gebruikt op elke host de canonieke DS-presentatie', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/ds/componenten/kaart.css'), 'utf8');
  assert.match(css, /\.ds-kaartuitwijk\s*\{/); assert.match(css, /\.ds-kaartuitwijk__waarde/);
  assert.doesNotMatch(css, /!important|#[0-9a-f]{3,8}\b/i);
  const bron = fs.readFileSync(path.join(__dirname, '../public/shared/kaart.js'), 'utf8');
  const os = require('../scripts/ontwerpsysteem');
  const ds = os.scriptLaadAnalyse(bron, { ds: true }), legacy = os.scriptLaadAnalyse(bron, { ds: false });
  assert.deepEqual(ds.onzeker, []); assert.deepEqual(ds.uitgesloten, ['/ds/rtg-ds.css']);
  assert.deepEqual(legacy.verwijzingen, [{ href: '/ds/rtg-ds.css', soort: 'dom' }]);
  assert.doesNotMatch(bron, /kaart-legacy\.css|rtg-kaart-stijl/);
});
