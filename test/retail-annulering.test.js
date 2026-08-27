/* EEN VERKOOP TERUGDRAAIEN -- als tegenboeking, en nooit door de bon te wissen.

   DE ZWAARSTE TOETS IS 3. Hier stond een functie die de kassabon UIT posSales
   gooide. Dat is geen annulering maar een uitgeveegde regel: de Z-lijst van
   gisteren klopt er niet meer mee en niemand kan zeggen waarom. Toets 3 zakt
   zodra de bon weer verdwijnt.

   En toets 7: 42 plekken in dit huis lezen posSales, en de plekken die geld
   optellen komen door een tegenboeking VANZELF op nul uit. Dat is de hele
   reden voor deze vorm -- een vlag `geannuleerd` zou al die plekken moeten
   bereiken, en de plek die hem vergeet telt omzet die niet bestaat. Toets 7
   rekent dat na met de echte fiscale laag en niet met een nabootsing.

   Draai los: node --test test/retail-annulering.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakRetail } = require('../server/kern/retail');

function zaak() {
  return {
    code: 'MODE', name: 'Maison Solene', city: 'Amsterdam', country: 'NL',
    caps: ['retail'], settings: {}, type: 'retail',
    collecties: [{ id: 'c1', seizoen: 'SS', jaar: 2026, naam: 'Lente' }],
    artikelen: [
      { id: 'a1', sku: 'SHIRT', naam: 'Linnen overhemd', categorie: 'Kleding',
        price: 320, publiekePrijs: 400,
        varianten: [{ vsku: 'SHIRT-WIT-M', kleur: 'Wit', maat: 'M', voorraad: 5 }] }
    ],
    klanten: {}
  };
}

function motor(s) {
  const db = { data: { posSales: {}, retailApart: [], orders: [], rides: [], boekingen: [], verblijven: [], invoices: [], klok: {} }, capsVan: (x) => x.caps || [] };
  const stil = () => {};
  const R = maakRetail({
    db, save: stil, crypto,
    findSupplier: (code) => (code === s.code ? s : null),
    notify: stil, notifySupplier: stil, sseToCustomer: stil, sseToSupplier: stil, sseToOffice: stil,
    ledenPrijs: (p, l) => Math.min(Number(l != null ? l : p) || 0, Number(p) || 0),
    gidsHaal: () => null, meldWachtlijst: stil
  });
  return { R, db };
}

const verkoop = (R, s, aantal) => R.verkoop(s, { regels: [{ vsku: 'SHIRT-WIT-M', aantal: aantal || 2 }] }, { name: 'Team' });

test('1. de grond komt uit een gesloten lijst', () => {
  const s = zaak(); const { R } = motor(s);
  const sale = verkoop(R, s).sale;
  assert.equal(R.annuleerVerkoop(s, sale.id, { grond: 'omdat-het-kan' }).status, 400);
  assert.equal(R.annuleerVerkoop(s, sale.id, {}).status, 400);
  assert.ok(R.ANNULEERGRONDEN.every(g => g.id && g.label && g.wat));
  assert.ok(R.annuleerVerkoop(s, sale.id, { grond: 'vergissing' }).ok);
});

test('2. de voorraad komt terug, precies een keer', () => {
  const s = zaak(); const { R } = motor(s);
  const sale = verkoop(R, s, 2).sale;
  assert.equal(s.artikelen[0].varianten[0].voorraad, 3);
  assert.ok(R.annuleerVerkoop(s, sale.id, { grond: 'vergissing' }).ok);
  assert.equal(s.artikelen[0].varianten[0].voorraad, 5);
  /* Twee keer terugdraaien zou de voorraad twee keer teruggeven. */
  const weer = R.annuleerVerkoop(s, sale.id, { grond: 'vergissing' });
  assert.equal(weer.status, 409);
  assert.equal(s.artikelen[0].varianten[0].voorraad, 5);
});

test('3. DE BON BLIJFT STAAN, met een merkje en een tegenboeking ernaast', () => {
  const s = zaak(); const { R, db } = motor(s);
  const sale = verkoop(R, s).sale;
  const uit = R.annuleerVerkoop(s, sale.id, { grond: 'klant-zag-af', door: 'Imran', toelichting: 'Bij de kassa bedacht' });
  assert.ok(uit.ok);

  const lijst = db.data.posSales.MODE;
  const origineel = lijst.find(x => x.id === sale.id);
  assert.ok(origineel, 'de bon is er nog -- een boekhouding wist niets');
  assert.equal(origineel.total, 640, 'en zijn bedrag is niet aangepast');
  assert.equal(origineel.geannuleerd.grond, 'klant-zag-af');
  assert.equal(origineel.geannuleerd.door, 'Imran');
  assert.match(origineel.geannuleerd.toelichting, /kassa bedacht/);

  const tegen = lijst.find(x => x.soort === 'annulering');
  assert.ok(tegen, 'en er staat een tegenboeking');
  assert.equal(tegen.vanBon, sale.id);
  assert.equal(tegen.total, -640);
  assert.equal(tegen.items[0].qty, -2, 'ook de aantallen spiegelen');
  assert.equal(tegen.items[0].price, 320, 'de stukprijs niet: die was wat hij was');
});

test('4. een tegenboeking draai je niet terug', () => {
  const s = zaak(); const { R, db } = motor(s);
  const sale = verkoop(R, s).sale;
  R.annuleerVerkoop(s, sale.id, { grond: 'vergissing' });
  const tegen = db.data.posSales.MODE.find(x => x.soort === 'annulering');
  const r = R.annuleerVerkoop(s, tegen.id, { grond: 'vergissing' });
  assert.equal(r.status, 409);
  assert.match(r.error, /tegenboeking/);
});

test('5. een mislukte betaling gaat langs DEZELFDE weg, met zijn eigen grond', () => {
  const s = zaak(); const { R, db } = motor(s);
  const sale = verkoop(R, s).sale;
  const uit = R.verkoopTerug(s, sale, 'Kassa');
  assert.ok(uit.ok);
  assert.equal(db.data.posSales.MODE.find(x => x.id === sale.id).geannuleerd.grond, 'betaling-mislukt');
  assert.equal(s.artikelen[0].varianten[0].voorraad, 5);
  /* Een tweede mechanisme voor dit ene geval zou een tweede waarheid zijn over
     de vraag of die omzet echt is. */
  assert.equal(db.data.posSales.MODE.filter(x => x.soort === 'annulering').length, 1);
});

test('6. de omzet valt weg, het AANTAL bonnen telt niet dubbel', () => {
  const s = zaak(); const { R } = motor(s);
  const a = verkoop(R, s, 1).sale;                 // 320
  verkoop(R, s, 1);                                // en nog 320
  assert.equal(R.retailStats(s).omzetVandaag, 640);
  assert.equal(R.retailStats(s).bonnenVandaag, 2);

  R.annuleerVerkoop(s, a.id, { grond: 'vergissing' });
  const na = R.retailStats(s);
  assert.equal(na.omzetVandaag, 320, 'de tegenboeking is negatief en valt vanzelf weg');
  assert.equal(na.bonnenVandaag, 1, 'een hersteld foutje is geen twee klanten');
  assert.equal(na.teruggedraaidVandaag, 1);
  /* En de bestsellers tellen ook netjes af. */
  assert.equal((na.bestsellers.find(b => b.naam === 'Linnen overhemd') || {}).aantal, 1);
});

test('7. de BTW-POT gaat mee omlaag -- met de echte fiscale laag', () => {
  const s = zaak(); const { R, db } = motor(s);
  const fiscaal = require('../server/kern/fiscaal').maakFiscaal({
    /* De ECHTE helpers uit kern/afgeleid.js en geen nabootsing: een fixture die
       afwijkt van de bron toetst de fixture. */
    db, centen: (n) => Math.round(n * 100) / 100,
    btwSplit: require('../server/kern/afgeleid').btwSplit
  });
  /* De VORM komt uit kern/fiscaal/index.js: financeVoor geeft `btw`, een rij
     per categorie met omzet, grondslag en btw. Geen `potten` -- dat is de
     interne naam, en een toets die die leest, toetst iets anders dan wat de
     zaak op haar scherm ziet. */
  const som = (f) => Math.round((f.btw || []).reduce((n, r) => n + r.omzet, 0) * 100) / 100;
  const btwSom = (f) => Math.round((f.btw || []).reduce((n, r) => n + r.btw, 0) * 100) / 100;

  const sale = verkoop(R, s, 2).sale;              // 640
  const voor = fiscaal.financeVoor(s);
  assert.ok(som(voor) >= 640, 'de verkoop staat in de aangifte: ' + som(voor));
  const btwVoor = btwSom(voor);
  assert.ok(btwVoor > 0, 'en er wordt btw over gerekend');

  R.annuleerVerkoop(s, sale.id, { grond: 'retour' });
  const na = fiscaal.financeVoor(s);
  assert.ok(btwSom(na) < btwVoor, 'ook de af te dragen btw gaat omlaag');
  assert.equal(som(voor) - som(na), 640,
    'zonder deze regel bleef de verkoop in de pot staan en verdween de annulering: een aangifte die te hoog uitvalt');
});

test('8. een bon die niet bestaat, en een zaak die geen retail is', () => {
  const s = zaak(); const { R } = motor(s);
  assert.equal(R.annuleerVerkoop(s, 'bestaat-niet', { grond: 'vergissing' }).status, 404);
  const geen = zaak(); geen.caps = ['restaurant'];
  assert.equal(R.annuleerVerkoop(geen, 'x', { grond: 'vergissing' }).status, 400);
});

test('9. het bonbeeld vertelt wat er met een bon is gebeurd', () => {
  const s = zaak(); const { R } = motor(s);
  const sale = verkoop(R, s).sale;
  const schoon = R.bonBeeld(s, sale.id);
  assert.equal(schoon.soort, 'verkoop');
  assert.equal(schoon.geannuleerd, null);
  assert.equal(schoon.tegenboeking, null);

  R.annuleerVerkoop(s, sale.id, { grond: 'vergissing' });
  const na = R.bonBeeld(s, sale.id);
  assert.equal(na.geannuleerd.grond, 'vergissing');
  assert.ok(na.tegenboeking, 'en wijst naar de tegenboeking');
  assert.equal(R.bonBeeld(s, 'bestaat-niet'), null);
});
