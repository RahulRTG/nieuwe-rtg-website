/* Zaak Command (kern/zaakcommand/): dezelfde commandologica als RTG Command,
   maar van EEN zaak en uitsluitend over die zaak. Deze toets bewijst vier
   dingen: de zaak ziet niets van een andere zaak en niets van RTG; een recept
   verzint geen werkelijkheid maar zet alleen administratie recht; wat een mens
   moet beslissen wordt een signaal en geen automaat; en het journaal van de ene
   zaak staat niet in dat van de andere.

   DE EERSTE IS DE BELANGRIJKSTE. De afhankelijkhedenscan van Command loopt ALLE
   soorten van het register langs op zoek naar rijen die de sleutel noemen. Met
   het RTG-register zou een zaak die op zijn eigen code zoekt de bestellingen van
   de buurman terugkrijgen. Daarom bouwt kern/zaakcommand een EIGEN register
   waarin de buurman niet voorkomt -- en daarom staat hier een toets die precies
   dat probeert.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - het zaakregister laten lezen uit de hele collectie (de supplierCode-filter
     uit veldVan() gehaald)
     -> "de zaak ziet niets van de buurman" ZAKT (RAAK), op zoeken én op dossier;
        "een recept verzint geen werkelijkheid" zakt mee, want dan zou het recept
        ook de bestelling van de buurman rechtzetten -- dat hoort zo
   - het vak van de zaak vervangen door db.data (de per-zaak partitie weg)
     -> "elke zaak heeft zijn eigen spoor" ZAKT (RAAK)
   - de stationvoorwaarde in bestelling-stations-klaar op `true` gezet
     -> "een recept verzint geen werkelijkheid" ZAKT (RAAK)
   - de as-filter in maakZaakRegister weggehaald (leiding-soorten altijd erin)
     -> "een medewerker ziet geen verlof en geen sollicitaties" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function maak() {
  const mijn = { code: 'MIJN', name: 'Sal de Mar', type: 'restaurant', city: 'Ibiza',
    rooms: [{ id: 'k1', name: 'Suite', available: true, hk: { status: 'vuil' } }], tables: [{ id: 't1', naam: '4' }] };
  const buur = { code: 'BUUR', name: 'Buurzaak', type: 'restaurant', city: 'Ibiza', rooms: [], tables: [] };
  const oud = new Date(Date.now() - 3600e3).toISOString();
  const db = { data: {
    suppliers: [mijn, buur],
    orders: [
      { ref: 'O-MIJN', supplierCode: 'MIJN', paid: true, status: 'nieuw', at: oud,
        customerCodename: 'Havik', total: 4200, stations: { warm: 'klaar', koud: 'klaar' } },
      { ref: 'O-HALF', supplierCode: 'MIJN', paid: true, status: 'nieuw', at: oud,
        customerCodename: 'Reiger', total: 1500, stations: { warm: 'klaar', koud: 'bezig' } },
      { ref: 'O-BUUR', supplierCode: 'BUUR', paid: true, status: 'nieuw', at: oud,
        customerCodename: 'Buurman', total: 900, stations: { warm: 'klaar' } }
    ],
    rides: [{ ref: 'R-MIJN', supplierCode: 'MIJN', paid: true, status: 'rijdt', at: oud, from: 'Haven', to: 'Hotel' }],
    boekingen: [{ ref: 'B-MIJN', supplierCode: 'MIJN', paid: true, status: 'bevestigd',
      date: new Date(Date.now() - 3 * 86400e3).toISOString(), kind: 'suite', price: 78000 }],
    tickets: { MIJN: [{ id: 'T1', titel: 'Lekkage', status: 'opgelost' }], BUUR: [{ id: 'T9', titel: 'Buurklus', status: 'open' }] },
    verlof: { MIJN: [{ id: 'V1', naam: 'Ana', status: 'nieuw', van: '2026-09-01', tot: '2026-09-05' }] },
    applications: {}, vacatures: {}, reserveringen: []
  } };
  const zc = require('../server/kern/zaakcommand').maakZaakCommand({
    db, save: () => {}, crypto, anthropic: null,
    findSupplier: (c) => db.data.suppliers.find(x => x.code === c)
  });
  /* TWEE LAGEN VAN DEZELFDE ZAAK, en dat is de tweede as van de scope: `mij` is
     de leiding, `vloer` een gewone medewerker. Het verschil tussen die twee is
     wat deze toets bewaakt. */
  return { db, mijn, buur, zc,
    mij: zc.voor(mijn, { leiding: true }),
    vloer: zc.voor(mijn),
    buurLaag: zc.voor(buur, { leiding: true }) };
}

test('de zaak ziet niets van de buurman', () => {
  const { mij } = maak();
  for (const term of ['Buurman', 'BUUR', 'O-BUUR', 'Buurklus']) {
    assert.equal(mij.zoek(term).totaal, 0, 'zoeken op "' + term + '" hoort niets op te leveren');
  }
  assert.equal(mij.dossier('bestelling', 'O-BUUR').status, 404, 'en het dossier van de buurman bestaat niet');
  assert.equal(mij.dossier('klus', 'T9').status, 404);

  /* De afhankelijkhedenscan is het gevaarlijkste pad: hij loopt ELKE soort van
     het register langs. Draait hij op het zaakregister, dan kan hij per
     definitie niets buiten de zaak vinden. */
  const d = mij.dossier('bestelling', 'O-MIJN');
  const gevonden = JSON.stringify(d);
  assert.equal(gevonden.includes('BUUR'), false, 'geen enkel spoor van de buurman in het dossier');
});

test('de zaak ziet ook niets van RTG zelf', () => {
  const { mij } = maak();
  const soorten = mij.register.SOORTEN.map(s => s.type);
  for (const verboden of ['zaak', 'salonpost', 'rijksvoertuig', 'melding', 'voertuig']) {
    assert.equal(soorten.includes(verboden), false, verboden + ' hoort niet in het register van een zaak');
  }
  /* En het beleid is dat van de zaak: geen agent-budgetten, geen
     foundation-afdracht, geen platformgrenzen. */
  const regels = mij.beleid.alles().map(r => r.id);
  assert.equal(regels.some(r => r.startsWith('agent.')), false, 'geen agent-budgetten in een zaak');
  assert.equal(regels.includes('foundation.deelPromille'), false, 'geen platformafdracht in een zaak');
  assert.ok(regels.includes('zaak.reactieMinuten'), 'wel de eigen reactiegrens: ' + regels.join(','));
});

test('elke zaak heeft zijn eigen spoor', () => {
  const { mij, buurLaag, db } = maak();
  mij.beleid.zet('zaak.reactieMinuten', 5, 'Ik', 'sneller signaleren');
  buurLaag.beleid.zet('zaak.reactieMinuten', 60, 'Buur', 'rustiger aan');

  assert.equal(mij.beleid.waarde('zaak.reactieMinuten'), 5);
  assert.equal(buurLaag.beleid.waarde('zaak.reactieMinuten'), 60, 'de buurman heeft zijn eigen waarde');

  const mijnSpoor = mij.journaal.recent(20);
  assert.equal(mijnSpoor.length, 1, 'één regel, niet twee');
  assert.equal(mijnSpoor[0].actor, 'Ik');
  assert.equal(mij.journaal.controleer().heel, true, 'en de eigen keten sluit');
  assert.ok(db.data.zaakCommand.MIJN && db.data.zaakCommand.BUUR, 'beide zaken hebben een eigen vak');
});

test('een recept verzint geen werkelijkheid', () => {
  const { db, mij } = maak();
  const rbs = mij.runbooks.lijst();
  const stations = rbs.find(r => r.id === 'bestelling-stations-klaar');
  assert.equal(stations.kandidaten, 1, 'alleen de bestelling waarvan ALLE stations klaar melden');

  mij.runbooks.voer('bestelling-stations-klaar', { droog: false, door: 'Ik', reden: 'toets' });
  assert.equal(db.data.orders.find(o => o.ref === 'O-MIJN').status, 'klaar');
  assert.equal(db.data.orders.find(o => o.ref === 'O-HALF').status, 'nieuw',
    'de bestelling waar de koude kant nog bezig is, blijft staan -- die zou een leugen zijn');
  assert.equal(db.data.orders.find(o => o.ref === 'O-BUUR').status, 'nieuw', 'en de buurman is niet aangeraakt');
});

test('een oude statusnaam wordt omgezet naar de naam die de keten nu gebruikt', () => {
  const { db, mij } = maak();
  const { RIT_OUD } = require('../server/kern/zaakcommand/runbooks');
  const { RIT_LEGACY } = require('../server/kern/vervoer');
  assert.deepEqual(RIT_OUD, RIT_LEGACY, 'het recept kent dezelfde oude namen als de vervoerslaag');

  mij.runbooks.voer('rit-oude-statusnaam', { droog: false, door: 'Ik', reden: 'toets' });
  assert.equal(db.data.rides.find(r => r.ref === 'R-MIJN').status, 'aan-boord');
});

test('wat een mens moet beslissen wordt een signaal en geen automaat', () => {
  const { mij, mijn } = maak();
  const sig = mij.signalen.voor(mijn, { leiding: true });
  const ids = sig.map(x => x.id.split(':')[0]);
  assert.ok(ids.includes('bestelling-onaangeroerd'), 'de onaangeroerde bestelling is een signaal: ' + ids.join(','));
  assert.ok(ids.includes('verlof-open') && ids.includes('kamer-vuil'));

  /* En geen enkel recept raakt die dingen aan: er is geen runbook dat een
     bestelling aanneemt, verlof toekent of een kamer schoon meldt. */
  const velden = mij.runbooks.RUNBOOKS.map(r => r.type + '.' + r.veld);
  assert.equal(velden.includes('verlof.status'), false, 'verlof toekennen is nooit een automaat');
  assert.equal(velden.includes('kamer.hk'), false, 'een kamer schoon melden is nooit een automaat');

  const zaak = mij.signaalOppakken(sig[0].id, 'Ik').zaak;
  assert.equal(zaak.oorzaak, sig[0].oorzaak);
  assert.equal(zaak.bewijs.signaal, sig[0].id, 'de uitzondering draagt het signaal waaruit hij ontstond');
  assert.equal(mij.signaalOppakken(sig[0].id, 'Ik').bestond, true, 'en twee keer oppakken geeft dezelfde zaak');
});

test('een medewerker ziet geen verlof en geen sollicitaties', () => {
  /* DE FOUT DIE DEZE TOETS DICHTZET, en hij zat er echt in. De eerste versie van
     deze laag scoopte alleen op de ZAAK. Een ober met een gewone zaak-sessie kon
     daardoor via de zoekbalk en het objectdossier de verlofaanvragen en
     sollicitaties van zijn collega's lezen -- gegevens die overal elders in deze
     app achter managerOnly staan (routes/supplier/hrplus.js:47).

     De reparatie is weglaten en niet filteren: die soorten staan niet in zijn
     register. Daarom toetst dit op ALLE drie de lezers, want een filter had op
     één ervan vergeten kunnen worden. */
  const { mij, vloer, mijn } = maak();
  const vloerSoorten = vloer.register.SOORTEN.map(s => s.type);
  for (const hr of ['verlof', 'sollicitatie', 'vacature']) {
    assert.equal(vloerSoorten.includes(hr), false, hr + ' hoort niet in het register van de vloer');
    assert.ok(mij.register.SOORTEN.map(s => s.type).includes(hr), hr + ' hoort er voor de leiding wel in');
  }
  assert.equal(vloer.zoek('Ana').totaal, 0, 'de vloer vindt de verlofaanvraag van Ana niet');
  assert.ok(mij.zoek('Ana').totaal > 0, 'de leiding vindt hem wel');
  assert.equal(vloer.dossier('verlof', 'V1').status, 404, 'en kan hem ook niet rechtstreeks openen');

  const vloerSig = vloer.signalen.voor(mijn).map(x => x.id);
  assert.equal(vloerSig.includes('verlof-open'), false, 'ook het signaal erover is niet voor de vloer');
  assert.ok(mij.signalen.voor(mijn, { leiding: true }).map(x => x.id).includes('verlof-open'));
});

test('het beeld van de zaak zegt wat het niet weet', () => {
  const { mij } = maak();
  const p = mij.puls();
  assert.equal(p.zaak.code, 'MIJN');
  assert.ok(p.dekking.soorten >= 8, 'de dekking staat erbij');
  assert.ok(p.objecten.every(o => typeof o.aantal === 'number'));
  assert.notEqual(p.stand, 'in orde', 'er staat iets open, dus niet "in orde"');
});
