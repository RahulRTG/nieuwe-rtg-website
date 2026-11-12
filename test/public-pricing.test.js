/* Openbare publicatie van PRIJZEN.md §7.3 en §9.3, geen verkoopkwalificatie.
   Deze verwachtingen zijn testvoorbeelden van het eigenaarsbesluit, geen tweede
   runtime-prijscatalogus. De bestaande app-ladder migreert niet door deze proef. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const POLICY = '2026-11-12.1';
const CASES = [
  { id: 'rtg', file: 'rtg-pass', month: 6500, vat: 'incl', floor: false },
  { id: 'business-lite', file: 'business-lite', month: 15000, vat: 'excl', floor: false },
  { id: 'business', file: 'business-pass', month: 350000, vat: 'excl', floor: true },
  { id: 'lifestyle', file: 'lifestyle-pass', month: 1400000, vat: 'incl', floor: false }
];
const PASS_FILES = ['community', ...CASES.map(c => c.file)].map(f => 'public/site/passen/' + f + '.html');
const PUBLIC_FILES = ['index.html', ...PASS_FILES];
const text = html => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|#160);/g, ' ').replace(/&euro;/g, '€')
  .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const escape = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const euro = cents => (cents / 100).toLocaleString('nl-NL', {
  minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2
});
function hasAmount(copy, cents, context) {
  assert.match(copy, new RegExp('€\\s*' + escape(euro(cents)) + '(?![\\d,.])'), context);
}
function tagged(html, attr) {
  const found = html.match(new RegExp('<([a-z][a-z0-9]*)\\b[^>]*\\b' + attr + '(?:="[^"]*")?[^>]*>([\\s\\S]*?)<\\/\\1>', 'i'));
  assert.ok(found, attr + ' is present');
  return text(found[2]);
}
function page(file) { return read('public/site/passen/' + file + '.html'); }
function policy() {
  const html = read('index.html');
  const found = /<([a-z][a-z0-9]*)\b[^>]*\bid="prijsbeleid"[^>]*>/i.exec(html);
  assert.ok(found, 'de bestaande homepage draagt de volledige nieuwe beleidsuitleg');
  const start = found.index + found[0].length;
  const tags = new RegExp('<(\\/?)' + found[1] + '\\b[^>]*>', 'gi');
  tags.lastIndex = start;
  let depth = 1, tag;
  while ((tag = tags.exec(html))) {
    depth += tag[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, tag.index);
  }
  assert.fail('prijsbeleid heeft geen sluitende HTML-grens');
}

for (const c of CASES) {
  test(c.id + ': beleidsprijs, btw en beide jaarbedragen zijn zichtbaar en juist', () => {
    const html = page(c.file), copy = text(html), price = tagged(html, 'data-policy-price');
    assert.match(html, new RegExp('data-pass="' + c.id + '"'));
    assert.match(html, new RegExp('data-commercial-policy="' + escape(POLICY) + '"'));
    hasAmount(price, c.month, 'maandbasis volgens het besluit');
    assert.equal(/vanaf/i.test(price), c.floor, 'alleen Business is een contractuele bodem');
    assert.match(tagged(html, 'data-policy-billing'), new RegExp(c.vat + '(?:usief|\\.)?\\s+btw', 'i'));
    hasAmount(copy, c.month * 12, 'twaalf termijnen worden niet als maandopzegbaar verkocht');
    hasAmount(copy, c.month * 11.5, 'jaar vooruit kost elf en een halve maandbasis');
    assert.match(copy, /(?:twaalf|12)\s+maand(?:en|termijnen)/i);
    assert.match(copy, /vooruit/i);
    assert.doesNotMatch(copy, /(?:vrij|altijd)\s+maandelijks\s+opzegbaar/i);
  });
}

test('het bestaande passenoverzicht publiceert dezelfde basisprijzen zonder de oude bedragen', () => {
  const html = read('index.html');
  for (const c of CASES) {
    const row = html.match(new RegExp('<tr\\b[^>]*data-app-truth-pass="' + c.id + '"[^>]*>([\\s\\S]*?)<\\/tr>'));
    assert.ok(row, c.id + ' houdt zijn bestaande productidentiteit');
    const copy = text(row[1]);
    hasAmount(copy, c.month, c.id + ' heeft de afgesproken maandbasis');
    hasAmount(copy, c.month * 12, c.id + ' toont twaalf termijnen');
    hasAmount(copy, c.month * 11.5, c.id + ' toont dezelfde jaarvooruitbetaling');
    assert.match(copy, new RegExp(c.vat + '(?:usief|\\.)?\\s+btw', 'i'));
    assert.equal(/vanaf/i.test(tagged(row[0], 'data-policy-price')), c.floor);
  }
  assert.doesNotMatch(text(html), /(?:vanaf\s*)?€\s*(?:5\.000|20\.000)(?!\d)/i,
    'de historische contractbodems staan niet als actuele prijzen op www');
});

test('alle paspagina’s maken publicatie, beschikbaarheid en afsluiten zichtbaar verschillend', () => {
  for (const file of PASS_FILES) {
    const html = read(file), copy = text(html);
    assert.match(html, /id="beschikbaarheid"/, file + ' biedt een bereikbaar beschikbaarheidsblok');
    assert.match(copy, /nog niet (?:boekbaar|te boeken|verkoopklaar|vrijgegeven)/i, file + ' belooft geen vrijgegeven nieuwe formule');
    assert.match(html, /href="#beschikbaarheid"/, file + ' laat de bezoeker de status lezen');
    assert.doesNotMatch(html, /href="[^"\s]*(?:checkout|buy\.stripe\.com|payment[_-]?link|\/subscribe)(?:[/?#.]|\b)/i,
      file + ' introduceert geen checkout');
    assert.doesNotMatch(html, /<form\b[^>]*\baction="[^"\s]*(?:betaling|contract|aanmelding|checkout)/i,
      file + ' sluit geen overeenkomst via een nieuw formulier');
  }
});

test('gratis zakelijk behoudt nul abonnement, met de 15%-verkopersuitzondering', () => {
  const copy = text(page('community'));
  assert.match(tagged(page('community'), 'data-policy-price'), /(?:kosteloos|gratis|€\s*0)/i);
  for (const begrip of [/salon/i, /(?:product|verkop)/i, /klanten(?:bestand|beheer)/i, /15\s*%/]) {
    assert.match(copy, begrip);
  }
  assert.match(copy, /(?:betaald|betalend)[\s\S]{0,100}(?:koper|lid)|(?:koper|lid)[\s\S]{0,100}(?:betaald|betalend)/i);
});

test('de openbare regels bevatten alle vier commissievakken en geen algemene nulbelofte', () => {
  const html = policy();
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => text(m[1]));
  assert.ok(rows.some(r => /gratis.*ondernemer|gratis.*verkoper/i.test(r) && /15\s*%[\s\S]*15\s*%/.test(r)),
    'gratis verkoper betaalt 15% bij beide kopers');
  assert.ok(rows.some(r => /betaald.*ondernemer|betaald.*verkoper/i.test(r) && /5\s*%[\s\S]*0\s*%/.test(r)),
    'betaalde verkoper betaalt 5% bij gratis en 0% bij betaalde koper');
  for (const file of PUBLIC_FILES) {
    const copy = text(read(file));
    assert.doesNotMatch(copy, /zonder omzetcommissie|geen omzetcommissie|geen commissie, geen transactiekosten/i,
      file + ' draagt de oude universele nulbelofte niet');
    assert.doesNotMatch(copy, /(?:verdient|rekent)\s+(?:RTG\s+)?(?:nooit|geen)\s+commissie\s+(?:op|aan)\s+(?:alle\s+)?(?:aankopen|verkopen)\s+(?:van|aan)\s+betaalde/i,
      file + ' verzwijgt de gratis-verkoperuitzondering niet');
  }
});

test('het openbare prijsbeleid scheidt commissie, btw, providerkosten en bestaande rechten', () => {
  const copy = text(policy());
  assert.match(copy, /(?:excl(?:usief|\.)?|exclusief)[\s\S]{0,50}btw/i);
  assert.match(copy, /(?:provider|betaalverwerkings)kosten/i);
  assert.match(copy, /(?:geen|zonder)\s+(?:RTG-)?opslag/i);
  assert.match(copy, /(?:bestaande|lopende)[\s\S]{0,100}(?:overeenkomsten|rechten|afspraken|contracten)/i);
  assert.match(copy, /(?:retour|teruggedraaid|refund|credit)/i);
  assert.match(copy, /(?:geleverd|geleverde)[\s\S]{0,50}(?:betaald|ontvangen)/i);
});

test('beleidspublicatie is geen nieuw algemeen contract of geactiveerd verkooppad', () => {
  const html = read('index.html'), copy = text(policy());
  assert.match(html, new RegExp('data-commercial-policy="' + escape(POLICY) + '"'));
  assert.match(text(html), /(?:nog niet|geen)[\s\S]{0,50}(?:boekbaar|verkoopvrijgave|geactiveerd|vrijgegeven)/i);
  assert.match(copy, /(?:bestaande|lopende)[\s\S]{0,100}(?:overeenkomsten|rechten|afspraken|contracten)/i);
  const links = [...html.matchAll(/<a\b[^>]*href="[^\"]*apps\/juridisch\/(?:partner)?voorwaarden\.html"[^>]*>([\s\S]*?)<\/a>/gi)];
  assert.ok(links.length > 0, 'de bestaande dienstverleningsvoorwaarden blijven vindbaar');
  for (const link of links) assert.match(text(link[1]), /bestaand/i, 'oude contracttekst is geen nieuwe beleidsacceptatie');
  assert.doesNotMatch(html, /href="[^"\s]*(?:checkout|buy\.stripe\.com|payment[_-]?link|\/subscribe)(?:[/?#.]|\b)/i);
});

test('prijsbeleid onderscheidt eigen reizen, externe reizen en de Foundation-grondslag', () => {
  const copy = text(policy());
  assert.match(copy, /(?:eigen|zelf)[\s\S]{0,120}(?:verantwoordelijkheid|organisator)/i);
  assert.match(copy, /(?:ander|extern)[\s\S]{0,100}reisbureau[\s\S]{0,120}buiten/i);
  assert.match(copy, /30\s*%[\s\S]{0,100}lidbijdragen[\s\S]{0,50}exclusief btw/i);
  assert.match(copy, /(?:niet|geen)\s+30\s*%[\s\S]{0,70}reissommen/i);
  assert.match(copy, /(?:creditnota|creditering)[\s\S]{0,70}niet[\s\S]{0,70}terugbetaling/i);
});

test('de dynamische footer gebruikt afzonderlijke tekst voor bestaande dienstverlening', () => {
  const window = {};
  vm.runInNewContext(read('public/site/platform-data.js'), { window });
  assert.equal(window.RTGPublicContent.common.existingTerms, 'existingTerms');
  const wording = window.RTGPublicContent.words.existingTerms;
  assert.ok(Array.isArray(wording), 'de bestaande vertaallaag draagt de nieuwe betekenis');
  assert.match(wording[0], /bestaand/i);
  assert.match(wording[1], /existing/i);
  assert.match(read('public/site/platform-app.js'),
    /\[\s*['"]existingTerms['"]\s*,\s*['"][^'"]*\/apps\/juridisch\/voorwaarden\.html['"]\s*\]/,
    'de werkelijk opgebouwde footer gebruikt die context, niet alleen de statische HTML');
});

/* Een kleine DOM-adapter voor uitsluitend de werkelijk gebruikte prijsbinding.
   De controle eronder bewijst eerst dat dezelfde adapter oude selectors WEL
   laat overschrijven; de beschermingsproef kan dus niet vacuüm groen zijn. */
function priceDom(html) {
  const nodes = new Map();
  for (const m of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bdata-(?:policy|app-truth)-(?:price|billing)[^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const node = { textContent: text(m[3]) };
    for (const a of m[2].matchAll(/\b(data-(?:policy|app-truth)-(?:price|billing))\b/g)) nodes.set(a[1], node);
  }
  return { nodes, dataset: {}, querySelector: selector => nodes.get(selector.slice(1, -1)) || null };
}
function refreshPrices(body, cards) {
  const document = { baseURI: 'https://www.example.test/public/site/passen/rtg-pass.html', body,
    documentElement: { dataset: {} }, querySelector: () => null,
    querySelectorAll: selector => selector === '[data-app-truth-pass]' ? cards : [] };
  const window = { dispatchEvent() {} };
  vm.runInNewContext(read('public/site/website-truth.js'), {
    window, document, URL, CustomEvent: function () {}, fetch: () => new Promise(() => {})
  });
  const passes = Object.fromEntries(['community', ...CASES.map(c => c.id)].map(id => [id,
    { name: id, priceLabel: 'OUDE RUNTIMEPRIJS', billingNote: 'OUDE BTW-BASIS' }]));
  window.RTGWebsiteTruthRefresh({ worlds: {}, platform: [], passes });
}

test('de prijsbindingsproef raakt werkelijk de oude runtime-selectors', () => {
  const body = priceDom('<strong data-app-truth-price>origineel</strong><span data-app-truth-billing>origineel</span>');
  body.dataset.pass = 'rtg';
  refreshPrices(body, []);
  assert.equal(body.nodes.get('data-app-truth-price').textContent, 'OUDE RUNTIMEPRIJS');
  assert.equal(body.nodes.get('data-app-truth-billing').textContent, 'OUDE BTW-BASIS');
});

test('oude appwaarheid overschrijft geen gepubliceerde beleidsprijs of btw-uitleg', () => {
  for (const file of PASS_FILES) {
    const html = read(file), body = priceDom(html);
    body.dataset.pass = html.match(/\bdata-pass="([^"]+)"/)[1];
    const expected = [...body.nodes.entries()].map(([key, node]) => [key, node.textContent]);
    assert.ok(body.nodes.has('data-policy-price'), file + ' gebruikt de beleidsprijs');
    assert.ok(body.nodes.has('data-policy-billing'), file + ' gebruikt de beleids-btw');
    refreshPrices(body, []);
    assert.deepEqual([...body.nodes.entries()].map(([key, node]) => [key, node.textContent]), expected, file);
  }
  const rows = [...read('index.html').matchAll(/<tr\b[^>]*data-app-truth-pass="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)];
  assert.equal(rows.length, 5);
  const cards = rows.map(m => Object.assign(priceDom(m[2]), { dataset: { appTruthPass: m[1] } }));
  const expected = cards.map(card => [...card.nodes.values()].map(n => n.textContent));
  for (const card of cards) assert.ok(card.nodes.has('data-policy-price'));
  refreshPrices(priceDom(''), cards);
  assert.deepEqual(cards.map(card => [...card.nodes.values()].map(n => n.textContent)), expected);
});

test('de openbare startscripts sluiten geen contract en muteren geen geld', () => {
  for (const file of ['public/site/start/start.js', 'public/site/start/experience.js']) {
    const script = read(file);
    assert.doesNotMatch(script, /(?:checkout|paymentIntents|setupIntents|createSubscription|\/api\/(?:aanmelding|betalen|pay|commercie))/i, file);
    assert.doesNotMatch(script, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i, file);
  }
});
