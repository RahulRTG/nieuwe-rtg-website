/* VERGETEN: DE POSITIE VAN EEN LID, IN ELK DOMEIN MET EEN EIGEN DEUR.

   server/kern/vergeten/positie.js vraagt elf domeinen om de plek van een lid
   te wissen dat vergeten wil worden. Deze toets zet in ELK van die domeinen een
   herkenbare plek van Wilma (en, waar het een gedeeld dossier is, ook een van
   Bram), draait de positiewisser met de ECHTE domeinmodules, en leest daarna de
   hele database: geen coordinaat en geen sleutel of codenaam van Wilma meer,
   en van Bram staat alles er nog.

   Dat laatste is net zo belangrijk als het eerste. Een rit, een date en een
   alarm zijn ook van een ander: een wisser die het hele dossier weggooit, haalt
   POSITIESTROOM.json ook naar nul en pakt intussen andermans geschiedenis af.

   De koppeling met de echte kern (staan de functies er ook op?) bewaakt
   test/vergeten.test.js, die de route op een draaiende server doorloopt; deze
   toets bewaakt wat elke wisser DOET.

   Draai los: node --test test/vergeten-positie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const S = path.join(__dirname, '..', 'server', 'kern');
const WILMA = 'user-901', BRAM = 'user-902';
const WCN = 'Wilma Wegduiker', BCN = 'Bram Bewaard';
// herkenbare coordinaten: elke plek van Wilma ligt op 52.111/4.111, van Bram op 51.222/5.222
const W = { lat: 52.111, lng: 4.111 }, B = { lat: 51.222, lng: 5.222 };
const nu = () => new Date().toISOString();

function zaai() {
  const data = {
    mobOpdrachten: [
      { ref: 'R1', reiziger: WILMA, reizigerCodenaam: WCN, betaler: { soort: 'reiziger', key: WILMA }, notitie: 'bel aan bij Wilma',
        van: { ...W, label: 'Thuis' }, naar: { lat: 52.3, lng: 4.9, label: 'Station' }, positie: { ...W, at: nu() },
        status: 'onderweg', km: 4, prijs: 12, gebeurtenissen: [{ soort: 'trip.location_updated', ...W, at: nu() }] },
      { ref: 'R2', reiziger: BRAM, reizigerCodenaam: BCN, betaler: { soort: 'reiziger', key: BRAM },
        van: { ...B, label: 'Kantoor' }, naar: { lat: 51.3, lng: 5.3, label: 'Hotel' }, status: 'aangevraagd', gebeurtenissen: [] }
    ],
    mobReizen: [{ id: 'rs1', key: WILMA, codenaam: WCN, van: { ...W }, etappes: [] }, { id: 'rs2', key: BRAM, codenaam: BCN, van: { ...B }, etappes: [] }],
    mobFavorieten: { [WILMA]: [{ id: 'f1', naam: 'Huis', ...W }], [BRAM]: [{ id: 'f2', naam: 'Werk', ...B }] },
    veilig: {
      plek: { [WILMA]: { lat: W.lat, lon: W.lng, at: nu() }, [BRAM]: { lat: B.lat, lon: B.lng, at: nu() } },
      vensters: { [WILMA]: { tot: Date.now() + 60000, spoor: [{ lat: W.lat, lon: W.lng }] } },
      kring: { [WILMA]: { contacten: [{ handle: BRAM }], mails: [] }, [BRAM]: { contacten: [{ handle: WILMA }], mails: [] } },
      rust: { [WILMA]: { aan: true } }, codewoord: { [WILMA]: { hash: 'x' } },
      wachten: [{ id: 'w1', handle: WILMA, codenaam: WCN, status: 'loopt' }, { id: 'w2', handle: BRAM, codenaam: BCN, status: 'loopt' }],
      momenten: [{ id: 'm1', handle: WILMA, ontvangers: [] }, { id: 'm2', handle: BRAM, ontvangers: [{ soort: 'contact', id: WILMA }] }],
      alarmen: [{ id: 'a1', handle: WILMA, vanCodenaam: WCN, notitie: 'help', naar: [BRAM], afgesloten: false, plek: { lat: W.lat, lon: W.lng } },
        { id: 'a2', handle: BRAM, vanCodenaam: BCN, naar: [WILMA], afgesloten: true, plek: { lat: B.lat, lon: B.lng } }]
    },
    ontmoetVoorkeur: {}, ontmoetPosities: {},
    ontmoetVoorstellen: [{ id: 'v1', a: WILMA, b: BRAM, keuzes: { [WILMA]: 'koffie' }, status: 'open' }],
    ontmoetDates: [{ id: 'd1', a: WILMA, b: BRAM, status: 'noodgeval', contract: { ondertekend: { [WILMA]: nu(), [BRAM]: nu() } },
      posities: { [WILMA]: { ...W, at: nu() }, [BRAM]: { ...B, at: nu() } },
      sos: [{ id: 's1', door: WILMA, codenaam: WCN, ...W, ok: null }, { id: 's2', door: BRAM, codenaam: BCN, ...B, ok: null }] }],
    flitsMeldingen: [{ id: 'fl1', soort: 'file', ...W, door: WCN, stemmers: [BRAM], at: nu() },
      { id: 'fl2', soort: 'file', ...B, door: BCN, stemmers: [WILMA], at: nu() }],
    plaatsVensters: [{ id: 'pv1', codenaam: WCN, doel: 'zaak', sluit: new Date(Date.now() + 60000).toISOString() },
      { id: 'pv2', codenaam: BCN, doel: 'zaak', sluit: new Date(Date.now() + 60000).toISOString() }],
    plaatsWaarnemingen: [{ id: 'pw1', codenaam: WCN, venster: 'pv1', hek: 'h1' }, { id: 'pw2', codenaam: BCN, venster: 'pv2', hek: 'h1' }],
    plaatsLog: [{ id: 'pl1', codenaam: WCN, wat: 'waargenomen', hek: 'h1' }, { id: 'pl2', codenaam: BCN, wat: 'waargenomen', hek: 'h1' }],
    gemeenteMeldingen: [{ ref: 'M1', melderKey: WILMA, melder: WCN, ...W, status: 'nieuw' }, { ref: 'M2', melderKey: BRAM, melder: BCN, ...B, status: 'nieuw' }],
    weefselZaken: [{ id: 'Z1', ...W, status: 'open', waarnemingen: [{ id: 'W1', melder: WCN }, { id: 'W2', melder: BCN }] }],
    horeca: { ZAAK1: { rekeningen: {
      r1: { id: 'r1', gastId: WCN, status: 'gesloten', bezorg: { adres: 'Wilmastraat 1', postcode: '1000AA', ...W } },
      r2: { id: 'r2', gastId: BCN, status: 'open', bezorg: { adres: 'Bramweg 2', postcode: '2000BB', ...B } } }, instel: {}, wachtrij: [] } },
    modeBezorg: [{ ref: 'MB1', key: WILMA, codenaam: WCN, status: 'afgeleverd', adres: 'Wilmastraat 1', loc: { ...W }, gps: { ...W } },
      { ref: 'MB2', key: BRAM, codenaam: BCN, status: 'onderweg', adres: 'Bramweg 2', loc: { ...B }, gps: { ...B } }]
  };
  const orders = [{ ref: 'O1', customerKey: WILMA, adres: 'Wilmastraat 1', geo: { ...W } }, { ref: 'O2', customerKey: BRAM, geo: { ...B } }];
  return { db: { data }, orders };
}

/* De kern zoals de vergeetroute hem krijgt, maar dan met alleen de domeinen die
   de positietabel bevraagt -- elk met zijn ECHTE module. */
function kernVoor(db, orders) {
  const save = () => {};
  const { maakModebezorg } = require(path.join(S, 'modebezorg'));
  // de bezorgcode wil een collectietransactie; de vergeetstap raakt die niet
  const mode = maakModebezorg({ db, save, crypto, bewerkCollectie: () => { throw new Error('niet in deze toets'); },
    dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'vergeten-positie-')) });
  const H = { zaken: () => db.data.weefselZaken, zaak: () => null, open: z => z.status === 'open', schoon: String, CATS: {}, STATUS: [], PRIOS: [] };
  const ontmoetLijsten = () => {};
  return {
    db, save, crypto,
    ...require(path.join(S, 'mobiliteit', 'vergeten'))({ opslag: require(path.join(S, 'mobiliteit', 'opslag'))({ db }), save, nu }),
    ...require(path.join(S, 'veiligheid', 'vergeten'))({ opslag: require(path.join(S, 'veiligheid', 'opslag'))({ db }), save }),
    ...require(path.join(S, 'ontmoeting', 'vergeten'))({ dateLijst: () => db.data.ontmoetDates,
      voorstelLijst: () => db.data.ontmoetVoorstellen, save, lijsten: ontmoetLijsten, nu }),
    flitsVergeet: require(path.join(S, 'flits')).maakFlits({ db, save, crypto }).flitsVergeet,
    plaats: { plaatsVergeet: require(path.join(S, 'plaats', 'opslag'))({ db, save, crypto }).vergeet },
    gemeente: { vergeetMelder: require(path.join(S, 'gemeente', 'meldingen'))({ db, save, nu }).vergeetMelder },
    weefsel: { weefselVergeetMelder: require(path.join(S, 'stadsweefsel', 'zaakbeeld'))({ save, nu }, H).vergeetMelder },
    ordersVanKlant: key => orders.filter(o => o.customerKey === key),
    mbVergeet: mode.mbVergeet
  };
}

const tekst = v => JSON.stringify(v);
const heeftPunt = (v, p) => tekst(v).includes(String(p.lat)) || tekst(v).includes(String(p.lng));

test('na de positiewisser staat er geen plek, sleutel of codenaam van Wilma meer -- en alles van Bram nog wel', () => {
  const { db, orders } = zaai();
  const kern = kernVoor(db, orders);
  require(path.join(S, 'vergeten', 'positie'))(kern).wisPosities(WILMA, WCN);

  /* Bij een melding openbare ruimte is de plek die van het PROBLEEM en blijft
     hij (NAVIGATIE.md N21); daar moet de weg naar Wilma weg zijn, niet de plek. */
  const PLEK_VAN_HET_PROBLEEM = ['gemeenteMeldingen', 'weefselZaken'];
  const { POSITIE_TAKKEN } = require(path.join(S, 'vergeten', 'positie'));
  for (const [tak] of POSITIE_TAKKEN) {
    const v = tak === 'orders' ? orders : db.data[tak];
    assert.ok(v !== undefined, tak + ': de toets zaaide hier niets en bewijst dus niets');
    if (!PLEK_VAN_HET_PROBLEEM.includes(tak))
      assert.equal(heeftPunt(v, W), false, tak + ': er staat nog een coordinaat van Wilma in ' + tekst(v).slice(0, 300));
    /* Twee uitzonderingen, en dit is een POSITIEwisser: hij haalt de plek weg,
       niet de administratie. Een bestelling houdt haar klantsleutel (de index
       van de transactielaag) en een horecarekening de codenaam van de gast,
       zoals het grootboek van RTG Pay (test/vergeten.test.js, AUDITTAK). Dat
       die twee nog een persoon dragen staat als open punt in positie.js. */
    if (tak !== 'orders') assert.equal(tekst(v).includes(WILMA), false, tak + ': haar sleutel staat er nog in');
    if (tak !== 'orders' && tak !== 'horeca')
      assert.equal(tekst(v).includes(WCN), false, tak + ': haar codenaam staat er nog in');
  }
  // en Bram: elke plek van hem is er nog
  for (const tak of ['mobOpdrachten', 'mobReizen', 'mobFavorieten', 'veilig', 'ontmoetDates', 'flitsMeldingen',
    'plaatsLog', 'plaatsWaarnemingen', 'gemeenteMeldingen', 'horeca', 'modeBezorg'])
    assert.ok(heeftPunt(db.data[tak], B) || tekst(db.data[tak]).includes(BCN) || tekst(db.data[tak]).includes(BRAM),
      tak + ': van Bram is ook iets verdwenen');
  assert.ok(heeftPunt(orders, B), 'de bestelling van Bram houdt zijn punt');
});

test('een gedeeld dossier blijft staan, alleen zonder Wilma', () => {
  const { db, orders } = zaai();
  require(path.join(S, 'vergeten', 'positie'))(kernVoor(db, orders)).wisPosities(WILMA, WCN);
  const rit = db.data.mobOpdrachten.find(o => o.ref === 'R1');
  assert.ok(rit, 'de rit is de administratie van de vervoerder en blijft');
  assert.equal(rit.van.label, 'Thuis', 'het label op de factuur blijft');
  assert.equal(rit.reiziger, null);
  const date = db.data.ontmoetDates[0];
  assert.equal(date.b, BRAM, 'Bram blijft deelnemer');
  assert.ok(date.posities[BRAM], 'en zijn eigen positie bij zijn open SOS blijft (N18)');
  assert.equal(date.sos.find(s => s.id === 's1').codenaam, '(verwijderd)', 'haar SOS blijft voor het kantoor, zonder naam');
  const alarm = db.data.veilig.alarmen.find(a => a.id === 'a1');
  assert.ok(alarm && alarm.afgesloten, 'haar open alarm sluit; er is niemand meer om naar te kijken');
  assert.deepEqual(db.data.veilig.kring[BRAM].contacten, [], 'en ze staat niet meer in de kring van Bram');
  const melding = db.data.gemeenteMeldingen.find(m => m.ref === 'M1');
  assert.equal(melding.lat, W.lat, 'de plek blijft bij het probleem (N21)');
  assert.ok(melding.melderLos && !('melderKey' in melding) && !('melder' in melding), 'maar de melder is eraf');
  assert.equal(db.data.horeca.ZAAK1.rekeningen.r1.bezorg.adres, null, 'een gesloten rekening houdt haar adres niet');
  assert.equal(db.data.horeca.ZAAK1.rekeningen.r2.bezorg.adres, 'Bramweg 2');
});

test('MUTATIE: een wisser die ontbreekt, faalt hardop in plaats van de plek te laten staan', () => {
  const { db, orders } = zaai();
  const kern = kernVoor(db, orders);
  delete kern.veiligVergeet;
  assert.throws(() => require(path.join(S, 'vergeten', 'positie'))(kern).wisPosities(WILMA, WCN), /veiligVergeet ontbreekt/);
});

test('de meter leest de tabel, en een rij zonder wisser telt niet', () => {
  const P = require('../scripts/positiestroom');
  const b = P.termijnBronnen();
  for (const t of ['mobOpdrachten', 'mobReizen', 'mobFavorieten', 'veilig', 'ontmoetDates', 'flitsMeldingen',
    'plaatsLog', 'plaatsWaarnemingen', 'gemeenteMeldingen', 'weefselZaken', 'horeca', 'orders', 'modeBezorg'])
    assert.ok(b.vergeten.has(t), t + ': de vergeetroute wist hem, maar de meter ziet het niet');
  /* De vorm van de herkenning, nagespeeld op een kopie: een rij waarvan de
     wisser niet bestaat, mag de meter niet als vergeten tellen. */
  const bron = fs.readFileSync(path.join(S, 'vergeten', 'positie.js'), 'utf8');
  const kapot = bron.replace("['veilig', 'wisVeilig']", "['veilig', 'wisBestaatNiet']");
  assert.notEqual(kapot, bron, 'de rij voor veilig staat niet meer in deze vorm in positie.js');
  const tabel = /POSITIE_TAKKEN\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/.exec(kapot);
  const telt = [...tabel[1].matchAll(/\[\s*'(\w+)'\s*,\s*'(\w+)'\s*\]/g)]
    .filter(m => new RegExp('\\b' + m[2] + '\\s*:\\s*\\(').test(kapot)).map(m => m[1]);
  assert.equal(telt.includes('veilig'), false);
});
