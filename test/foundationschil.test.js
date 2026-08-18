/* De offline-schil van het RTFoundation-huis.

   WAAROM DEZE TOETS ER IS. Tien pagina's stonden wel als tegel op de hub en
   niet in de service worker: spelen, de drie biebs, de schoolkant en het
   magazine. Precies de tegels waarmee een kind zich bezighoudt als er niets
   anders is -- in een auto, een wachtkamer, een buurthuis met slecht bereik --
   en dus precies de tegels die offline moeten werken. Het gat was niet te
   zien omdat niets het telde: de hub groeit, de schil blijft achter, en een
   wit scherm valt pas op als je geen bereik hebt.

   Twee kanten op, want allebei de richtingen gaan mis:
     1. elke tegel op de hub staat in de schil (anders: wit scherm offline);
     2. elk pad in de schil bestaat echt (anders: addAll() faalt, en dan wordt
        de HELE schil niet gevuld -- een dode verwijzing kost dus niet een
        pagina maar alle pagina's).

   Draai los: node --test test/foundationschil.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const HUIS = path.join(__dirname, '..', 'public', 'apps', 'foundation');
const PUB = path.join(__dirname, '..', 'public');
const sw = fs.readFileSync(path.join(HUIS, 'sw.js'), 'utf8');
const hub = fs.readFileSync(path.join(HUIS, 'index.html'), 'utf8');

/* Alleen de SHELL-constante, niet het hele bestand: een pad dat toevallig in
   een commentaar of een fetch-regel staat, telt niet als gecachet. */
const shellBlok = /const SHELL = \[([^]*?)\];/.exec(sw);
const inSchil = new Set(
  [...(shellBlok ? shellBlok[1] : '').matchAll(/'([^']+)'/g)].map((m) => m[1]));

// de tegels van de hub: relatieve links naar een eigen pagina in dit huis
const tegels = [...new Set([...hub.matchAll(/href="([a-z0-9-]+\.html)"/g)].map((m) => m[1]))];

test('1. elke tegel op de hub werkt ook zonder bereik', () => {
  assert.ok(tegels.length >= 40, 'de hub hoort een gevulde voordeur te zijn (nu ' + tegels.length + ')');
  const mist = tegels.filter((t) => !inSchil.has('/apps/foundation/' + t));
  assert.deepEqual(mist, [],
    'deze tegels staan op de hub maar niet in de service worker; offline geven ze een wit scherm');
});

test('2. elk pad in de schil bestaat echt op schijf', () => {
  /* Dit is geen muggenzifterij: caches.addAll() is alles-of-niets. Een enkele
     dode verwijzing laat de hele schil ongevuld, en dan werkt er offline
     helemaal niets meer -- de duurste manier waarop deze lijst kan verlopen. */
  const dood = [...inSchil].filter((p) => {
    if (!p.startsWith('/')) return false;
    if (p.endsWith('/')) return false; // de map zelf; die serveert index.html
    return !fs.existsSync(path.join(PUB, p.slice(1)));
  });
  assert.deepEqual(dood, [],
    'de schil verwijst naar bestanden die niet bestaan; caches.addAll() is alles-of-niets');
});

test('3. de schil noemt zichzelf een versie, zodat een update ook echt doorkomt', () => {
  /* Zonder wisselende cachenaam blijft een oude schil eeuwig staan. Niet de
     waarde toetsen (die verandert bij elke uitgave), wel dat hij er is. */
  assert.ok(/const CACHE = '[^']+'/.test(sw), 'de service worker hoort een cachenaam te dragen');
});
