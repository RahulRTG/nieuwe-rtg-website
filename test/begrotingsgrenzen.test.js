/* DE GRENS PER COLLECTIE, EN VOORAL: WAAR HIJ NIET MAG STAAN.

   server/opzet/begroting.js weegt een hervulling voordat hij landt.
   BEGROTING.json zegt hoeveel er weg mag per collectie, en of dat een weigering
   is of alleen een melding. Deze toets bewaakt drie dingen.

   1. DE TABEL WORDT ECHT GELEZEN. Een register dat niemand raadpleegt, is een
      document.
   2. DE UITZONDERINGEN KLOPPEN MET DE CODE. Zes collecties worden herschreven
      door het vergeetpad (server/kern/vergeten/): daar haalt EEN handeling
      alles van EEN lid weg, en dat is per ontwerp onbegrensd. Een grens daarop
      breekt het recht om vergeten te worden -- geen risico maar een toezegging.
      Die lijst hoort dus niet met de hand bijgehouden te worden maar tegen de
      bron aan te liggen: komt er morgen een collectie bij in het vergeetpad,
      dan zakt deze toets en niet de belofte.
   3. EEN ONLEESBAAR REGISTER VALT TERUG OP DE STANDAARD, EN ZEGT DAT. Stil
      terugvallen zou betekenen dat elke collectie ineens op duizend staat
      zonder dat iemand het merkt (LAT.md regel 5).

   Draai los: node --test test/begrotingsgrenzen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const grenzen = require('../server/opzet/begrotingsgrenzen');
const begroting = require('../server/opzet/begroting');

const WORTEL = path.join(__dirname, '..');
const REGISTER = JSON.parse(fs.readFileSync(path.join(WORTEL, 'BEGROTING.json'), 'utf8'));

/* Het vergeetpad, gelezen uit de BRON. Dit is dezelfde greep die het register
   heeft gevuld; staat hij hier los, dan kunnen de twee uiteenlopen -- en dan
   bewaakt deze toets zijn eigen kopie in plaats van de werkelijkheid. */
function vergeetCollecties() {
  const map = path.join(WORTEL, 'server', 'kern', 'vergeten');
  const uit = new Set();
  for (const n of fs.readdirSync(map)) {
    if (!n.endsWith('.js')) continue;
    const bron = fs.readFileSync(path.join(map, n), 'utf8');
    for (const m of bron.matchAll(/db\.data\.([A-Za-z0-9_]+)\s*=\s*[^=]/g)) uit.add(m[1]);
  }
  return [...uit].sort();
}

test('de tabel wordt gelezen: een collectie met een eigen grens krijgt die ook', () => {
  const eigen = Object.keys(REGISTER.collecties).find(n => Number.isFinite(REGISTER.collecties[n].grens));
  assert.ok(eigen, 'geen enkele collectie heeft een eigen grens -- dan is er niets te lezen');
  assert.equal(grenzen.grensVoor(eigen), REGISTER.collecties[eigen].grens);
});

test('een collectie die niet in de tabel staat, valt op de standaardgrens', () => {
  /* Dat is met opzet en geen gat: de catalogus is een ONDERGRENS, dus een
     collectie die er niet in staat is er een waarover niets is gemeten -- niet
     een waarvan we weten dat hij nooit krimpt. */
  assert.equal(grenzen.grensVoor('een-collectie-die-niet-bestaat'), REGISTER.standaard);
  assert.equal(grenzen.handhaaft('een-collectie-die-niet-bestaat'), true,
    'onbekend hoort onder de noodrem te vallen, niet erbuiten');
});

test('DE UITZONDERINGEN KLOPPEN MET HET VERGEETPAD IN DE CODE', () => {
  const uitBron = vergeetCollecties();
  assert.ok(uitBron.length >= 5,
    'nul of bijna nul collecties in server/kern/vergeten/ gevonden -- dan zoekt deze toets de ' +
    'verkeerde vorm en bewaakt hij niets (gevonden: ' + uitBron.join(', ') + ')');
  const uitgezonderd = grenzen.stand().uitgezonderd.slice().sort();
  assert.deepEqual(uitgezonderd, uitBron,
    'BEGROTING.json en het vergeetpad lopen uiteen. Een collectie die het vergeetpad leeghaalt ' +
    'MOET handhaaf:false hebben: daar haalt een handeling alles van een lid weg, en een grens ' +
    'daarop breekt het recht om vergeten te worden.');
  for (const naam of uitBron) {
    assert.equal(grenzen.handhaaft(naam), false, naam + ' hoort niet gehandhaafd te worden');
    assert.ok(String(REGISTER.collecties[naam].waarom || '').length > 40,
      naam + ' is uitgezonderd zonder reden ernaast; een uitzondering zonder reden is een gat');
  }
});

test('in de WEIGERSTAND meldt een uitgezonderde collectie, en weigert een gewone', () => {
  const uitgezonderd = grenzen.stand().uitgezonderd[0];
  const meld = begroting.beoordeel(uitgezonderd, 500, 0, { modus: 'weigeren', grens: 10 });
  assert.equal(meld.oordeel, 'meld',
    'het vergeetpad wordt geweigerd; dan kan een lid met veel rijen zijn gegevens niet laten wissen');

  const weiger = begroting.beoordeel('clips', 500, 0, { modus: 'weigeren', grens: 10 });
  assert.equal(weiger.oordeel, 'weiger',
    'een gewone collectie wordt niet meer geweigerd -- dan handhaaft de laag nergens meer iets');
});

test('zonder eigen grens pakt de weging de grens uit het register', () => {
  /* De tegenproef bij de toets hierboven: daar staat de grens er expliciet bij,
     dus die bewijst niet dat de tabel wordt gebruikt. Hier niet. */
  const naam = Object.keys(REGISTER.collecties).find(n => REGISTER.collecties[n].grens === 100);
  assert.ok(naam, 'geen collectie met grens 100 in het register');
  const onder = begroting.beoordeel(naam, 100, 10, {});     // 90 weg, onder de 100
  assert.equal(onder.oordeel, 'door');
  const boven = begroting.beoordeel(naam, 200, 10, {});     // 190 weg, erboven
  assert.notEqual(boven.oordeel, 'door');
  assert.equal(boven.grens, 100, 'de gebruikte grens komt niet uit het register');
});

test('een onleesbaar register valt terug op de standaard, en zegt dat', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-grens-'));
  const stuk = path.join(map, 'kapot.json');
  fs.writeFileSync(stuk, '{dit is geen json');
  const gezegd = [];
  try {
    const r = grenzen.laad({ pad: stuk, opnieuw: true, log: (n, b) => gezegd.push(n + ' ' + b) });
    assert.equal(r.standaard, grenzen.STANDAARD);
    assert.deepEqual(r.collecties, {});
    assert.equal(gezegd.length, 1, 'er wordt niets gezegd over een register dat niet te lezen is');
    assert.match(gezegd[0], /warn .*register niet leesbaar/);
  } finally {
    grenzen.laad({ opnieuw: true });   // het echte register terug in de cache
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
});
