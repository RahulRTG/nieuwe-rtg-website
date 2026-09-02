/* ============================================================================
   DE GEGEVENSKAART -- wat weet RTG van mij.

   DE TOETS DIE HET REGISTER EERLIJK HOUDT staat in 1: elke regel noemt een
   `bron`, en dat bestand moet bestaan. BEWIJSMACHINE.md waarschuwt dat een
   register naast de code binnen een jaar zelf een botsing wordt; dit is het
   goedkoopste tegengif dat er te krijgen is. Verhuist kern/identiteit/
   tweefactor.js, dan zakt deze toets -- en dan is de regel aantoonbaar
   achterhaald in plaats van stil verkeerd.

   EN DE TOETS DIE ERTOE DOET VOOR EEN MENS staat in 3: een peiling die stukloopt
   komt terug als ONBEKEND en nooit als afwezig. BESTUUR.md zegt dat "niet vast
   te stellen" een eersteklas uitslag is naast ja en nee, en hier is dat geen
   netheid: zou een storing als "nee" op het scherm komen, dan leest een lid
   "RTG heeft mijn adres niet" op het moment dat de kluis niet opengaat.

   Draai los: node --test test/gegevenskaart.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { SOORTEN, WAAR, HERKOMST, GRONDEN } = require('../server/kern/identiteit/gegevenssoorten');
const { BELEID } = require('../server/bewaartermijnen');
const { maakGegevenskaart } = require('../server/kern/identiteit/gegevenskaart');

const WORTEL = path.join(__dirname, '..');

/* Een minimale bedrading: alleen wat de kaart werkelijk peilt. */
function opzet(over = {}) {
  const u = { id: 1, codename: 'kolibrie', verified: 'unverified' };
  const accounts = Object.assign({
    getUserById: () => u,
    realNameOf: () => 'Echte Naam',
    emailOf: () => 'lid@x.nl',
    phoneOf: () => '0612345678',
    getMemberState: () => ({ geboren: '1990-01-01' })
  }, over.accounts || {});
  /* `accounts` is hierboven al samengevoegd; hem hier nog eens uit `over` laten
     overschrijven maakte de hele stub kapot -- en dan viel toets 3 om de
     verkeerde reden. Een toets die zakt zonder dat de code fout is, is net zo
     onbruikbaar als een die groen blijft terwijl hij dat wel is. */
  const rest = Object.assign({}, over);
  delete rest.accounts;
  return maakGegevenskaart(Object.assign({
    accounts,
    sessieregister: { vanLid: () => [{ sid: 'a' }] },
    toestellen: { lijst: () => [] },
    commercieel: { standVan: () => ({ soorten: [{ aan: false }] }) },
    inzagekaart: () => ({ kaart: [] })
  }, rest));
}

/* ---------------------------------------------------------------------------
   1. DE HANDHAVER: elke regel wijst naar code die bestaat.
   ------------------------------------------------------------------------- */
test('1. elke gegevenssoort noemt een bron, en die staat er', () => {
  assert.ok(SOORTEN.length >= 10, 'het register is niet leeg');
  for (const s of SOORTEN) {
    assert.ok(s.bron, s.id + ' heeft geen bron; dan kan niemand nakijken of deze regel nog klopt');
    assert.ok(fs.existsSync(path.join(WORTEL, s.bron)),
      s.id + ' wijst naar ' + s.bron + ', en dat bestand bestaat niet (meer)');
  }
});

test('1b. en elk veld komt uit een gesloten woordenlijst', () => {
  const ids = new Set();
  for (const s of SOORTEN) {
    assert.ok(!ids.has(s.id), 'dubbele id: ' + s.id);
    ids.add(s.id);
    assert.ok(WAAR[s.waar], s.id + ' staat op een onbekende plaats: ' + s.waar);
    assert.ok(HERKOMST[s.herkomst], s.id + ' heeft een onbekende herkomst: ' + s.herkomst);
    assert.ok(s.doel && s.doel.length > 10, s.id + ' heeft geen doel; dan is doelbinding een woord');
  }
});

/* ---------------------------------------------------------------------------
   2. DE DUURSTE REGEL: wat niet weg kan, zegt WAAROM het niet weg kan -- en de
   drie gronden zijn niet inwisselbaar. Een kaart die uw naam op dezelfde lijst
   zet als uw facturen, laat u denken dat het opheffen van uw account uw naam
   net zo min weghaalt als uw boekhouding.
   ------------------------------------------------------------------------- */
test('2. elk gegeven dat niet weg kan, draagt een geldige grond', () => {
  const vast = SOORTEN.filter(s => s.weg.kan === false);
  assert.ok(vast.length >= 2, 'er is minstens iets dat niet weg kan');
  for (const s of vast) {
    assert.ok(GRONDEN[s.weg.grond], s.id + ' kan niet weg maar noemt geen geldige grond');
    assert.ok(s.weg.reden && s.weg.reden.length > 20, s.id + ' zegt niet waarom');
  }
  for (const s of SOORTEN.filter(x => x.weg.kan === true)) {
    assert.ok(s.weg.hoe, s.id + ' kan weg maar zegt niet hoe');
  }
});

test('2b. en de kaart splitst "gaat mee bij opheffen" van "blijft daarna staan"', () => {
  const k = opzet().kaartVan('lid-1', { id: 1 });
  const naam = (l) => l.map(x => x.naam);
  assert.ok(naam(k.accountNodig).includes('Uw naam'), 'uw naam gaat mee als u opheft');
  assert.ok(!naam(k.naOpheffen).includes('Uw naam'),
    'uw naam mag NIET op de lijst van wat daarna blijft staan -- dat is de belofte die anders sneuvelt');
  assert.ok(naam(k.naOpheffen).includes('Uw facturen en betalingen'),
    'en de fiscale bewaarplicht staat er wel, want die blijft echt');
  for (const b of k.naOpheffen) assert.notEqual(b.grond, 'account-nodig');
});

test('2c. een bewaartermijn wordt opgehaald uit het beleid en nooit overgetypt', () => {
  /* HIER ZAT EEN ECHTE FOUT. Het register zei dat het inzagejournaal blijft;
     server/bewaartermijnen.js veegt het na 730 dagen. "Blijft altijd" en
     "blijft twee jaar" zijn niet hetzelfde. Deze toets houdt de twee aan
     elkaar vast: elke bewaartak moet in het beleid bestaan, en het getal op de
     kaart moet DAT getal zijn. */
  const met = SOORTEN.filter(s => s.bewaartak);
  assert.ok(met.length >= 2, 'er zijn gegevens met een bewaartermijn');
  for (const s of met) {
    const r = BELEID.find(x => x.tak === s.bewaartak);
    assert.ok(r, s.id + ' wijst naar bewaartak ' + s.bewaartak + ', en die staat niet in het beleid');
    assert.ok(!/\b(zeven|seven|7)\s*jaar/i.test(s.weg.reden || ''),
      s.id + ' typt de termijn over in zijn tekst; dan drijft hij weg van het beleid');
  }
  const k = opzet().kaartVan('lid-1', { id: 1 });
  const f = k.rijen.find(r => r.id === 'facturen');
  assert.equal(f.termijn.dagen, BELEID.find(x => x.tak === 'invoices').dagen,
    'de kaart toont het getal uit het beleid en niet een eigen getal');
  assert.equal(f.termijn.inWoorden, '7 jaar');
  const i = k.rijen.find(r => r.id === 'inzagejournaal');
  assert.equal(i.termijn.inWoorden, '2 jaar', 'en het inzagejournaal blijft twee jaar, niet altijd');
});

test('2d. en de derde uitkomst -- geanonimiseerd -- staat er ook', () => {
  /* kern/vergeten.js kent vier soorten en de tweede is "de persoon eruit, de
     rest blijft". Wie leest "alles gaat weg" en later zijn eigen zin nog ziet
     staan zonder naam, is verkeerd voorgelicht -- ook al ging er niets fout. */
  const k = opzet().kaartVan('lid-1', { id: 1 });
  assert.ok(k.geanonimiseerd, 'wissen, bewaren EN anonimiseren; die derde ontbrak');
  assert.ok(k.geanonimiseerd.waarom.length > 20, 'met de reden erbij');
  assert.ok(fs.existsSync(path.join(WORTEL, k.geanonimiseerd.bron)),
    'en die verwijst naar code die bestaat: ' + k.geanonimiseerd.bron);
});

/* ---------------------------------------------------------------------------
   3. EEN STORING IS GEEN AFWEZIGHEID.
   ------------------------------------------------------------------------- */
test('3. een peiling die stukloopt komt terug als onbekend, niet als nee', () => {
  const k = opzet({ accounts: { getMemberState: () => { throw new Error('kluis dicht'); } } })
    .kaartVan('lid-1', { id: 1 });
  const adres = k.rijen.find(r => r.id === 'adres');
  assert.equal(adres.aanwezig, null, 'een kluis die niet opengaat is GEEN "u heeft geen adres"');
  assert.ok(adres.waarom, 'en de reden staat bij de rij zelf, niet drie schermen verderop');
});

test('3b. een laag die niet is aangesloten levert onbekend en geen nul', () => {
  const k = opzet({ toestellen: null }).kaartVan('lid-1', { id: 1 });
  const t = k.rijen.find(r => r.id === 'toestelbinding');
  assert.equal(t.aanwezig, null);
  assert.match(t.waarom, /aangesloten/);
});

test('3d. en een peiling die zelf een fout gooit, ook', () => {
  /* Dit gat bleef open toen alle andere toetsen groen stonden: 3 dekt een kluis
     die niet opengaat en 3b een laag die er niet is, maar niet een laag die er
     WEL is en onderweg struikelt. Een mutatie die de vangnet-tak op `false`
     zette, overleefde daardoor -- en dat is exact de vorm waarin een storing
     zich als een geruststelling voordoet. */
  const k = opzet({ sessieregister: { vanLid: () => { throw new Error('register stuk'); } } })
    .kaartVan('lid-1', { id: 1 });
  const r = k.rijen.find(x => x.id === 'sessies');
  assert.equal(r.aanwezig, null, 'een register dat struikelt is GEEN "u bent nergens aangemeld"');
  assert.match(r.waarom, /stuk|onbekend/i, 'en het zegt dat het onbekend is en niet afwezig');
});

test('3c. de telling toont de onbekende even groot als de rest', () => {
  const k = opzet({ toestellen: null }).kaartVan('lid-1', { id: 1 });
  assert.ok(k.telling.onbekend >= 1, 'onbekend wordt geteld en niet weggelaten');
  assert.equal(k.telling.aanwezig + k.telling.afwezig + k.telling.onbekend, k.rijen.length,
    'elke rij valt in precies een van de drie; er verdwijnt er geen');
  assert.equal(k.samengesteld, undefined, 'er komt geen samengesteld cijfer op (LAT-regel 11)');
});

test('3e. een tweede helft bij een nee verschijnt alleen bij een HARDE nee', () => {
  /* Bij de facturen zegt "RTG heeft dit niet" maar de helft: zodra er een komt
     geldt de bewaarplicht meteen. Die zin hoort er dus bij -- maar niet bij
     ONBEKEND, want dan bevestigt hij een afwezigheid die niet is vastgesteld,
     en niet bij AANWEZIG, want dan zegt de termijn al hetzelfde. */
  const leeg = opzet({ accounts: { getMemberState: () => ({ geboren: '1990-01-01' }) } })
    .kaartVan('lid-1', { id: 1 }).rijen.find(r => r.id === 'facturen');
  assert.equal(leeg.aanwezig, false);
  assert.ok(leeg.bijAfwezig, 'bij een harde nee staat de tweede helft erbij');

  const vol = opzet({ accounts: { getMemberState: () => ({ invoices: [{ id: 'a' }] }) } })
    .kaartVan('lid-1', { id: 1 }).rijen.find(r => r.id === 'facturen');
  assert.equal(vol.aanwezig, true);
  assert.equal(vol.bijAfwezig, undefined, 'bij aanwezig zegt de termijn al hetzelfde');

  const stuk = opzet({ accounts: { getMemberState: () => { throw new Error('dicht'); } } })
    .kaartVan('lid-1', { id: 1 }).rijen.find(r => r.id === 'facturen');
  assert.equal(stuk.aanwezig, null);
  assert.equal(stuk.bijAfwezig, undefined,
    'bij onbekend niet -- anders bevestigt hij een afwezigheid die niet is vastgesteld');
});

/* ---------------------------------------------------------------------------
   4. DE KAART LEEST EN SCHRIJFT NIET. Zou hij schrijven, dan werd uw eigen kaart
   voller door ernaar te kijken -- dezelfde regel als bij de inzagekaart.
   ------------------------------------------------------------------------- */
test('4. hem opvragen raakt niets aan', () => {
  const geschreven = [];
  const k = opzet({ accounts: {
    getMemberState: () => ({ geboren: '1990-01-01' }),
    saveMemberState: (...a) => geschreven.push(a)
  } });
  k.kaartVan('lid-1', { id: 1 });
  k.kaartVan('lid-1', { id: 1 });
  assert.deepEqual(geschreven, [], 'de kaart schrijft niets in het dossier');
});

test('4b. en hij noemt zijn eigen rand', () => {
  const k = opzet().kaartVan('lid-1', { id: 1 });
  assert.ok(k.grenzen.length >= 3, 'een overzicht dat zijn rand niet noemt, leest als "dit is alles"');
  for (const g of k.grenzen) assert.ok(g.naam && g.reden && g.reden.length > 30, 'elke grens draagt een reden');
  assert.match(JSON.stringify(k.grenzen), /Zegel/, 'de controle die hier niet op kan komen, staat erbij');
});

/* ---------------------------------------------------------------------------
   5. SOORTEN, GEEN INHOUD. Dit is de grens die deze laag scheidt van de
   AVG-uitvoer: hier staat DAT er een telefoonnummer is, niet welk.
   ------------------------------------------------------------------------- */
test('5. de kaart draagt geen enkele waarde van het lid zelf', () => {
  const k = opzet().kaartVan('lid-1', { id: 1 });
  const tekst = JSON.stringify(k);
  assert.ok(!tekst.includes('Echte Naam'), 'de echte naam staat niet op de kaart');
  assert.ok(!tekst.includes('lid@x.nl'), 'het e-mailadres staat er niet op');
  assert.ok(!tekst.includes('0612345678'), 'het telefoonnummer staat er niet op');
  assert.ok(!tekst.includes('kolibrie'), 'zelfs de codenaam niet -- die staat al op elk ander scherm');
  assert.ok(!tekst.includes('1990-01-01'), 'en de geboortedatum niet');
  assert.equal(k.rijen.find(r => r.id === 'email').aanwezig, true,
    'terwijl de kaart wel weet DAT het er is');
});
