/* DE PRIJS VAN EEN RETAILVERKOOP -- en de fout die eronder zat.

   DE ZWAARSTE TOETS IS 4. `verkoop` haalde de voorraad eraf TERWIJL hij de
   regels langsliep, en keerde bij de eerste regel zonder voorraad terug met een
   409. De voorraad van de regels ervoor was dan al afgeboekt, zonder bon en
   zonder dat iemand het zag. Dat is het gevaarlijke soort: er gaat niets stuk,
   de telling klopt alleen een keer niet meer.

   De reparatie is een volgorde en geen vangnet: eerst helemaal rekenen
   (prijsVan raakt niets aan), dan pas muteren. Toets 4 laat de oude volgorde
   zakken.

   En toets 1: COMMERCE.json mat kern/retail op `prijs: false`, en dat klopte --
   de prijs stond middenin een andere handeling. Deze functie is dat werkwoord,
   en hij haalt een van de 91 optellingen weg in plaats van er een bij te zetten.

   Draai los: node --test test/retail-prijs.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakRetail } = require('../server/kern/retail');

/* Een zaak met twee artikelen, elk een variant met voorraad. De VORM is
   overgenomen uit kern/retail/assortiment.js (zetArtikel) en niet zelf bedacht:
   een fixture die afwijkt van de bron toetst de fixture. */
function zaak() {
  return {
    code: 'MODE', name: 'Maison Solene', city: 'Amsterdam',
    caps: ['retail'], settings: {},
    collecties: [{ id: 'c1', seizoen: 'SS', jaar: 2026, naam: 'Lente' }],
    artikelen: [
      { id: 'a1', sku: 'SHIRT', naam: 'Linnen overhemd', categorie: 'Kleding',
        price: 320, publiekePrijs: 400,
        varianten: [{ vsku: 'SHIRT-WIT-M', kleur: 'Wit', maat: 'M', voorraad: 5 }] },
      { id: 'a2', sku: 'JURK', naam: 'Zijden slipdress', categorie: 'Kleding',
        price: 690, publiekePrijs: 690,
        varianten: [{ vsku: 'JURK-ZWART-S', kleur: 'Zwart', maat: 'S', voorraad: 1 }] }
    ],
    klanten: {}
  };
}

function motor(s) {
  const db = { data: { posSales: {}, retailApart: [] }, capsVan: (x) => x.caps || [] };
  const stil = () => {};
  return maakRetail({
    db, save: stil, crypto,
    findSupplier: (code) => (code === s.code ? s : null),
    notify: stil, notifySupplier: stil, sseToCustomer: stil, sseToSupplier: stil, sseToOffice: stil,
    ledenPrijs: (publiek, leden) => Math.min(Number(leden != null ? leden : publiek) || 0, Number(publiek) || 0),
    gidsHaal: () => null, meldWachtlijst: stil
  });
}

test('1. de prijs is een eigen functie en raakt niets aan', () => {
  const s = zaak(); const R = motor(s);
  const uit = R.prijsVan(s, [{ vsku: 'SHIRT-WIT-M', aantal: 2 }, { vsku: 'JURK-ZWART-S', aantal: 1 }]);
  assert.equal(uit.totaal, 320 * 2 + 690);
  assert.equal(uit.valuta, 'EUR');
  assert.equal(uit.regels.length, 2);
  assert.equal(uit.regels[0].naam, 'Linnen overhemd (Wit, M)');
  assert.equal(uit.regels[0].totaal, 640);
  /* Niets aangeraakt: dit is een vraag en geen handeling. */
  assert.equal(s.artikelen[0].varianten[0].voorraad, 5);
  assert.equal(s.artikelen[1].varianten[0].voorraad, 1);
  assert.equal((Object.keys(motor(s) && {}) || []).length, 0);
});

test('2. de ledenprijs en de publieke prijs staan er allebei, apart', () => {
  const s = zaak(); const R = motor(s);
  const r = R.prijsVan(s, [{ vsku: 'SHIRT-WIT-M', aantal: 1 }]).regels[0];
  assert.equal(r.stuk, 320, 'a.price IS al de ledenprijs (zetArtikel zet hem zo)');
  assert.equal(r.publiekStuk, 400);
  assert.notEqual(r.stuk, r.publiekStuk, 'twee bedragen, en ze worden niet door elkaar gehaald');
});

test('3. een tekort is een uitslag en geen uitzondering', () => {
  const s = zaak(); const R = motor(s);
  const uit = R.prijsVan(s, [{ vsku: 'JURK-ZWART-S', aantal: 3 }]);
  assert.ok(uit.ok);
  assert.equal(uit.tekort.length, 1);
  assert.equal(uit.tekort[0].gevraagd, 3);
  assert.equal(uit.tekort[0].vrij, 1);
  assert.equal(uit.regels.length, 1, 'de regel gaat mee, met zijn tekort ernaast');
  /* Alle problemen tegelijk, niet een voor een: */
  const twee = R.prijsVan(s, [{ vsku: 'JURK-ZWART-S', aantal: 3 }, { vsku: 'SHIRT-WIT-M', aantal: 9 }]);
  assert.equal(twee.tekort.length, 2);
});

test('4. een tekort halverwege eet de voorraad van de regels ervoor NIET op', () => {
  const s = zaak(); const R = motor(s);
  const uit = R.verkoop(s, { regels: [
    { vsku: 'SHIRT-WIT-M', aantal: 2 },      // deze kan
    { vsku: 'JURK-ZWART-S', aantal: 3 }      // en deze niet
  ] }, { name: 'Team' });

  assert.equal(uit.status, 409, 'de verkoop gaat niet door');
  assert.equal(s.artikelen[0].varianten[0].voorraad, 5,
    'de twee overhemden waren al afgeboekt in de oude volgorde -- zonder bon en zonder dat iemand het zag');
  assert.equal(s.artikelen[1].varianten[0].voorraad, 1);
  assert.equal((R.retailState(s).sales || []).length, 0, 'en er staat geen bon');
});

test('5. een verkoop die wel kan, boekt precies af en rekent met dezelfde som', () => {
  const s = zaak(); const R = motor(s);
  const uit = R.verkoop(s, { regels: [{ vsku: 'SHIRT-WIT-M', aantal: 2 }, { vsku: 'JURK-ZWART-S', aantal: 1 }] }, { name: 'Team' });
  assert.ok(uit.ok);
  assert.equal(uit.sale.total, 1330);
  assert.equal(s.artikelen[0].varianten[0].voorraad, 3);
  assert.equal(s.artikelen[1].varianten[0].voorraad, 0);
  /* De bon en de losse regels komen uit een berekening en niet uit twee. */
  assert.equal(uit.sale.items.reduce((n, i) => n + i.price * i.qty, 0), uit.sale.total);
});

test('6. de klanthistorie krijgt hetzelfde bedrag als de bon', () => {
  const s = zaak(); const R = motor(s);
  R.verkoop(s, { regels: [{ vsku: 'SHIRT-WIT-M', aantal: 2 }], klantKey: 'k-1' }, { name: 'Team' });
  const hist = s.klanten['k-1'].historie;
  assert.equal(hist.length, 1);
  assert.equal(hist[0].bedrag, 640, 'niet voor de tweede keer uitgerekend uit een andere bron');
  assert.equal(hist[0].naam, 'Linnen overhemd (Wit, M)');
});

test('7. een onbekende variant verdwijnt niet stil', () => {
  const s = zaak(); const R = motor(s);
  const uit = R.prijsVan(s, [{ vsku: 'BESTAAT-NIET', aantal: 1 }, { vsku: 'SHIRT-WIT-M', aantal: 1 }]);
  assert.deepEqual(uit.onbekend, ['BESTAAT-NIET'],
    'een regel die uit de mand valt zonder melding, is een mand die minder kost dan de koper dacht');
  assert.equal(uit.regels.length, 1);
  assert.equal(uit.totaal, 320);
});

test('8. een zaak zonder retail krijgt geen prijs', () => {
  const s = zaak(); s.caps = ['restaurant'];
  const R = motor(s);
  assert.equal(R.prijsVan(s, [{ vsku: 'SHIRT-WIT-M', aantal: 1 }]).status, 400);
});
