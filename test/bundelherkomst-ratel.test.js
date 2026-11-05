'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Voer de echte ratel uit op een aparte bronboom. Alleen de bundelregistratie
// en __dirname verschillen; extractie, herkomst en budgetcontrole zijn echt.
const meterpad = require.resolve('../scripts/ontwerpsysteem');
const bron = fs.readFileSync(meterpad, 'utf8');
const echtRequire = createRequire(meterpad);
function proef(html, controle) {
  const wortel = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bundelratel-'));
  try {
    const publiek = path.join(wortel, 'public');
    fs.mkdirSync(path.join(publiek, 'shared/parts'), { recursive: true });
    fs.mkdirSync(path.join(publiek, 'apps'));
    const script = "document.createElement('style');";
    for (const f of ['shared/owner.js', 'shared/parts/01.js']) fs.writeFileSync(path.join(publiek, f), script);
    fs.writeFileSync(path.join(publiek, 'apps/proef.html'), html);
    const mod = { exports: {} };
    const register = { 'shared/owner.js': 'shared/parts' };
    vm.runInNewContext(bron, {
      module: mod, __dirname: path.join(wortel, 'scripts'),
      require: naam => naam === './bundel' ? { bundels: register } : echtRequire(naam)
    }, { filename: meterpad });
    const meter = mod.exports;
    const meting = { bladen: {}, blokken: {}, injectie: {
      'public/shared/owner.js': meter.telInjectie(script),
      'public/shared/parts/01.js': meter.telInjectie(script)
    } };
    const norm = { bladen: {}, blokken: {}, injectie: { 'public/shared/owner.js': 1 } };
    controle({ meter, meting, norm, wortel, register });
  } finally { fs.rmSync(wortel, { recursive: true, force: true }); }
}
function directGeblokkeerd({ meter, meting, norm }) {
  const voor = JSON.stringify(meting);
  const { fouten } = meter.ratelFouten(meting, norm);
  assert.ok(fouten.some(f => f.includes('deel wordt rechtstreeks geladen: public/shared/parts/01.js')), fouten.join('\n'));
  assert.ok(fouten.some(f => f.includes('public/shared/parts/01.js: script injecteert stijl')), fouten.join('\n'));
  assert.equal(JSON.stringify(meting), voor, 'de ruwe meting blijft intact');
}
for (const url of ['/shared/parts/01.js', '/shared/parts/01.js?v=2#bron', '../shared/parts/01.js?v=2#bron']) {
  for (const quote of ['', '"', "'"]) {
    test('ratel blokkeert echte scriptload: ' + (quote || 'ongequote') + ' ' + url, () => {
      proef('<script src=' + quote + url + quote + '></script>', directGeblokkeerd);
    });
  }
}
for (const html of [
  '<SCRIPT SRC = /shared/parts/01.js></SCRIPT>',
  '<script/src=/shared/parts/01.js></script>',
  '<script title="voorbeeld src=/shared/owner.js >" src=/shared/parts/01.js></script>',
  '<script src=/shared/parts/01.js src=/shared/owner.js></script>',
  '<script type=module src=/shared/parts/01.js></script>'
]) test('attribuutvorm mag geen los deel onder ownerbudget verbergen: ' + html, () => proef(html, directGeblokkeerd));

for (const html of [
  '<!-- <script src=/shared/parts/01.js></script> -->',
  '<script>const voorbeeld = "<script src=/shared/parts/01.js>";</script>',
  '<textarea><script src=/shared/parts/01.js></script></textarea>',
  '<script title="src=/shared/parts/01.js" src=/shared/owner.js></script>',
  '<a href=/shared/parts/01.js>Bron bekijken</a>',
  '<script src=https://example.invalid/shared/parts/01.js></script>',
  '<script src=/shared/owner.js></script>'
]) test('HTML-voorbeeld, andere bestemming of owner is geen directe partload: ' + html, () => proef(html, ({ meter, meting, norm }) => {
  assert.equal(meter.ratelFouten(meting, norm).fouten.length, 0);
}));

test('overige letterlijke JS-verwijzingen blijven conservatief blokkeren', () => proef('<script>const kandidaat="/shared/parts/01.js";</script>', directGeblokkeerd));
test('ook een gequote verwijzing in commentaar verruimt de bestaande ratel niet', () => proef('<!-- "/shared/parts/01.js" -->', directGeblokkeerd));
for (const src of [
  '/shared/parts/0&#49;.js',
  '/shared/parts/&#x30;&#49;.js',
  '/shared/parts/0&#49.js',
  '&sol;shared/parts/01.js',
  '/shared/parts/%30%31.js',
  '../shared/parts/%30%31.js?v=1#bron',
  '/shared%2fparts/01.js',
  '/shared/parts/%zz.js'
]) for (const quote of ['', '"']) test('gecodeerd lokaal src-pad blijft onbeslist en vouwt geen budget: ' + quote + src, () => proef('<script src=' + quote + src + quote + '></script>', ({ meter, meting, norm }) => {
  const voor = JSON.stringify(meting);
  const { fouten } = meter.ratelFouten(meting, norm);
  assert.ok(fouten.some(f => f.includes('gecodeerd lokaal scriptadres niet herleid')), fouten.join('\n'));
  assert.ok(fouten.some(f => f.includes('public/shared/parts/01.js: script injecteert stijl')), fouten.join('\n'));
  assert.equal(JSON.stringify(meting), voor);
}));
test('letterlijke gecodeerde JS-load is eveneens geen bewezen ownerpad', () => proef('<script>const src="/shared/parts/%30%31.js";</script>', ({ meter, meting, norm }) => {
  const { fouten } = meter.ratelFouten(meting, norm);
  assert.ok(fouten.some(f => f.includes('gecodeerd lokaal scriptadres niet herleid')));
  assert.ok(fouten.some(f => f.includes('public/shared/parts/01.js: script injecteert stijl')));
}));
for (const html of [
  '<script src="/shared/owner.js?v=%30&amp;taal=nl"></script>',
  '<script src="https://example.invalid/shared/parts/%30%31.js"></script>',
  '<!-- <script src=/shared/parts/0&#49;.js></script> -->'
]) test('gecodeerde query, externe bron of HTML-commentaar maakt het lokale pad niet onzeker: ' + html, () => proef(html, ({ meter, meting, norm }) => {
  assert.equal(meter.ratelFouten(meting, norm).fouten.length, 0);
}));
test('een gedeeld genormaliseerd partpad kan niet twee owners krijgen', () => proef('', ({ meter, meting, norm, register }) => {
  register['shared/./owner.js'] = 'shared/parts/../parts';
  const { fouten } = meter.ratelFouten(meting, norm);
  assert.ok(fouten.some(f => f.includes('deel heeft meerdere owners')));
  assert.ok(fouten.some(f => f.includes('public/shared/parts/01.js: script injecteert stijl')));
}));
test('geconsolideerde bron behoudt exact het bestaande ownerbudget', () => proef('', ({ meter, meting, norm, wortel }) => {
  const inhoud = "document.createElement('style');document.createElement('style');";
  for (const f of ['shared/owner.js', 'shared/parts/01.js']) fs.writeFileSync(path.join(wortel, 'public', f), inhoud);
  meting.injectie['public/shared/owner.js'] = meting.injectie['public/shared/parts/01.js'] = 2;
  const { fouten } = meter.ratelFouten(meting, norm);
  assert.ok(fouten.some(f => f.includes('public/shared/owner.js: stijlinjectie 1 -> 2')));
}));
