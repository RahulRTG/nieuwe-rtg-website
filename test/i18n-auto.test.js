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

function autoLaag() {
  const attrs = {};
  const documentElement = {
    getAttribute: n => Object.prototype.hasOwnProperty.call(attrs, n) ? attrs[n] : null,
    setAttribute: (n, v) => { attrs[n] = String(v); },
    removeAttribute: n => { delete attrs[n]; }
  };
  const window = {};
  const context = { window, document: { documentElement }, MutationObserver: function () {
    this.observe = () => {};
  }, setTimeout: () => 1, clearTimeout: () => {}, fetch: () => Promise.reject(new Error('niet aanroepen')),
  location: { pathname: '/apps/proef.html' }, NodeFilter: { SHOW_TEXT: 4 } };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'public/shared/i18n/i18n-00.js'), 'utf8'), context);
  return { laag: window.RTGAutoVertaling, attrs };
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

test('ieder blijvend appscherm bereikt de universele i18n-laag', () => {
  const paginas = [];
  loop(path.join(ROOT, 'public/apps'), paginas);
  const zonder = [];
  for (const p of paginas) {
    const html = fs.readFileSync(p, 'utf8');
    const omleiding = /<meta[^>]+http-equiv=["']refresh["'][^>]+url=\/[^"'>]+/i.test(html) &&
      !/<script[^>]+src=/i.test(html);
    if (!omleiding && !html.includes('/shared/basis.js') && !html.includes('/shared/i18n.js'))
      zonder.push(path.relative(ROOT, p));
  }
  assert.deepEqual(zonder, []);
  assert.match(fs.readFileSync(path.join(ROOT, 'public/shared/basis/basis-01.js'), 'utf8'), /shared\/i18n\.js/);
  assert.match(fs.readFileSync(path.join(ROOT, 'public/shared/i18n/i18n-00.js'), 'utf8'), /MutationObserver/);
});

test('alleen aantoonbare code-interface mag naar een externe UI-vertaler', () => {
  const bronnen = maakUiBronnen(path.join(ROOT, 'public'), [path.join(ROOT, 'index.html')]);
  assert.ok(bronnen.aantal > 1000, 'het register dekt de brede schermfamilie');
  assert.equal(bronnen.toegestaan('Uitloggen'), true, 'bestaande interfacezin staat erin');
  assert.equal(bronnen.toegestaan('Mijn geheime vrije chatzin 8f21c7'), false, 'willekeurige inhoud staat er niet in');
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
