/* De uitgestelde scripts in een verzoek -- en waarom dat lang NIET mocht.

   In de kop van server/middleware/stijlbundel.js staat het argument dat scripts
   met rust liet: "gooit de eerste een fout, dan draait de tweede in het eerste
   geval gewoon door en in het tweede geval niet meer". Dat klopt, en het is
   precies de storing waar dit huis deze week op stukliep.

   De bundel neemt dat verschil weg door elk bestand zijn eigen try/catch te
   geven. Deze toetsen bewaken dat, plus de drie regels die bepalen wat er
   uberhaupt samen mag. Zonder die regels is samenvoegen geen optimalisatie maar
   een andere pagina.

   Draai los: node --experimental-sqlite --test test/scriptbundel.test.js */
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
