/* ============================================================================
   DE STIJLBUNDEL: WAT ER SAMEN MAG, EN VOORAL WAT NIET.

   /apps/app.html doet 72 verzoeken. Zeven daarvan houden het TEKENEN tegen: een
   browser toont geen letter tot elk stijlblad binnen is. Die zeven worden er
   twee (gemeten: 1493 -> 1362 ms tot DOMContentLoaded bij 100 ms latentie en
   5 Mbit, drie ronden, mediaan).

   Samenvoegen mag alleen als de pagina er hetzelfde uitziet. Drie dingen
   kunnen dat breken, en dit bestand bewaakt ze alle drie:

     1. DE CASCADE. Twee bladen met een <style>-blok ertussen mogen NIET samen:
        wat eerst won, verliest dan opeens.
     2. WAT ERTUSSEN STOND. Tussen twee bladen kan een uitgesteld script staan.
        Dat hoort er na het samenvoegen nog steeds te staan -- een eerdere
        versie van deze laag gooide het weg, en dat is precies het soort fout
        dat je pas in een browser ziet.
     3. RELATIEVE url(). Die wordt opgelost tegen de URL van het BLAD. Onder een
        derde adres wijzen ze allemaal de verkeerde kant op, en dan valt de
        typografie om.

   En de deur: het adres van de bundel draagt de lijst zelf (er staat niets in
   het geheugen van de server), dus die lijst is door iedereen te verzinnen.
   Wat er uit mag komen is daarom scherp begrensd.

   Draai los: node --test test/stijlbundel.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { herschrijfHtml, absolutUrls, PAD } = require('../server/middleware/stijlbundel');

const link = (h) => '<link href="' + h + '" rel="stylesheet">';
const bundelHrefs = (html) => {
  const m = new RegExp('<link href="' + PAD.replace('.', '\\.') + '\\?f=([^"]+)"', 'g');
  const uit = []; let x;
  while ((x = m.exec(html))) uit.push(Buffer.from(x[1], 'base64url').toString('utf8').split('\n'));
  return uit;
};

test('1. een rij bladen wordt een verwijzing, in dezelfde volgorde', () => {
  const html = '<head>' + link('/a.css') + link('/b.css') + link('/c.css') + '</head>';
  const uit = herschrijfHtml(html);
  assert.equal(bundelHrefs(uit).length, 1, 'een bundel');
  assert.deepEqual(bundelHrefs(uit)[0], ['/a.css', '/b.css', '/c.css'], 'volgorde blijft de cascade');
  assert.equal((uit.match(/rel="stylesheet"/g) || []).length, 1, 'en er blijft een enkele link over');
});

test('2. een <style>-blok ertussen breekt de rij -- anders verschuift de cascade', () => {
  const html = '<head>' + link('/a.css') + link('/b.css') +
    '<style>.x{color:red}</style>' + link('/c.css') + '</head>';
  const uit = herschrijfHtml(html);
  const b = bundelHrefs(uit);
  assert.equal(b.length, 1, 'alleen de eerste twee gaan samen');
  assert.deepEqual(b[0], ['/a.css', '/b.css']);
  assert.ok(uit.includes(link('/c.css')), 'het blad na het <style>-blok blijft los staan');
  assert.ok(uit.includes('<style>.x{color:red}</style>'), 'en het blok zelf staat er nog');
});

test('3. een uitgesteld script ertussen mag, EN blijft staan', () => {
  const s = '<script src="/x.js" defer></script>';
  const html = '<head>' + link('/a.css') + s + link('/b.css') + '</head>';
  const uit = herschrijfHtml(html);
  assert.deepEqual(bundelHrefs(uit)[0], ['/a.css', '/b.css'], 'de rij loopt door over een uitgesteld script');
  assert.ok(uit.includes(s), 'en dat script staat er nog steeds -- het mag niet met de links mee verdwijnen');
});

test('4. een GEWOON script ertussen breekt de rij', () => {
  /* Dat draait tijdens het ontleden. Na samenvoegen zou het stijl zien die er
     op dat moment nog niet hoorde te zijn. */
  const html = '<head>' + link('/a.css') + '<script src="/x.js"></script>' + link('/b.css') + '</head>';
  assert.equal(bundelHrefs(herschrijfHtml(html)).length, 0, 'geen bundel over een gewoon script heen');
});

test('5. een link met een eigen gedrag doet niet mee', () => {
  for (const extra of ['media="print"', 'onload="x()"', 'fetchpriority="high"', 'disabled']) {
    const bijzonder = '<link href="/b.css" rel="stylesheet" ' + extra + '>';
    const html = '<head>' + link('/a.css') + bijzonder + link('/c.css') + '</head>';
    const b = bundelHrefs(herschrijfHtml(html));
    assert.equal(b.length, 0, 'met ' + extra + ' breekt de rij en blijft er niets over om te bundelen');
    assert.ok(herschrijfHtml(html).includes(bijzonder), 'en die link blijft ongemoeid: ' + extra);
  }
});

test('6. een enkel blad wordt niet gebundeld -- dat is geen winst, wel een omweg', () => {
  const html = '<head>' + link('/a.css') + '<style>x{}</style>' + link('/b.css') + '</head>';
  assert.equal(bundelHrefs(herschrijfHtml(html)).length, 0);
  assert.equal(herschrijfHtml(html), html, 'de pagina komt er onveranderd uit');
});

test('7. een adres dat niet van ons kan zijn, doet niet mee', () => {
  for (const h of ['https://cdn.example.com/a.css', '//cdn.example.com/a.css',
    '/../geheim.css', 'a.css', '/map/../a.css', '/a.css?v=1']) {
    const html = '<head>' + link(h) + link('/b.css') + link('/c.css') + '</head>';
    const b = bundelHrefs(herschrijfHtml(html));
    assert.ok(b.length === 0 || !b[0].includes(h), h + ' hoort er niet in te zitten');
    assert.ok(herschrijfHtml(html).includes(link(h)), h + ' blijft als losse link staan');
  }
});

test('8. relatieve url() wordt absoluut gemaakt tegen de eigen map', () => {
  const css = "@font-face{src:url(Inter.woff2)} .a{background:url('../beeld/x.png')}" +
    ".b{background:url(/al/absoluut.png)} .c{background:url(data:image/gif;base64,AAA)}" +
    ".d{background:url(https://x.example/y.png)}";
  const uit = absolutUrls(css, '/fonts');
  assert.ok(uit.includes('url(/fonts/Inter.woff2)'), 'naast het blad: ' + uit);
  assert.ok(uit.includes("url('/beeld/x.png')"), 'een map omhoog, met aanhalingstekens: ' + uit);
  assert.ok(uit.includes('url(/al/absoluut.png)'), 'al absoluut blijft absoluut');
  assert.ok(uit.includes('url(data:image/gif;base64,AAA)'), 'data: blijft data:');
  assert.ok(uit.includes('url(https://x.example/y.png)'), 'een volledige URL blijft heel');
});

/* Hier stond "een bundel op deze pagina", en dat klopte tot shared/maat.css
   erbij kwam. Die hangt achteraan, naast ios.css, want de maat van het toestel
   is het laatste woord over de maat van de inhoud -- en twee buren maken daar
   nu een tweede bundel van waar ios.css eerst alleen stond.

   Wat NIET veranderde is waar dit bestand over gaat: het aantal verzoeken dat
   het tekenen tegenhoudt. Dat was twee (een bundel plus die losse ios.css) en
   is nog steeds twee (twee bundels). Een blad erbij, nul verzoeken erbij.

   Daarom pint deze toets nu het GETAL dat telt in plaats van het getal dat
   toevallig een was. Dat is scherper dan eerst: `na < voor` liet elke waarde
   onder de negen door, ook zeven. */
test('9. de echte app-pagina: alles samen in twee verzoeken, en er raakt geen script zoek', () => {
  const fs = require('fs');
  const path = require('path');
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'app.html'), 'utf8');
  const uit = herschrijfHtml(bron);
  const b = bundelHrefs(uit);
  assert.equal(b.length, 2, 'twee bundels: de kop, en de staart (ios + maat) achter de eigen stijl van de pagina');
  assert.ok(b[0].length >= 5, 'de kopbundel heeft minstens vijf bladen: ' + b[0].join(', '));
  assert.deepEqual(b[1], ['/shared/ios.css', '/shared/maat.css'],
    'de staartbundel is de OS-laag en daarna de toestelmaat, in die volgorde: ' + b[1].join(', '));
  assert.equal((bron.match(/<script/g) || []).length, (uit.match(/<script/g) || []).length,
    'evenveel scripts voor als na -- er verdwijnt niets tussen de links vandaan');
  const voor = (bron.match(/<link[^>]*rel="stylesheet"/g) || []).length;
  const na = (uit.match(/<link[^>]*rel="stylesheet"/g) || []).length;
  assert.ok(na < voor, 'minder blokkerende verzoeken dan eerst: ' + voor + ' -> ' + na);
  assert.equal(na, 2, 'en het zijn er precies twee, niet "minder dan negen"');
});
