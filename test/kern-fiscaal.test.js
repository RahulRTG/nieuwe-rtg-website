/* Tests voor de fiscale/financiele laag (server/kern/fiscaal.js).
   De rekenlaag draagt db + helpers; we voeren een minimale db-stub op.
   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { FISCAAL_PEILJAAR, LANDEN, FIN_CAT, ZZP, maakFiscaal } = require('../server/kern/fiscaal');
const { centen } = require('../server/kern/util');
const { btwSplit } = require('../server/kern/afgeleid');

// Minimale db met precies de collecties die financeVoor leest.
function stubDb(extra) {
  const db = { data: Object.assign({
    supplierTypes: { horeca: { caps: ['menu'] } },
    orders: [], posSales: {}, rides: [], boekingen: [], giftcards: [], klok: {}
  }, extra || {}) };
  // dezelfde werkvormen-afleiding als de echte db (db.capsVan)
  return require('../server/kern/werkvormen').haakAan(db);
}

test('tabellen zijn compleet en het peiljaar is een jaartal', () => {
  assert.equal(typeof FISCAAL_PEILJAAR, 'number');
  for (const code of ['NL', 'BE', 'DE', 'FR', 'ES', 'JP']) {
    assert.ok(LANDEN[code], code + ' in LANDEN');
    assert.ok(ZZP[code], code + ' in ZZP');
    assert.ok(LANDEN[code].tarieven.standaard > 0, code + ' heeft een standaardtarief');
  }
  assert.ok(FIN_CAT.eten && FIN_CAT.drank);
});

test('financeVoor: btw per categorie, keuken=eten en bar=drank (NL)', () => {
  const maand = new Date().toISOString().slice(0, 7);
  const s = {
    code: 'KIKUNOI', type: 'horeca',
    menu: [{ name: 'Sushi', station: 'keuken' }, { name: 'Sake', station: 'bar' }],
    settings: { land: 'NL', uurloon: 20 }
  };
  const db = stubDb({
    orders: [{ supplierCode: 'KIKUNOI', paid: true, at: maand + '-05', items: [
      { name: 'Sushi', price: 109, qty: 1 }, // 9% -> grondslag 100, btw 9
      { name: 'Sake', price: 121, qty: 1 }   // 21% -> grondslag 100, btw 21
    ] }]
  });
  const { financeVoor } = maakFiscaal({ db, centen, btwSplit });
  const fin = financeVoor(s);
  assert.equal(fin.land, 'NL');
  assert.equal(fin.peiljaar, FISCAAL_PEILJAAR);
  const eten = fin.btw.find(r => r.cat === 'eten');
  const drank = fin.btw.find(r => r.cat === 'drank');
  assert.deepEqual([eten.grondslag, eten.btw], [100, 9], 'keuken -> 9%');
  assert.deepEqual([drank.grondslag, drank.btw], [100, 21], 'bar -> 21%');
  assert.equal(fin.btwTotaal, 30, 'totaal af te dragen btw');
});

test('financeVoor: personeelskosten uit klokuren met land-specifieke lasten', () => {
  const maand = new Date().toISOString().slice(0, 7);
  const s = { code: 'KIKUNOI', type: 'horeca', menu: [], settings: { land: 'NL', uurloon: 20 } };
  const db = stubDb({
    klok: { KIKUNOI: [{ staffId: 'a', in: maand + '-03T09:00:00.000Z', out: maand + '-03T19:00:00.000Z' }] } // 10 uur
  });
  const { financeVoor } = maakFiscaal({ db, centen, btwSplit });
  const fin = financeVoor(s);
  assert.equal(fin.personeel.uren, 10);
  assert.equal(fin.personeel.bruto, 200, '10 uur x 20');
  assert.equal(fin.personeel.lastenPct, 28, 'NL werkgeverslasten');
  assert.equal(fin.personeel.totaal, centen(200 * (1 + 0.28 + 0.08)), 'bruto + lasten + vakantiegeld');
});

test('cannedBoekhouder: antwoordt gericht op btw, personeel en cadeaukaarten', () => {
  const s = { code: 'KIKUNOI', type: 'horeca', menu: [], settings: { land: 'NL', uurloon: 20 } };
  const { financeVoor, cannedBoekhouder } = maakFiscaal({ db: stubDb(), centen, btwSplit });
  const fin = financeVoor(s);
  const L = LANDEN.NL;
  assert.match(cannedBoekhouder('hoeveel btw moet ik afdragen?', fin, L), /btw/i);
  assert.match(cannedBoekhouder('wat kost mijn personeel?', fin, L), /uren|loon|lasten/i);
  assert.match(cannedBoekhouder('iets over cadeaukaarten', fin, L), /cadeau|saldo|balans/i);
});

/* ------------------------------------------------------------------------
   Het btw-tarief staat op EEN plek (server/kern/fiscaal/tarief.js).

   Hiervoor stond het op twee: de boekhouding zocht het per categorie op in de
   landentabel, de factuurmotor had 'restaurant/bar/hotel/groothandel/boerderij
   krijgen 9%, de rest 21%' in zijn kop staan -- zonder naar het land te kijken.
   Voor een Nederlandse zaak viel dat samen, daarbuiten niet.
   ------------------------------------------------------------------------ */
const tarief = require('../server/kern/fiscaal/tarief');
/* De ECHTE genrelijst en de ECHTE capsVan, voor de toetsen onderaan: die gaan
   juist over de vraag of een cap in productie kan bestaan, en dan is een stub
   met verzonnen caps precies het verkeerde gereedschap. */
const genres = require('../server/seed/genres-lijst');
const werkvormen = require('../server/kern/werkvormen');

test('tarief: de categorie volgt de werkvorm van de zaak, niet het genre alleen', () => {
  const eet = { type: 'restaurant', menu: [{ name: 'Sushi', station: 'keuken' }] };
  assert.equal(tarief.basisCat(eet, ['menu']), 'eten');
  /* HIER STOND `['rooms', 'menu']`, EN DAT IS PRECIES WAAROM DE FOUT BLEEF.
     `rooms` is geen cap: geen van de 73 genres draagt hem en kern/werkvormen.js
     maakt hem nergens aan. Deze toets voerde dus een invoer op die in productie
     niet kan bestaan, zag de tak groen worden, en dekte een dode tak af -- de
     btw op een overnachting werd al die tijd als 'eten' of 'standaard' gerekend
     (appartement NL 21% in plaats van 9%). Een toets met verzonnen invoer is
     erger dan geen toets, want hij geeft dekking zonder dekking te leveren.
     test/genrecap.test.js houdt sindsdien elke genoemde cap tegen de code aan. */
  assert.equal(tarief.basisCat({ type: 'hotel' }, ['bookings', 'menu']), 'logies', 'kamers gaan voor de kaart');
  assert.equal(tarief.basisCat({ type: 'hotel' }, ['rooms', 'menu']), 'eten',
    '`rooms` bestaat niet en mag hier dus ook niets doen');
  assert.equal(tarief.basisCat({ type: 'taxi' }, ['rides']), 'vervoer');
  assert.equal(tarief.basisCat({ type: 'jet' }, ['rides']), 'jet', 'internationaal personenvervoer apart');
  /* En de reparatie: een zaak zonder kaart, kamers of ritten is GEEN eten.
     De boekhouding zette die vroeger ook op 'eten', dus een kledingwinkel
     rekende het verlaagde tarief over een jas. */
  assert.equal(tarief.basisCat({ type: 'retail' }, ['catalog']), 'standaard');
});

test('tarief: binnen de horeca telt de bar apart, daarbuiten verandert een artikel niets', () => {
  const zaak = { type: 'restaurant', menu: [{ name: 'Sushi', station: 'keuken' }, { name: 'Sake', station: 'bar' }] };
  assert.equal(tarief.catVanItem(zaak, 'Sushi', 'eten'), 'eten');
  assert.equal(tarief.catVanItem(zaak, 'Sake', 'eten'), 'drank', 'alcohol is geen eten');
  assert.equal(tarief.catVanItem(zaak, 'Onbekend gerecht', 'eten'), 'eten', 'niet op de kaart: de basis');
  assert.equal(tarief.catVanItem({ type: 'hotel' }, 'Sake', 'logies'), 'logies',
    'een hotel zonder kaart heeft geen kaartartikelen; alles volgt de basis');
  assert.equal(tarief.catVanItem({ type: 'jet', menu: [{ name: 'Sake', station: 'bar' }] }, 'Sake', 'jet'), 'jet',
    'en buiten eten en logies verandert een artikel de categorie nooit');
});

test('tarief: het percentage komt uit de landentabel, en dus per land anders', () => {
  const nl = { type: 'restaurant', menu: [{ name: 'Sushi' }], settings: { land: 'NL' } };
  const es = { type: 'restaurant', menu: [{ name: 'Sushi' }], settings: { land: 'ES' } };
  assert.equal(tarief.tariefVan(nl, 'eten'), LANDEN.NL.tarieven.eten);
  assert.equal(tarief.tariefVan(es, 'eten'), LANDEN.ES.tarieven.eten);
  /* DIT is wat er misging. De factuurmotor gaf allebei deze zaken 9% omdat ze
     type 'restaurant' hebben; de landentabel geeft ze verschillende tarieven.
     Zakt deze regel ooit, dan zijn NL en ES toevallig gelijk geworden en meet
     de rest van deze toets niets meer. */
  assert.notEqual(LANDEN.NL.tarieven.eten, LANDEN.ES.tarieven.eten,
    'NL en ES verschillen; anders bewijst deze toets niets');
  assert.equal(tarief.tariefVan({ settings: { land: 'ZZ' } }, 'eten'), LANDEN.NL.tarieven.eten,
    'een onbekend land valt terug op Nederland');
  assert.equal(tarief.tariefVan(nl, 'bestaatniet'), LANDEN.NL.tarieven.standaard,
    'een categorie zonder eigen tarief krijgt het standaardtarief');
});

test('tarief: de factuurmotor en de maandboekhouding rekenen met hetzelfde percentage', () => {
  const maand = new Date().toISOString().slice(0, 7);
  const zaak = { code: 'IBZ', type: 'restaurant',
    menu: [{ name: 'Gazpacho', station: 'keuken' }], settings: { land: 'ES', uurloon: 20 } };
  const db = stubDb({
    orders: [{ supplierCode: 'IBZ', paid: true, at: maand + '-05',
      items: [{ name: 'Gazpacho', price: 110, qty: 1 }] }]
  });
  const { financeVoor } = maakFiscaal({ db, centen, btwSplit });
  const eten = financeVoor(zaak).btw.find(r => r.cat === 'eten');
  assert.equal(eten.tarief, LANDEN.ES.tarieven.eten, 'de boekhouding rekent Spaans');
  /* En de motor, langs precies de weg die kern/facturatie/motor.js loopt:
     basisCat -> catVanItem -> tariefVan. Vroeger stond hier 9 tegenover 10. */
  const viaMotor = tarief.tariefVan(zaak,
    tarief.catVanItem(zaak, 'Gazpacho', tarief.basisCat(zaak, db.capsVan(zaak))));
  assert.equal(viaMotor, eten.tarief, 'de bon van de gast draagt hetzelfde tarief');
});

test('tarief: een overnachting valt onder logies, niet onder eten of standaard', () => {
  /* De fout die `rooms` veroorzaakte, in cijfers. Zet in tarief.js `bookings`
     terug op `rooms` en deze toets zakt vier keer. */
  const db = werkvormen.haakAan({ data: { supplierTypes: genres, thuisHuizen: {} } });
  for (const type of ['hotel', 'apartment', 'villa', 'wintersport']) {
    const zaak = { code: 'V', type, rooms: [{ nr: 1 }], settings: { land: 'NL' } };
    const basis = tarief.basisCat(zaak, db.capsVan(zaak));
    assert.equal(basis, 'logies', type + ' verkoopt logies');
    assert.equal(tarief.tariefVan(zaak, basis), 9, type + ' rekent het Nederlandse logiestarief');
  }
  const duits = { code: 'V', type: 'hotel', rooms: [{ nr: 1 }], settings: { land: 'DE' } };
  assert.equal(tarief.tariefVan(duits, tarief.basisCat(duits, db.capsVan(duits))), 7,
    'en in Duitsland 7% en niet 19%');
});

test('tarief: op de rekening van een verblijfszaak volgt een kaartartikel de kaart', () => {
  /* De tweede helft van de reparatie: zonder deze tak zou een pils in een
     hotelbar het logiestarief krijgen. Een reparatie die een andere fout maakt
     is geen reparatie. */
  const db = werkvormen.haakAan({ data: { supplierTypes: genres, thuisHuizen: {} } });
  const hotel = { code: 'H', type: 'hotel', rooms: [{ nr: 1 }], settings: { land: 'NL' },
    menu: [{ name: 'Pils', station: 'bar' }, { name: 'Soep', station: 'keuken' }] };
  const basis = tarief.basisCat(hotel, db.capsVan(hotel));
  assert.equal(basis, 'logies');
  assert.equal(tarief.catVanItem(hotel, 'Pils', basis), 'drank');
  assert.equal(tarief.tariefVan(hotel, 'drank'), 21, 'een pils blijft 21%');
  assert.equal(tarief.catVanItem(hotel, 'Soep', basis), 'eten');
  assert.equal(tarief.catVanItem(hotel, 'Overnachting', basis), 'logies',
    'wat niet op de kaart staat, is de basis van de zaak');

  /* En buiten eten en logies verandert er niets: een privejet blijft 0%. */
  const jet = { code: 'J', type: 'jet', fleet: [{}], settings: { land: 'NL' },
    menu: [{ name: 'Champagne', station: 'bar' }] };
  const jetBasis = tarief.basisCat(jet, db.capsVan(jet));
  assert.equal(jetBasis, 'jet');
  assert.equal(tarief.catVanItem(jet, 'Champagne', jetBasis), 'jet', 'aan boord volgt de vlucht');
});

test('tarief: het Z-rapport rekent met dezelfde categorie als de maandboekhouding', () => {
  /* DE DERDE KOPIE. kern/fiscaal/rapporten.js besliste de categorie met de hand
     -- en keek daarbij naar `rooms`, dus liep hij mee de mist in EN kon hij van
     de andere twee afwijken. Zonder deze toets is die reparatie ongedekt: geen
     enkel bestand in test/ raakte de btw-categorie van het dagrapport aan
     (nagegaan met een mutatie die de basiscategorie op 'standaard' zette --
     alles bleef groen).

     Deze toets kijkt daarom naar de UITKOMST van beide kanten tegelijk: het
     dagrapport van vandaag en de maandboekhouding van dezelfde zaak. Lopen ze
     uiteen, dan is er weer een tweede beslissing bij gekomen. */
  const nu = new Date();
  const dag = nu.toISOString().slice(0, 10);
  const hotel = { code: 'ALPEN', type: 'hotel', settings: { land: 'DE', uurloon: 20 },
    menu: [{ name: 'Pils', station: 'bar' }] };
  const db = stubDb({
    supplierTypes: genres,
    orders: [{ supplierCode: 'ALPEN', paid: true, at: nu.toISOString(), paidAt: nu.toISOString(),
      items: [{ name: 'Overnachting', price: 214, qty: 1 }, { name: 'Pils', price: 119, qty: 1 }] }]
  });
  const { dagrapport, financeVoor } = maakFiscaal({ db, centen, btwSplit });

  const z = dagrapport(hotel, dag);
  const catsZ = Object.fromEntries(z.btw.map(r => [r.cat, r.tarief]));
  assert.equal(catsZ.logies, LANDEN.DE.tarieven.logies, 'de overnachting staat op logies (7%)');
  assert.equal(catsZ.drank, LANDEN.DE.tarieven.drank, 'de pils op drank');

  const maand = financeVoor(hotel);
  const catsM = Object.fromEntries(maand.btw.map(r => [r.cat, r.tarief]));
  assert.deepEqual(catsZ, catsM, 'Z-rapport en maandboekhouding noemen dezelfde categorieen');
});
