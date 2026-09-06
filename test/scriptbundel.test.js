/* De uitgestelde scripts in een verzoek -- en waarom dat lang NIET mocht.

   In de kop van server/middleware/stijlbundel.js staat het argument dat scripts
   met rust liet: "gooit de eerste een fout, dan draait de tweede in het eerste
   geval gewoon door en in het tweede geval niet meer". Dat klopt, en het is
   precies de storing waar dit huis deze week op stukliep.

   De bundel neemt dat verschil weg door elk bestand zijn eigen try/catch te
   geven. Deze toetsen bewaken dat, plus de drie regels die bepalen wat er
   uberhaupt samen mag. Zonder die regels is samenvoegen geen optimalisatie maar
   een andere pagina.

   Draai los: node --test test/scriptbundel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { herschrijfHtml, omwikkel } = require('../server/middleware/scriptbundel');

test('een fout in het ene script sleept het volgende niet mee', () => {
  /* DE KERNBELOFTE. Dit is de enige reden dat samenvoegen hier mag; valt deze
     toets, dan is de bundel een verslechtering en geen verbetering. */
  const bundel = omwikkel('/a.js', 'throw new Error("a stuk")') +
                 omwikkel('/b.js', 'globalThis.__sbB = true');
  delete globalThis.__sbB;
  const stil = console.error; console.error = () => {};
  try { new Function(bundel)(); } finally { console.error = stil; }
  assert.equal(globalThis.__sbB, true, 'het tweede script draait ook als het eerste gooit');
  delete globalThis.__sbB;
  assert.match(omwikkel('/x.js', ''), /console\.error\("\[rtg\] script \/x\.js/,
    'en de melding noemt het bestand bij naam -- dat doen losse tags niet eens');
});

test('alleen uitgestelde scripts doen mee', () => {
  const html = '<script src="/a.js" defer></script>\n<script src="/b.js" defer></script>';
  assert.match(herschrijfHtml(html), /scriptbundel\.js\?f=/, 'twee uitgestelde worden er een');

  for (const [wat, tag] of [
    ['gewoon script', '<script src="/x.js"></script>'],
    ['async', '<script src="/x.js" async defer></script>'],
    ['module', '<script src="/x.js" type="module" defer></script>'],
    ['integriteit', '<script src="/x.js" integrity="sha" defer></script>'],
    ['vreemd adres', '<script src="//cdn.example.com/x.js" defer></script>']
  ]) {
    const uit = herschrijfHtml('<script src="/a.js" defer></script>\n' + tag);
    assert.ok(!/scriptbundel/.test(uit), wat + ' hoort de rij te breken, niet mee te gaan');
  }
});

test('wat ertussen staat breekt de rij', () => {
  /* Een gewoon script tussen twee uitgestelde draait op zijn eigen moment; die
     volgorde mogen we niet stil veranderen. Commentaar en witruimte wel. */
  const gebroken = herschrijfHtml('<script src="/a.js" defer></script><script src="/m.js"></script><script src="/b.js" defer></script>');
  assert.ok(!/scriptbundel/.test(gebroken), 'een gewoon script ertussen breekt de rij');

  const heel = herschrijfHtml('<script src="/a.js" defer></script>\n<!-- uitleg -->\n<script src="/b.js" defer></script>');
  assert.match(heel, /scriptbundel/, 'commentaar en witruimte breken hem niet');
});

test('een lange onafgesloten HTML-constructie kost lineair werk en bundelt niets', () => {
  const html = '<script src="/a.js" defer></script><!--' + 'x'.repeat(200000) +
    '<script src="/b.js" defer></script>';
  assert.equal(herschrijfHtml(html), html, 'onafgesloten commentaar is een harde rijgrens');
  const metInhoud = '<script defer src="/a.js">tekst met <script src="/vals.js" defer></script></script>' +
    '<script src="/b.js" defer></script>';
  assert.equal(herschrijfHtml(metInhoud), metInhoud, 'scriptinhoud wordt nooit als losse HTML-tags gefilterd');
});

test('een rij van een is geen winst', () => {
  const uit = herschrijfHtml('<script src="/a.js" defer></script>\n<script src="/x.js"></script>');
  assert.ok(!/scriptbundel/.test(uit), 'een enkel script blijft gewoon staan');
});

test('de lijst zit IN de verwijzing, niet in een tabel op de server', () => {
  /* Zelfde keuze als bij de stijlbundel: een tabel is na een herstart leeg, en
     dan krijgt een pagina die al openstond een 404 op haar eigen scripts. */
  const uit = herschrijfHtml('<script src="/shared/a.js" defer></script>\n<script src="/shared/b.js" defer></script>');
  const m = /scriptbundel\.js\?f=([A-Za-z0-9_-]+)/.exec(uit);
  assert.ok(m, 'er staat een verwijzing met een lijst erin');
  const paden = Buffer.from(m[1], 'base64url').toString('utf8').split('\n');
  assert.deepEqual(paden, ['/shared/a.js', '/shared/b.js'], 'en die lijst beschrijft zichzelf');
});

/* De URL van een scriptbundel draagt bewust alleen de bronlijst. Daarom moet
   de ETag ieder bestand uit die lijst dekken: verandert bijvoorbeeld basis.js
   aan het einde, dan moet een browser met de oude validator 200 + nieuwe code
   krijgen en nooit een onterechte 304. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scriptbundel } = require('../server/middleware/scriptbundel');

function proefBundel(scripts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scb-'));
  for (const [naam, inhoud] of Object.entries(scripts)) fs.writeFileSync(path.join(dir, naam), inhoud);
  const mw = scriptbundel(dir);
  const f = Buffer.from(Object.keys(scripts).map((naam) => '/' + naam).join('\n')).toString('base64url');
  const haal = (etag) => new Promise((klaar) => {
    const koppen = {};
    const res = {
      statusCode: 200,
      setHeader: (k, v) => { koppen[k] = v; },
      type: () => res,
      status: (code) => { res.statusCode = code; return res; },
      send: (body) => klaar({ status: res.statusCode, koppen, body: String(body || '') }),
      end: (body) => klaar({ status: res.statusCode, koppen, body: body ? String(body) : '' })
    };
    mw({ path: '/scriptbundel.js', query: { f }, headers: etag ? { 'if-none-match': etag } : {} },
      res, () => klaar({ status: 404, koppen, body: '' }));
  });
  return { dir, haal, raak: (naam, inhoud) => fs.writeFileSync(path.join(dir, naam), inhoud) };
}

test('de ETag dekt elk script, ook het laatste', async () => {
  const p = proefBundel({
    'a.js': 'globalThis.a = "alfa";',
    'b.js': 'globalThis.b = "bravo";',
    'c.js': 'globalThis.c = "charlie";',
    'd.js': 'globalThis.d = "delta";',
    'basis.js': 'globalThis.basis = "oud";'
  });
  try {
    const eerst = await p.haal();
    assert.equal(eerst.status, 200);
    assert.ok(eerst.koppen.ETag, 'de bundel draagt een validator');
    assert.ok(eerst.body.includes('"oud"'), 'de oude laatste bron zit in de eerste respons');
    assert.equal((await p.haal(eerst.koppen.ETag)).status, 304, 'ongewijzigd mag 304 geven');

    p.raak('basis.js', 'globalThis.basis = "nieuw en langer";');
    const na = await p.haal(eerst.koppen.ETag);
    assert.equal(na.status, 200, 'de oude validator krijgt na een bronwijziging nieuwe inhoud');
    assert.notEqual(na.koppen.ETag, eerst.koppen.ETag, 'de validator verandert mee met het laatste script');
    assert.ok(na.body.includes('"nieuw en langer"'), 'de nieuwe broncode wordt uitgeleverd');
  } finally {
    fs.rmSync(p.dir, { recursive: true, force: true });
  }
});
