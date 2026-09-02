/* ============================================================================
   DE PERMISSION FIREWALL -- consent per PARTIJ in plaats van per laag.

   DE BEWERING DIE ERTOE DOET staat in toets 2: er wordt gegroepeerd op de
   STABIELE SLEUTEL en niet op de weergavenaam. De lagen vullen `wie` als
   `supplierName || supplierCode`; ontbreekt de naam een keer, dan valt dezelfde
   zaak in twee groepen, en dan komt "sluit deze relatie" bij de verkeerde aan.

   En toets 5: deze laag bewaart NIETS en trekt zelf niets in. Alles loopt langs
   consentIntrek en dus langs de laag die de toestemming beheert -- anders is er
   een tweede waarheid over of iets nog mag (LAT regel 4).

   Draai los: node --test test/consent-relaties.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakRelaties, BUITEN } = require('../server/kern/consent-relaties');

const rij = (o) => Object.assign({ laag: 'x', id: '1', wie: 'Zaak', partij: 'zaak7',
  wat: 'iets', tot: null, richting: 'ziet', intrekbaar: true }, o);

function opzet(rijen, intrekt) {
  const geintrokken = [];
  const f = maakRelaties({
    consentVan: () => ({ ok: true, toestemmingen: rijen, nietGedekt: [{ naam: 'x', reden: 'y' }],
      storingen: [], voorbehoud: 'let op' }),
    consentIntrek: (key, body) => { geintrokken.push(body); return intrekt ? intrekt(body) : { ok: true }; }
  });
  return { f, geintrokken };
}

test('1. de firewall groepeert per partij en zet de zwaarste bovenaan', () => {
  const { f } = opzet([
    rij({ laag: 'a', id: '1', partij: 'zaak7', wie: 'Bloomingdale' }),
    rij({ laag: 'b', id: '2', partij: 'zaak7', wie: 'Bloomingdale' }),
    rij({ laag: 'c', id: '3', partij: 'taxi', wie: 'Taxi' })
  ]);
  const uit = f.relatiesVan('user-1');
  assert.equal(uit.relaties.length, 2);
  assert.equal(uit.relaties[0].partij, 'zaak7', 'wie het meest mag, hoort bovenaan');
  assert.equal(uit.relaties[0].aantal, 2);
  assert.equal(uit.relaties[1].partij, 'taxi');
});

/* ---------------------------------------------------------------------------
   2. DE KERN: groeperen op de sleutel, niet op de naam.
   ------------------------------------------------------------------------- */
test('2. dezelfde partij onder twee namen blijft EEN relatie', () => {
  const { f } = opzet([
    rij({ id: '1', partij: 'zaak7', wie: 'Bloomingdale' }),
    rij({ id: '2', partij: 'zaak7', wie: 'ZAAK7' })     // de laag kende de naam niet
  ]);
  const uit = f.relatiesVan('user-1');
  assert.equal(uit.relaties.length, 1, 'op de naam groeperen zou dit in twee relaties splitsen');
  assert.equal(uit.relaties[0].naam, 'Bloomingdale', 'en de leesbare naam hoort te winnen');
});

test('2b. twee partijen met dezelfde naam blijven TWEE relaties', () => {
  const { f } = opzet([
    rij({ id: '1', partij: 'zaak7', wie: 'De Vries' }),
    rij({ id: '2', partij: 'zaak9', wie: 'De Vries' })
  ]);
  const uit = f.relatiesVan('user-1');
  assert.equal(uit.relaties.length, 2,
    'op de naam groeperen zou hier twee bedrijven samenvoegen, en dan sluit u de verkeerde');
});

test('3. wat geen partij heeft, wordt niet aan elkaar geplakt', () => {
  const { f } = opzet([
    rij({ laag: 'zorgprofiel', id: 'p', partij: null, wie: 'Zaken waar u bestelt of verblijft' }),
    rij({ laag: 'toestel', id: 't', partij: null, wie: 'Weegschaal' })
  ]);
  const uit = f.relatiesVan('user-1');
  assert.equal(uit.relaties.length, 0);
  assert.equal(uit.nietGebonden.rijen.length, 2);
  assert.ok(uit.nietGebonden.uitleg, 'en er hoort te staan waarom ze los staan');
});

test('4. de onvolledigheid van de bron reist mee', () => {
  const { f } = opzet([rij({})]);
  const uit = f.relatiesVan('user-1');
  assert.ok(uit.nietGedekt && uit.nietGedekt.length, 'anders is dit scherm stiller dan het scherm waar het op leunt');
  assert.ok(uit.voorbehoud);
  assert.ok(Array.isArray(uit.buiten) && uit.buiten.length >= 4);
  for (const b of uit.buiten) assert.ok(b.reden && b.reden.length > 20, b.naam + ' staat er zonder reden bij');
});

/* ---------------------------------------------------------------------------
   5. DEZE LAAG TREKT ZELF NIETS IN.
   ------------------------------------------------------------------------- */
test('5. sluiten loopt rij voor rij langs consentIntrek', () => {
  const { f, geintrokken } = opzet([
    rij({ laag: 'a', id: '1', partij: 'zaak7' }),
    rij({ laag: 'b', id: '2', partij: 'zaak7' })
  ]);
  const uit = f.relatieSluit('user-1', 'zaak7');
  assert.equal(uit.gesloten, 2);
  assert.deepEqual(geintrokken, [{ laag: 'a', id: '1' }, { laag: 'b', id: '2' }]);
});

test('5b. een mislukte rij stopt de rest NIET, en wordt gemeld', () => {
  const { f } = opzet([
    rij({ laag: 'a', id: '1', partij: 'zaak7' }),
    rij({ laag: 'b', id: '2', partij: 'zaak7' }),
    rij({ laag: 'c', id: '3', partij: 'zaak7' })
  ], (b) => (b.laag === 'b' ? { error: 'die laag ligt eruit' } : { ok: true }));
  const uit = f.relatieSluit('user-1', 'zaak7');
  assert.equal(uit.gesloten, 2);
  assert.equal(uit.mislukt, 1);
  assert.equal(uit.gedaan.length, 3, 'stoppen bij de eerste fout laat een half gesloten relatie achter');
  assert.match(uit.gedaan.find(g => g.laag === 'b').reden, /eruit/);
});

test('5c. een storing in een laag laat de rest gewoon doorlopen', () => {
  const { f } = opzet([
    rij({ laag: 'a', id: '1', partij: 'zaak7' }),
    rij({ laag: 'b', id: '2', partij: 'zaak7' })
  ], (b) => { if (b.laag === 'a') throw new Error('stuk'); return { ok: true }; });
  const uit = f.relatieSluit('user-1', 'zaak7');
  assert.equal(uit.gesloten, 1);
  assert.equal(uit.mislukt, 1);
});

/* ---------------------------------------------------------------------------
   6. DE GEVOLGSIMULATIE verandert niets en zegt wat zij NIET rekende.
   ------------------------------------------------------------------------- */
test('6. de gevolgen bekijken trekt niets in', () => {
  const { f, geintrokken } = opzet([rij({ partij: 'zaak7' })]);
  const g = f.gevolgenVan('user-1', 'zaak7');
  assert.equal(g.sluit.length, 1);
  assert.deepEqual(geintrokken, [], 'een voorbeschouwing die iets doet, is geen voorbeschouwing');
});

test('6b. en zij draagt verplicht haar eigen nietGerekend', () => {
  const { f } = opzet([rij({ partij: 'zaak7' })]);
  const g = f.gevolgenVan('user-1', 'zaak7');
  assert.ok(Array.isArray(g.nietGerekend) && g.nietGerekend.length >= 2,
    'een preview die "0 conflicten" meldt zonder te zeggen waar zij niet keek, koopt vertrouwen dat zij niet verdiende');
  assert.ok(g.nietGerekend.some(t => /inzagekaart|gezien/i.test(t)));
});

test('6c. wat niet intrekbaar is, staat bij "blijft" en niet bij "sluit"', () => {
  const { f } = opzet([
    rij({ laag: 'a', id: '1', partij: 'zaak7', intrekbaar: true }),
    rij({ laag: 'b', id: '2', partij: 'zaak7', intrekbaar: false })
  ]);
  const g = f.gevolgenVan('user-1', 'zaak7');
  assert.equal(g.sluit.length, 1);
  assert.equal(g.blijft.length, 1);
  assert.ok(g.blijft[0].reden);
});

test('6d. een onbekende partij geeft 404 en geen lege belofte', () => {
  const { f } = opzet([rij({ partij: 'zaak7' })]);
  assert.equal(f.gevolgenVan('user-1', 'bestaat-niet').status, 404);
  assert.equal(f.relatieSluit('user-1', 'bestaat-niet').status, 404);
});

/* ---------------------------------------------------------------------------
   7. HET METIER-GAT dat deze ronde is gevonden.
   ------------------------------------------------------------------------- */
/* DEZE TOETS WAS EERST EEN BRONTOETS, en de mutatieproef liet zien waarom dat
   te zwak is: zet de regel achter `if (false)` en de naam staat er nog steeds.
   Nu wordt consentVan echt gedraaid, met een nagemaakte kern die alleen de
   metier-laag vult. */
test('7. een zaak die uw echte naam mag opvragen komt op het scherm', () => {
  const maakConsent = require('../server/kern/consent');
  const kern = {
    metierBewijs: {
      mijnToestemmingen: () => ({ ok: true, toestemmingen: [
        { code: 'ZAAK7', zaak: 'Bloomingdale', waarvoor: 'sollicitatie sommelier', at: 'x', ingetrokken: null, actief: true },
        { code: 'OUD1', zaak: 'Weg BV', waarvoor: '', at: 'x', ingetrokken: 'toen', actief: false }
      ] }),
      trekIn: () => ({ ok: true })
    }
  };
  const c = maakConsent({ kern });
  const rijen = c.consentVan('user-1').toestemmingen.filter(r => r.laag === 'metier-naam');
  assert.equal(rijen.length, 1, 'alleen wat NU openstaat hoort erbij; een ingetrokken vrijgave is geschiedenis');
  assert.equal(rijen[0].wie, 'Bloomingdale');
  assert.equal(rijen[0].partij, 'zaak7', 'de sleutel komt van de CODE en niet van de naam');
  assert.match(rijen[0].wat, /sollicitatie sommelier/, 'het doel dat het lid zelf opschreef, hoort erbij te staan');
  assert.equal(rijen[0].intrekbaar, true);
});

test('7b. en intrekken gaat naar de laag die hem beheert', () => {
  const maakConsent = require('../server/kern/consent');
  const geraakt = [];
  const kern = { metierBewijs: { mijnToestemmingen: () => ({ toestemmingen: [] }),
    trekIn: (key, code) => { geraakt.push([key, code]); return { ok: true }; } } };
  const c = maakConsent({ kern });
  const uit = c.consentIntrek('user-1', { laag: 'metier-naam', id: 'ZAAK7' });
  assert.equal(uit.ok, true);
  assert.deepEqual(geraakt, [['user-1', 'ZAAK7']],
    'een eigen vlaggetje hier zou een tweede waarheid zijn over of die zaak nog mag kijken');
});

test('7c. hij staat ook in het register, anders valt hij buiten de dekkingstoets', () => {
  const { LAGEN } = require('../server/kern/consent-register');
  const l = LAGEN.find(x => x.id === 'metier-naam');
  assert.ok(l, 'deze stond in GEEN van beide lijsten: niet gedekt en ook niet als uitzondering benoemd');
  assert.equal(l.gedekt, true);
});
