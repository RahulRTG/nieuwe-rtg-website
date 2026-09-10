/* Het universele 114-talige vangnet. De browserlaag is bewust dependency-vrij;
   met een klein DOM-dubbel bewijzen we de selectie en RTL-richting, en met de
   paginascan dat ieder blijvend appscherm de gedeelde taalrail werkelijk laadt. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { maakUiBronnen } = require('../server/lib/ui-bronnen');
const { MERK: IJKMERK } = require('../scripts/lib/schonebron');

const ROOT = path.join(__dirname, '..');

/* De vangnetlaag staat in drie delen: de kast (die een navigatie overleeft),
   de lezer en de schrijver. Ze vormen samen een IIFE plus een losse kast, en de
   bundel plakt ze aaneen -- dus laadt de toets ze ook alle drie. Zonder opslag,
   want een toets hoort de vorige toets niet te kunnen ruiken. */
/* AFGELEID EN NIET OVERGETYPT. Dit stond als handlijst en liep meteen achter
   toen i18n-00a.js (de meegeleverde taalschil) erbij kwam: de toets draaide dan
   een andere laag dan de browser krijgt, en dekte de nieuwe leesweg niet. De
   autolaag is precies de reeks `i18n-00*`; scripts/bundel.js plakt ze in
   dezelfde volgorde aaneen. */
const AUTODELEN = fs.readdirSync(path.join(ROOT, 'public/shared/i18n'))
  .filter(f => /^i18n-00.*\.js$/.test(f)).sort();

function autoLaag(opslag) {
  const attrs = {};
  const documentElement = {
    getAttribute: n => Object.prototype.hasOwnProperty.call(attrs, n) ? attrs[n] : null,
    setAttribute: (n, v) => { attrs[n] = String(v); },
    removeAttribute: n => { delete attrs[n]; }
  };
  const window = { addEventListener: () => {} };
  if (opslag) window.localStorage = opslag;
  const context = { window, document: { documentElement, visibilityState: 'visible' },
  MutationObserver: function () {
    this.observe = () => {};
  }, setTimeout: () => 1, clearTimeout: () => {}, fetch: () => Promise.reject(new Error('niet aanroepen')),
  location: { pathname: '/apps/proef.html' }, NodeFilter: { SHOW_TEXT: 4 } };
  context.window.document = context.document;
  /* Aaneengeplakt en niet per deel: 00b en 00c zijn de twee helften van EEN
     IIFE, en los draaien geeft "Unexpected end of input". De bundel doet
     precies dit (scripts/bundel.js), dus de toets draait wat de browser krijgt. */
  const bron = AUTODELEN.map(d => fs.readFileSync(path.join(ROOT, 'public/shared/i18n', d), 'utf8')).join('');
  vm.runInNewContext(bron, context);
  return { laag: window.RTGAutoVertaling, kast: window.RTGVertaalKast, attrs };
}

/* Een localStorage-dubbel: genoeg om te bewijzen dat de kast er werkelijk in
   schrijft en er bij een VOLGENDE pagina weer uit leest. */
function opslagDubbel(start) {
  const map = new Map(Object.entries(start || {}));
  return {
    get length() { return map.size; },
    key: i => Array.from(map.keys())[i] ?? null,
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
    _map: map
  };
}

test('automatische UI-laag vertaalt mensentaal, maar geen adressen of technische paden', () => {
  const { laag } = autoLaag();
  assert.equal(laag.kandidaat('Boek deze reis'), true);
  assert.equal(laag.kandidaat('日本語で続ける'), true, 'niet-Latijnse interface telt ook als taal');
  assert.equal(laag.kandidaat('https://rtg.example/app'), false);
  assert.equal(laag.kandidaat('rahul@example.com'), false);
  assert.equal(laag.kandidaat('/api/member/state'), false);
});

test('automatische UI-laag zet schrift-richting per taal en herstelt de basis', () => {
  const { laag, attrs } = autoLaag();
  laag.apply('ar');
  assert.equal(attrs.dir, 'rtl');
  assert.equal(attrs['data-rtg-taal'], 'ar');
  laag.apply('ja');
  assert.equal(attrs.dir, 'ltr');
  laag.apply('nl');
  assert.equal(attrs.dir, undefined);
});

function loop(dir, uit) {
  for (const naam of fs.readdirSync(dir)) {
    if (naam.includes(IJKMERK)) continue;             // een ijkrestant is geen scherm; zie scripts/lib/schonebron.js
    const p = path.join(dir, naam), st = fs.statSync(p);
    if (st.isDirectory()) loop(p, uit); else if (naam.endsWith('.html')) uit.push(p);
  }
}

test('IEDERE blijvende pagina bereikt de universele i18n-laag', () => {
  /* Dit liep over public/apps, en dat was de app-familie en niet het huis. De
     negen publieke verhaalpagina's (de vier werelden, de vijf passen) vielen
     erbuiten en stonden daardoor vast in het Nederlands -- terwijl dat juist de
     eerste pagina is die een bezoeker van buiten Nederland ziet. De telling
     gaat nu over de HELE webroot; een omleiding van drie regels telt niet mee
     (die staat er 0 ms en draagt geen tekst om te vertalen). */
  const paginas = [];
  loop(path.join(ROOT, 'public'), paginas);
  const zonder = [];
  for (const p of paginas) {
    const html = fs.readFileSync(p, 'utf8');
    const omleiding = /<meta[^>]+http-equiv=["']refresh["'][^>]+url=\/[^"'>]+/i.test(html) &&
      !/<script[^>]+src=/i.test(html);
    if (!omleiding && !/shared\/basis\.js|shared\/i18n\.js/.test(html))
      zonder.push(path.relative(ROOT, p));
  }
  assert.deepEqual(zonder, []);
  assert.ok(paginas.length > 300, 'de telling loopt werkelijk over de hele webroot, niet over een map');
  assert.match(fs.readFileSync(path.join(ROOT, 'public/shared/basis/basis-01.js'), 'utf8'), /shared\/i18n\.js/);
  assert.match(fs.readFileSync(path.join(ROOT, 'public/shared/i18n/i18n-00c.js'), 'utf8'), /MutationObserver/);
});

/* ---- de kast: waarom een tweede pagina geen netwerk meer kost ------------
   Dit was de duurste stille kostenpost van de 114 talen: de vertaling stond in
   een Map in de scope van de pagina, dus elke navigatie vroeg de server opnieuw
   de hele wereld -- ook de balk en het menu die op elk scherm hetzelfde zeggen.
   Deze drie toetsen leggen vast dat dat niet terugkomt. */

test('een vertaling overleeft een navigatie', () => {
  const opslag = opslagDubbel();
  const een = autoLaag(opslag);
  een.kast.zet('ja', 'Boek deze reis', 'この旅行を予約する');
  een.kast.bewaarNu();
  assert.ok(opslag.getItem('rtg_tr_ja'), 'de kast schrijft naar het toestel');

  // een tweede autoLaag() is een tweede paginabezoek: niets in het geheugen
  const twee = autoLaag(opslag);
  assert.equal(twee.kast.lees('ja', 'Boek deze reis'), 'この旅行を予約する');
  assert.equal(twee.kast.lees('ja', 'Nooit vertaald'), null, 'wat er niet is, is null');
});

test('een regel gelijk aan zijn bron is geen vertaling en komt de kast niet in', () => {
  const { kast } = autoLaag(opslagDubbel());
  assert.equal(kast.zet('de', 'Salon', 'Salon'), false);
  assert.equal(kast.lees('de', 'Salon'), null);
  assert.equal(kast.zet('nl', 'Opslaan', 'Opslaan!'), false, 'de brontaal heeft geen kast');
});

test('een volle opslag kost de kasten van andere talen, niet het scherm', () => {
  /* De weg die alleen bij een volle opslag loopt, en die je daarom nooit ziet
     tot hij ertoe doet. Een mens leest in EEN taal, dus de kasten van talen
     waar hij doorheen klikte zijn de goedkoopste ruimte om op te geven. */
  const opslag = opslagDubbel({ 'rtg_tr_fr': '{"a":"b"}', 'rtg_tr_es': '{"a":"b"}', 'rtg_lang': 'ja' });
  let vol = true;
  const echt = opslag.setItem;
  opslag.setItem = (k, v) => {
    // vol blijft het tot de andere taalkasten weg zijn
    if (vol && k.indexOf('rtg_tr_') === 0 && (opslag.getItem('rtg_tr_fr') || opslag.getItem('rtg_tr_es'))) {
      const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e;
    }
    echt(k, v);
  };
  const { kast } = autoLaag(opslag);
  kast.zet('ja', 'Boek deze reis', 'この旅行を予約する');
  kast.bewaarNu();

  assert.equal(opslag.getItem('rtg_tr_fr'), null, 'de kast van een taal die niet gelezen wordt is opgegeven');
  assert.equal(opslag.getItem('rtg_tr_es'), null);
  assert.ok(opslag.getItem('rtg_tr_ja'), 'en de taal die NU gelezen wordt is alsnog bewaard');
  assert.equal(opslag.getItem('rtg_lang'), 'ja', 'wat niet van de kast is blijft staan');
  assert.equal(kast.lees('ja', 'Boek deze reis'), 'この旅行を予約する', 'het scherm verliest niets');
  vol = false;
});

test('de kast ruimt de oude opslag-per-pagina eenmalig op', () => {
  const opslag = opslagDubbel({
    'rtg_ui_ja_appsgeldhtml_400': '{"a":"b"}',
    'rtg_ui_ja_appsreizenhtml_400': '{"a":"b"}',
    'rtg_lang': 'ja'
  });
  autoLaag(opslag);
  assert.equal(opslag.getItem('rtg_ui_ja_appsgeldhtml_400'), null, 'de opslag-per-pagina is weg');
  assert.equal(opslag.getItem('rtg_lang'), 'ja', 'en de rest blijft ongemoeid');
  assert.equal(opslag.getItem('rtg_tr_opgeruimd'), '1', 'en het gebeurt maar een keer');
});

test('de sleutelweg deelt de kast van de vangnetlaag', () => {
  const bron = fs.readFileSync(path.join(ROOT, 'public/shared/i18n/i18n-01.js'), 'utf8');
  assert.match(bron, /window\.RTGVertaalKast/,
    'laadWereldDict leest uit dezelfde kast als de automatische laag');
  assert.doesNotMatch(bron, /'rtg_ui_' \+ lang/,
    'geen tweede opslag per PAD: dezelfde knop op twee schermen is een vertaling');
  assert.match(bron, /teksten: missend\.map/,
    'alleen de ontbrekende regels gaan over de lijn, niet telkens alle vierhonderd');
});

test('alleen aantoonbare code-interface mag naar een externe UI-vertaler', () => {
  const bronnen = maakUiBronnen(path.join(ROOT, 'public'), [path.join(ROOT, 'index.html')]);
  assert.ok(bronnen.aantal > 1000, 'het register dekt de brede schermfamilie');
  assert.equal(bronnen.toegestaan('Uitloggen'), true, 'bestaande interfacezin staat erin');
  assert.equal(bronnen.toegestaan('Mijn geheime vrije chatzin 8f21c7'), false, 'willekeurige inhoud staat er niet in');
});

test('de publieke verhaalpagina\'s dragen de taalrail', () => {
  /* De toets hierboven dekt dit ook, maar telt over 313 bestanden: zakt hij,
     dan zegt hij "een pagina mist de rail" en niet WELKE familie. Deze negen
     zijn de reden dat de telling is verbreed, dus staan ze er bij naam. */
  const mappen = ['public/site/passen', 'public/site/werelden'];
  const zonder = [];
  for (const map of mappen) {
    for (const naam of fs.readdirSync(path.join(ROOT, map))) {
      if (!naam.endsWith('.html')) continue;
      const html = fs.readFileSync(path.join(ROOT, map, naam), 'utf8');
      if (!/<script[^>]+src="[^"]*shared\/i18n\.js"/.test(html)) zonder.push(map + '/' + naam);
    }
  }
  assert.deepEqual(zonder, []);
});

test('de statische voordeuren staan op EEN lijst, aan beide kanten gelijk', () => {
  /* De server heeft ze nodig voor CORS, de browser om te weten waar de API
     woont. Twee kopieen lopen uit elkaar, en dat merk je pas als een taal het
     op een van de voordeuren niet meer doet. */
  const { VOORDEUREN, APP_OORSPRONG } = require('../server/lib/voordeuren');
  const bron = fs.readFileSync(path.join(ROOT, 'public/shared/i18n/i18n-01.js'), 'utf8');
  const m = bron.match(/const STATISCHE_VOORDEUREN = \[([^\]]*)\]/);
  assert.ok(m, 'de browserkant noemt de voordeuren');
  const inBrowser = m[1].split(',').map(x => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
  assert.deepEqual(inBrowser, VOORDEUREN, 'server/lib/voordeuren.js is de bron');
  assert.match(bron, new RegExp("APP_OORSPRONG = '" + APP_OORSPRONG + "'"));

  /* En de verhaalpagina's mogen die keuze niet met een vaste meta overrulen:
     dan haalt een eigen installatie zijn vertalingen bij ons op. */
  const pagina = fs.readFileSync(path.join(ROOT, 'public/site/werelden/livingos.html'), 'utf8');
  assert.doesNotMatch(pagina, /rtg-api-base/, 'geen vaste API op een pagina die twee huizen kent');
});

test('de losse GitHub Pages-voordeur gebruikt dezelfde 114-talige app-API', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /name="rtg-api-base" content="https:\/\/app\.rahultravelgroup\.com"/);
  assert.match(html, /public\/shared\/i18n\.js/);
});

test('het automatische vangnet wacht op de bewuste taalkeuze', () => {
  const bron = fs.readFileSync(path.join(ROOT, 'public/shared/i18n/i18n-01.js'), 'utf8');
  assert.match(bron, /RTGAutoVertaling\.apply\(this\.chosen \? lang : 'nl'\)/,
    'toestel-detectie alleen mag de Nederlandstalige eerste pagina niet vertalen');
});
