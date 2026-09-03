/* HET PASSKEY-SCHERM VOOR WIE ER NOG GEEN HEEFT.

   WAAROM DIT BESTAAT. /apps/passkeys.html liep dood voor precies de mens die
   het scherm het hardst nodig had. Zonder sessie kreeg je alleen "Log in met
   passkey" te zien -- de knop die je niet kunt gebruiken als je er nog geen hebt
   -- want het blok om er een te MAKEN zit achter een sessie. Geen foutmelding,
   geen aanwijzing, alleen een deur die niet opengaat.

   WAAROM GEEN *.e2e.js. Die bestanden draaien alleen met een browser en worden
   anders overgeslagen; een bewering in een overgeslagen bestand kan per
   definitie niet zakken (LAT.md regel 9). Dit draait altijd: het haalt het
   inline script uit de pagina en voert het uit boven een minimale DOM-stub. Dat
   is geen echte browser en het meet dus geen opmaak -- wel welk blok er
   verschijnt, en dat is precies de bewering die hier fout was.

   Draai los: node --test test/passkeys-eerste.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PAGINA = path.join(__dirname, '..', 'public', 'apps', 'passkeys.html');

/* De kleinst mogelijke DOM: elk element onthoudt zijn klassen en verder niets.
   Meer nabootsen zou betekenen dat deze toets een browser gaat naspelen, en dan
   toetst hij zijn eigen nabootsing. */
function maakDom(html) {
  const elementen = new Map();
  const maak = (id) => {
    const klassen = new Set(/class="([^"]*)"/.exec(
      new RegExp('id="' + id + '"[^>]*').exec(html)?.[0] || '')?.[1]?.split(/\s+/) || []);
    return { id, classList: {
      add: (k) => klassen.add(k), remove: (k) => klassen.delete(k),
      contains: (k) => klassen.has(k) }, verborgen: () => klassen.has('weg'),
      addEventListener() {}, textContent: '', value: '', appendChild() {}, innerHTML: '' };
  };
  for (const m of html.matchAll(/id="([A-Za-z0-9_-]+)"/g))
    if (!elementen.has(m[1])) elementen.set(m[1], maak(m[1]));
  return {
    querySelector: (kies) => elementen.get(String(kies).replace(/^#/, '')) || maak('los'),
    elementen
  };
}

function draai({ token, lijstStatus }) {
  const html = fs.readFileSync(PAGINA, 'utf8');
  const script = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1]).join('\n');
  const dom = maakDom(html);
  const zand = {
    document: dom,
    localStorage: { getItem: () => token, setItem() {}, removeItem() {} },
    fetch: async () => ({ status: lijstStatus, ok: lijstStatus === 200,
      json: async () => ({ sleutels: [] }) }),
    navigator: { credentials: {} }, window: {}, console,
    setTimeout, clearTimeout, location: { href: '' }
  };
  zand.window = zand;
  vm.createContext(zand);
  new vm.Script(script).runInContext(zand);
  return dom;
}

test('1. zonder sessie wijst het scherm de weg naar de eerste passkey', async () => {
  const dom = draai({ token: null, lijstStatus: 200 });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(dom.querySelector('#vGeenSessie').verborgen(), false,
    'wie geen sessie heeft, hoort te LEZEN hoe hij aan zijn eerste passkey komt');
  assert.equal(dom.querySelector('#vBeheer').verborgen(), true,
    'en beheert er geen');
});

test('2. met een geldige sessie staat het beheer er, en de uitleg niet', async () => {
  const dom = draai({ token: 'een-token', lijstStatus: 200 });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(dom.querySelector('#vBeheer').verborgen(), false, 'hier maak je ze aan');
  assert.equal(dom.querySelector('#vGeenSessie').verborgen(), true,
    'en dan is de uitleg over inloggen alleen maar ruis');
});

test('3. een token dat de server weigert telt als geen sessie', async () => {
  const dom = draai({ token: 'verlopen', lijstStatus: 401 });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(dom.querySelector('#vGeenSessie').verborgen(), false,
    'een verlopen token hoort dezelfde weg te wijzen als geen token -- anders is het scherm ' +
    'leeg voor iemand die gisteren nog was ingelogd');
  assert.equal(dom.querySelector('#vBeheer').verborgen(), true);
});

test('4. de pagina noemt de weg naar de inlog en naar wachtwoord vergeten', () => {
  const html = fs.readFileSync(PAGINA, 'utf8');
  assert.match(html, /href="\/apps\/app\.html"/,
    'er staat een echte link naar de inlog en geen zin die zegt "log elders in"');
  assert.match(html, /wachtwoord vergeten/i,
    'en de uitweg voor wie zijn wachtwoord niet meer weet');
});
