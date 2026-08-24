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

/* DE OMZET TELT EEN KEER, OOK ALS ER EEN BON OVERHEEN GAAT.

   Twee wegen leggen een GEBUNDELDE kassabon over posten die zelf al omzet zijn,
   en allebei telden ze daardoor dubbel in de maandboekhouding (TAKEN.md 4.28):

     - het tafelticket rekent bestellingen af en legt er een bundelbon overheen;
     - pos/checkout rekent openstaande kamer- EN tafelbonnen af, maar financeVoor
       sloeg alleen `kamer` over.

   De btw-aangifte had er geen last van (die telt facturen, en die staan per
   bon), dus dit was alleen zichtbaar als je de boekhouding naast de bonnen
   legde. Vandaar deze twee toetsen: ze vergelijken de getelde omzet met de som
   van wat er werkelijk verkocht is. */
test('financeVoor: een tafelticket telt de bestellingen een keer, niet ook de bundelbon', () => {
  const maand = new Date().toISOString().slice(0, 7);
  const s = { code: 'KIKUNOI', type: 'horeca', menu: [{ name: 'Sushi', station: 'keuken' }], settings: { land: 'NL' } };
  const db = stubDb({
    orders: [
      { supplierCode: 'KIKUNOI', paid: true, paidAt: maand + '-05', items: [{ name: 'Sushi', price: 109, qty: 1 }] },
      { supplierCode: 'KIKUNOI', paid: true, paidAt: maand + '-05', items: [{ name: 'Sushi', price: 109, qty: 1 }] }
    ],
    // de gebundelde kassabon die /tafelticket/afrekenen eroverheen legt
    posSales: { KIKUNOI: [{ total: 218, method: 'contant', items: null, omzetElders: 'bestellingen', at: maand + '-05' }] }
  });
  const { financeVoor } = maakFiscaal({ db, centen, btwSplit });
  const omzet = financeVoor(s).btw.reduce((x, r) => x + r.omzet, 0);
  assert.equal(omzet, 218, 'de twee bestellingen, en de bundelbon eroverheen niet nog eens');
});

test('financeVoor: een openstaande tafelrekening telt pas bij het afrekenen mee', () => {
  const maand = new Date().toISOString().slice(0, 7);
  const s = { code: 'KIKUNOI', type: 'horeca', menu: [], settings: { land: 'NL' } };
  const bon = m => ({ total: 50, method: m, items: null, room: 'Tafel 7', at: maand + '-05' });
  const { financeVoor } = maakFiscaal({ db: stubDb({ posSales: { KIKUNOI: [bon('tafel')] } }), centen, btwSplit });
  assert.equal(financeVoor(s).btw.reduce((x, r) => x + r.omzet, 0), 0,
    'een bon die nog op de tafel staat is nog niet afgerekend');

  // en na de check-out: alleen de bundel, niet de bundel PLUS de losse posten
  const na = maakFiscaal({ db: stubDb({ posSales: { KIKUNOI: [
    { ...bon('tafel'), settled: true }, { ...bon('kamer'), room: 'Kamer 3', settled: true },
    { total: 100, method: 'contant', items: null, at: maand + '-05' }
  ] } }), centen, btwSplit });
  assert.equal(na.financeVoor(s).btw.reduce((x, r) => x + r.omzet, 0), 100,
    'de gebundelde check-outbon draagt de omzet van kamer en tafel samen');
});

test('dagrapport: een bestelling van VOOR de betaalwijze-ronde valt terug op de app', () => {
  /* Deze toets kwam uit de 4.28-ronde: het Z-rapport telde de bestellingen en de
     bundelbon allebei, dus stond er 436 bij een tafel van 218, btw-pot en al.
     Dat deel staat nu in de brede toets hieronder.

     Wat hier OVERBLIJFT is een geval dat de brede toets juist niet dekt: deze
     bestellingen dragen geen `betaaldMet`, want dat veld bestond nog niet. Elke
     bestelling die al in de database stond is er zo een. Ze horen niet te
     verdwijnen uit de betaalwijzen en ook niet dubbel te tellen -- ze vallen
     terug op 'app', wat ze tot deze ronde allemaal waren. */
  const dag = new Date().toISOString().slice(0, 10);
  const s = { code: 'KIKUNOI', type: 'horeca', menu: [{ name: 'Sushi', station: 'keuken' }], settings: { land: 'NL' } };
  const db = stubDb({
    orders: [
      { supplierCode: 'KIKUNOI', paid: true, paidAt: dag, items: [{ name: 'Sushi', price: 109, qty: 1 }] },
      { supplierCode: 'KIKUNOI', paid: true, paidAt: dag, items: [{ name: 'Sushi', price: 109, qty: 1 }] }
    ],
    posSales: { KIKUNOI: [{ total: 218, method: 'contant', items: null, omzetElders: 'bestellingen', at: dag }] }
  });
  const { dagrapport } = maakFiscaal({ db, centen, btwSplit });
  const z = dagrapport(s, dag);
  assert.equal(z.omzet, 218, 'de omzet van de dag, niet twee keer dezelfde tafel');
  assert.equal(z.btw.reduce((x, r) => x + r.omzet, 0), 218, 'en de btw-grondslag telt hem ook een keer');
  assert.deepEqual(z.betaalwijzen, { app: 218 }, 'zonder betaaldMet: terugval op app, en niet weggelaten');
  assert.equal(Object.values(z.betaalwijzen).reduce((x, v) => x + v, 0), z.omzet,
    'ook op oude gegevens tellen de betaalwijzen op tot de omzet');
});

/* CADEAUKAARTEN TELLEN NIET NAAST DE KASSABON (TAKEN.md 4.27).

   financeVoor telde elke inwisseling apart als omzet, terwijl de inwisseling
   geen factuur boekte. Twee gevolgen tegelijk: de btw-aangifte MISTE die omzet
   (die telt facturen) en de boekhouding telde hem DUBBEL zodra de kassa de bon
   ook aansloeg -- gemeten 100 bij 50 verkocht. Sinds die ronde is 'cadeaukaart'
   een betaalwijze aan de kassa en draagt de gewone bon de omzet. */
test('financeVoor: een cadeaukaart aan de kassa telt een keer, via de bon', () => {
  const maand = new Date().toISOString().slice(0, 7);
  const s = { code: 'KIKUNOI', type: 'horeca', menu: [], settings: { land: 'NL' } };
  const kaart = bron => ({ supplierCode: 'KIKUNOI', bedrag: 100, saldo: 50, at: maand + '-01',
    verzilveringen: [{ bedrag: 50, at: maand + '-05', bron }] });
  const omzetVan = db => maakFiscaal({ db, centen, btwSplit }).financeVoor(s).btw.reduce((x, r) => x + r.omzet, 0);

  // de kassaweg: een bon van 50 die de kaart afboekt -- 50, niet 100
  assert.equal(omzetVan(stubDb({
    giftcards: [kaart('kassa')],
    posSales: { KIKUNOI: [{ total: 50, method: 'cadeaukaart', items: null, at: maand + '-05' }] }
  })), 50, 'de bon draagt de omzet; de inwisseling telt er niet naast');

  // de handmatige afboeking maakt geen bon, dus draagt geen omzet -- maar dat
  // wordt wel MELD, want geld dat buiten de boeken valt mag niet stil zijn
  const fin = maakFiscaal({ db: stubDb({ giftcards: [kaart('handmatig')] }), centen, btwSplit }).financeVoor(s);
  assert.equal(fin.btw.reduce((x, r) => x + r.omzet, 0), 0, 'een afboeking zonder bon is geen omzet');
  assert.equal(fin.giftcards.handmatig, 50, 'en staat apart gemeld');
  assert.ok(fin.regels.some(r => /met de hand/.test(r) && /50/.test(r)),
    'met een regel in het overzicht die zegt dat dit bedrag buiten omzet en aangifte valt');
});

/* HET Z-RAPPORT TELT ELKE EURO EEN KEER, LANGS ELKE WEG (TAKEN.md 4.59).

   Drie fouten tegelijk, alle drie in dezelfde lus. `omzet` telde op VOOR de
   uitsluiting van uitstel en interne verrekening, dus telde die mee (218 bij
   109 verkocht). `bonnen` telde elk papiertje, ook de twee die bij dezelfde
   verkoop horen. En `betaalwijzen` telde het uitstel EN de afrekening, samen het
   dubbele van de lade, met een aan tafel contant afgerekende bestelling onder
   'app'. De btw-pot deed het al goed -- dat was het bewijs dat de uitsluiting
   zelf klopte en alleen te laat kwam.

   Deze toets loopt alle ZEVEN wegen langs waarlangs geld bij een zaak
   binnenkomt, want de fouten zaten in verschillende wegen en een toets op een
   enkel geval had de rest gemist. De vierde bewering is de belangrijkste: de
   betaalwijzen tellen op tot de omzet. Zolang dat waar is, kan de kasopmaak
   erop steunen. */
test('dagrapport: alle zeven wegen tellen hun omzet, bonnen en betaalwijzen precies een keer', () => {
  const dag = new Date().toISOString().slice(0, 10);
  const s = { code: 'K', type: 'horeca', menu: [{ name: 'Sushi', station: 'keuken' }], settings: { land: 'NL' } };
  const order = w => ({ supplierCode: 'K', paid: true, paidAt: dag, betaaldMet: w,
    items: [{ name: 'Sushi', price: 109, qty: 1 }] });
  const kassabon = o => Object.assign({ total: 109, method: 'contant', items: null, at: dag }, o);

  //             naam                        gegevens                                              omzet bonnen betaalwijzen        openstaand
  const wegen = [
    ['losse kassabon', { posSales: { K: [kassabon()] } }, 109, 1, { contant: 109 }, {}],
    ['bestelling in de app', { orders: [order('app')] }, 109, 1, { app: 109 }, {}],
    ['RTG-ophaalcode aan de balie', { orders: [order('rtg')], posSales: { K: [kassabon({ method: 'rtg' })] } },
      109, 1, { rtg: 109 }, {}],
    ['tafelticket, contant afgerekend', { orders: [order('contant'), order('contant')],
      posSales: { K: [kassabon({ total: 218, omzetElders: 'bestellingen' })] } }, 218, 2, { contant: 218 }, {}],
    ['op de kamer, dan check-out', { posSales: { K: [kassabon({ method: 'kamer', settled: true }), kassabon()] } },
      109, 1, { contant: 109 }, { kamer: 109 }],
    ['op de tafel, dan afrekenen', { posSales: { K: [kassabon({ method: 'tafel', settled: true }), kassabon()] } },
      109, 1, { contant: 109 }, { tafel: 109 }],
    ['cadeaukaart aan de kassa', { posSales: { K: [kassabon({ method: 'cadeaukaart' })] } },
      109, 1, { cadeaukaart: 109 }, {}]
  ];
  for (const [naam, data, omzet, bonnen, wijzen, openstaand] of wegen) {
    const z = maakFiscaal({ db: stubDb(data), centen, btwSplit }).dagrapport(s, dag);
    assert.equal(z.omzet, omzet, naam + ': de omzet van de dag');
    assert.equal(z.btw.reduce((x, r) => x + r.omzet, 0), omzet, naam + ': en dezelfde btw-grondslag');
    assert.equal(z.bonnen, bonnen, naam + ': het aantal verkopen, niet het aantal papiertjes');
    assert.deepEqual(z.betaalwijzen, wijzen, naam + ': onder de betaalwijze waarmee er echt is afgerekend');
    assert.deepEqual(z.openstaandGezet, openstaand, naam + ': uitstel staat apart, niet als ontvangst');
    assert.equal(Object.values(z.betaalwijzen).reduce((x, v) => x + v, 0), z.omzet,
      naam + ': de betaalwijzen tellen op tot de omzet -- hier steunt de kasopmaak op');
  }
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

test('tarief: de categorie volgt de werkvorm van de zaak, niet het genre alleen', () => {
  const eet = { type: 'restaurant', menu: [{ name: 'Sushi', station: 'keuken' }] };
  assert.equal(tarief.basisCat(eet, ['menu']), 'eten');
  assert.equal(tarief.basisCat({ type: 'hotel' }, ['rooms', 'menu']), 'logies', 'kamers gaan voor de kaart');
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
  assert.equal(tarief.catVanItem({ type: 'hotel' }, 'Sake', 'logies'), 'logies', 'buiten de horeca-basis: nooit');
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
