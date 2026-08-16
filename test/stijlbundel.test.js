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

test('4b. lange onafgesloten HTML tussen bladen is een snelle, harde grens', () => {
  const html = link('/a.css') + '<!--' + 'x'.repeat(200000) + link('/b.css');
  assert.equal(herschrijfHtml(html), html, 'geen regexp-terugloop en geen bundel over kapotte HTML');
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

test('9. de echte app-pagina: zes bladen samen, en er raakt geen script zoek', () => {
  const fs = require('fs');
  const path = require('path');
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'app.html'), 'utf8');
  const uit = herschrijfHtml(bron);
  const b = bundelHrefs(uit);
  assert.equal(b.length, 1, 'een bundel op deze pagina');
  assert.ok(b[0].length >= 5, 'met minstens vijf bladen erin: ' + b[0].join(', '));
  assert.equal((bron.match(/<script/g) || []).length, (uit.match(/<script/g) || []).length,
    'evenveel scripts voor als na -- er verdwijnt niets tussen de links vandaan');
  const voor = (bron.match(/<link[^>]*rel="stylesheet"/g) || []).length;
  const na = (uit.match(/<link[^>]*rel="stylesheet"/g) || []).length;
  assert.ok(na < voor, 'minder blokkerende verzoeken dan eerst: ' + voor + ' -> ' + na);
});

/* ==========================================================================
   DE ETAG. Tot hier ging deze toets over de HTML; dit gaat over wat de server
   antwoordt als de browser vraagt "is er iets veranderd?".

   WAAROM DIT ER STAAT. De ETag werd gemaakt door de STEMPEL af te kappen op 32
   tekens -- en die stempel is "grootte.mtime" per blad, achter elkaar. Die 32
   tekens dekten het eerste blad en een stukje van het tweede. Wijzigde je het
   vijfde blad, dan bleef de ETag letterlijk gelijk en zei de server 304 Not
   Modified: de browser hield zijn oude stijl, terwijl op schijf alles klopte.

   Zo is hij ook gevonden: een verbouwde canvas.css (het vijfde blad van de
   wereldschermen) kwam in de browser niet aan, drie keer achter elkaar.
   ========================================================================== */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { stijlbundel } = require('../server/middleware/stijlbundel');

function proefBundel(bladen) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sb-'));
  for (const [naam, inhoud] of Object.entries(bladen)) fs.writeFileSync(path.join(dir, naam), inhoud);
  const mw = stijlbundel(dir);
  const f = Buffer.from(Object.keys(bladen).map((n) => '/' + n).join('\n')).toString('base64url');
  // een minimale req/res: genoeg om de kop en de status te lezen
  const haal = (etag) => new Promise((klaar) => {
    const koppen = {};
    const res = {
      statusCode: 200, setHeader: (k, v) => { koppen[k] = v; }, getHeader: (k) => koppen[k],
      end: (body) => klaar({ status: res.statusCode, koppen, body: body ? String(body) : '' })
    };
    mw({ path: '/stijlbundel.css', query: { f }, headers: etag ? { 'if-none-match': etag } : {} },
      res, () => klaar({ status: 404, koppen, body: '' }));
  });
  return { dir, haal, raak: (naam, inhoud) => fs.writeFileSync(path.join(dir, naam), inhoud) };
}

test('10. de ETag dekt ELK blad, ook het laatste', async () => {
  /* DE MUTATIE DIE DEZE TOETS HOORT TE LATEN ZAKKEN: zet in stijlbundel.js de
     hash terug naar `Buffer.from(stempel).toString('base64url').slice(0, 32)`.
     Dan verandert de ETag hieronder niet meer en zakt deze toets -- precies de
     fout die in productie een browser op een oude stijl laat staan. */
  const p = proefBundel({ 'a.css': '.a{color:red}', 'b.css': '.b{color:teal}',
    'c.css': '.c{color:gold}', 'd.css': '.d{color:navy}', 'e.css': '.e{color:olive}' });
  const eerst = await p.haal();
  assert.equal(eerst.status, 200);
  assert.ok(eerst.koppen.ETag, 'een bundel hoort een ETag te dragen');
  assert.ok(eerst.body.includes('olive'), 'het laatste blad zit er ook echt in');

  // dezelfde vraag met dezelfde ETag: niets veranderd, dus 304 -- dat mag
  assert.equal((await p.haal(eerst.koppen.ETag)).status, 304, 'onveranderd hoort 304 te geven');

  // en nu verandert ALLEEN het laatste blad
  p.raak('e.css', '.e{color:fuchsia;padding:1px}');
  const na = await p.haal();
  assert.notEqual(na.koppen.ETag, eerst.koppen.ETag,
    'de ETag hoort te veranderen als het laatste blad verandert; anders blijft de browser op de oude stijl staan');
  assert.ok(na.body.includes('fuchsia'), 'de nieuwe inhoud wordt wel degelijk geserveerd');
  assert.equal((await p.haal(eerst.koppen.ETag)).status, 200,
    'met de OUDE ETag hoort er 200 met nieuwe inhoud te komen, geen 304');
  fs.rmSync(p.dir, { recursive: true, force: true });
});
