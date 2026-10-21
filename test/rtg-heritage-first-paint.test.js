'use strict';
/* Heritage is geen late vernislaag. Deze toets bewaakt dat ieder blijvend
   appscherm zijn vaste wereld en centrale blad al in de HTML draagt. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const identiteit = require('../public/shared/rtg-world-identity');
const uitrol = require('../scripts/heritage-uitrol');

const ROOT = path.join(__dirname, '..');
const APPS = path.join(ROOT, 'public', 'apps');

function htmlBestanden(map, uit = []) {
  for (const naam of fs.readdirSync(map).sort()) {
    const volledig = path.join(map, naam);
    const stat = fs.statSync(volledig);
    if (stat.isDirectory()) htmlBestanden(volledig, uit);
    else if (naam.endsWith('.html')) uit.push(volledig);
  }
  return uit;
}

function waarde(tag, naam) {
  const m = tag.match(new RegExp('\\s' + naam + '=["\']([^"\']*)["\']', 'i'));
  return m && m[1];
}

test('alle 298 echte schermen hebben hun centrale blad (Heritage of het Design System) vóór de eerste paint', () => {
  let echte = 0;
  let redirects = 0;
  let ds = 0;
  for (const bestand of htmlBestanden(APPS)) {
    const route = uitrol.appPad(bestand);
    const wereld = identiteit.classify(route);
    const bron = fs.readFileSync(bestand, 'utf8');
    if (wereld === 'redirect') {
      redirects += 1;
      continue;
    }
    echte += 1;
    const body = bron.match(/<body\b[^>]*>/i);
    assert.ok(body, route + ' heeft geen body');
    assert.equal(waarde(body[0], 'data-rtg-world'), wereld, route + ' mist zijn vaste wereld');
    /* Een scherm op het RTG Design System heeft ZIJN centrale blad voor de
       eerste paint: /ds/rtg-ds.css, en juist niet het Heritage-blad ernaast
       (ONTWERPSYSTEEM.md par. 5: een blad buiten een laag wint van elke laag). */
    if (/href=["']\/ds\/rtg-ds\.css["']/.test(bron)) {
      ds += 1;
      assert.doesNotMatch(bron, /rtg-heritage\.css/, route + ' draagt het Design System en tegelijk het Heritage-blad');
      assert.equal(uitrol.gewenst(bestand, bron), bron, route + ' wordt door de uitrol aangeraakt');
      continue;
    }
    assert.equal(waarde(body[0], 'data-rtg-skin'), 'heritage', route + ' mist de vaste skin');
    const links = bron.match(/<link\b[^>]*href=["']\/shared\/rtg-heritage\.css["'][^>]*>/gi) || [];
    assert.equal(links.length, 1, route + ' moet het Heritage-blad exact één keer laden');
    const head = bron.slice(0, bron.search(/<\/head>/i));
    const laatsteBlad = Array.from(head.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)).at(-1);
    assert.ok(laatsteBlad && /rtg-heritage\.css/.test(laatsteBlad[0]),
      route + ' moet Heritage na zijn eigen schermstijl laden');
    assert.equal(uitrol.gewenst(bestand, bron), bron, route + ' is niet idempotent uitgerold');
  }
  assert.equal(echte, 298);
  assert.equal(redirects, 18);
  assert.ok(ds >= 1, 'minstens een scherm staat op het Design System (TRAVELOS-MIGRATIE.md)');
});

test('iedere app en de twee overige overgangsschermen observeren na CSS en vóór de eerste weergave', () => {
  const extras=['public/site/404.html','public/ds/voorbeeld.html'].map(p=>path.join(ROOT,p));
  for(const bestand of [...htmlBestanden(APPS),...extras]) {
    if(bestand.startsWith(APPS+path.sep) && identiteit.classify(uitrol.appPad(bestand))==='redirect')continue;
    const html=fs.readFileSync(bestand,'utf8');
    const scripts=[...html.matchAll(/<script\b[^>]*src=["']\/shared\/rtg-heritage-transition\.js["'][^>]*><\/script>/gi)];
    assert.equal(scripts.length,1,bestand+': exact één bestaande controller');
    assert.doesNotMatch(scripts[0][0],/\b(?:defer|async)\b/);
    assert.match(scripts[0][0],/blocking="render"/);
    assert.equal(html.slice(scripts[0].index+scripts[0][0].length,html.indexOf('</head>')).trim(),'',bestand+': observer als laatste in head');
  }
});

test('overgangsbootstrap consolideert late scripts brongetrouw en idempotent', () => {
  const vroeg='<script src="/shared/rtg-heritage-transition.js" blocking="render"></script>';
  const bron='<html><head>\n<link href="/shared/rtg-uniform.css" rel="stylesheet">\n</head><body>\n'+
    '<script src="/shared/rtg-heritage-transition.js" defer></script>\n'+
    '<script src="/shared/rtg-heritage-transition.js?v=oud" async></script>\n'+
    '<script>const voorbeeld = "<script src=\\"/shared/rtg-heritage-transition.js\\" defer><\\/script>";</script>\n'+
    '<p>Behouden inhoud</p></body></html>';
  const uit=uitrol.zetOvergang(bron);
  assert.ok(uit.indexOf(vroeg)>uit.indexOf('<link') && uit.indexOf(vroeg)<uit.indexOf('</head>'));
  assert.equal(uit.split(vroeg).length,2);
  assert.doesNotMatch(uit,/src="\/shared\/rtg-heritage-transition.js\?v=oud"/);
  assert.ok(uit.includes('const voorbeeld ='));
  assert.ok(uit.includes('<p>Behouden inhoud</p>'));
  assert.equal(uitrol.zetOvergang(uit),uit);
});

test('overgangsbootstrap verandert geen redirect en voegt DS geen Heritage-stijlen toe', () => {
  const redirect=htmlBestanden(APPS).find(p=>identiteit.classify(uitrol.appPad(p))==='redirect');
  const bron=fs.readFileSync(redirect,'utf8');
  assert.equal(uitrol.gewenst(redirect,bron),bron);
  const ds=htmlBestanden(APPS).find(p=>fs.readFileSync(p,'utf8').includes('href="/ds/rtg-ds.css"'));
  const uit=uitrol.gewenst(ds,fs.readFileSync(ds,'utf8'));
  assert.doesNotMatch(uit,/rtg-heritage\.css/);
  assert.match(uit,/<script src="\/shared\/rtg-heritage-transition.js" blocking="render"><\/script>/);
});
