/* DE PLAATSLAAG (kern/plaats/, zie PLAATS.md).

   Deze toets bewaakt de belofte die de hele laag draagt: RTG weet wát je nodig
   hebt zonder te weten wáár je bent geweest. Dat is geen houding maar een
   verzameling controleerbare eigenschappen, en die staan hieronder één voor één:

     - een waarneming bestaat alleen binnen een venster, en een venster heeft
       altijd een einde en altijd een reden;
     - de waarneemroute WEIGERT een coördinaat (niet: gooit hem stil weg);
     - sluiten wist, en verlopen wist -- er blijft geen spoor liggen;
     - wat een domein terugkrijgt is binnen/buiten met een tijd, nooit een plek;
     - en de motor op het toestel houdt zijn hysterese, want een hek zonder
       hysterese wisselt op de rand tientallen keren per minuut.

   De laatste twee toetsen draaien de CLIENT-code (public/shared/plaats.js) in
   een nagemaakte window. Dat is met opzet: de rekenregel die bepaalt of jij in
   een hek staat, draait bij een lid in de browser, en een regel die alleen op de
   server getoetst is, is op de plek waar hij echt draait ongetoetst.

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* Een weefsel met één vierkante zone, en een navPoi met één zaak. Nagemaakt en
   niet echt: deze toets gaat over de plaatslaag, en een echte gebiedenboom zou
   hem laten zakken zodra iemand daar een zone hernoemt. */
const WEEFSEL = { weefselGebieden: () => ({ status: 200, gebieden: [
  { id: 'Z1', naam: 'Proefzone', geometrie: { soort: 'vlak', punten: [
    { lat: 38.90, lng: 1.42 }, { lat: 38.90, lng: 1.44 },
    { lat: 38.92, lng: 1.44 }, { lat: 38.92, lng: 1.42 }] } }] }) };
const NAVPOI = (lagen) => ({ status: 200, lagen: Object.fromEntries(lagen.map(l =>
  [l, l === 'leverancier' ? [{ naam: 'Proefzaak', lat: 38.91, lng: 1.43 }] : []])) });

/* maak() geeft ook de rauwe db terug. Dat is nodig en niet luxe: "sluiten wist"
   controleren via plaatsStand() bewijst niets, want die roept zelf ruim() aan en
   ziet daardoor altijd een schone stand -- ook als er fysiek nog rijen staan. Een
   mutatieproef liet dat zien: de wisregel weghalen deed geen enkele toets zakken.
   Wie een belofte over WISSEN toetst, moet in de la kijken en niet door het raam. */
function maak() {
  const db = { data: {} };
  const plaats = require('../server/kern/plaats')({ db, save: () => {}, crypto,
    weefsel: WEEFSEL, navPoi: NAVPOI }).plaats;
  return Object.assign(plaats, { _db: db });
}
const IK = 'Proef Kraanvogel 0001';

test('hekken zijn plaatsen, geen personen -- en ze dragen hun doel', () => {
  const p = maak();
  const stad = p.plaatsHekken('stad');
  assert.equal(stad.status, 200);
  assert.equal(stad.hekken.length, 1, 'de zone uit het weefsel is een hek');
  assert.equal(stad.hekken[0].id, 'zone:Z1');
  assert.equal(stad.hekken[0].doel, 'stad');
  /* De hele lijst mag naar het toestel, dus er hoort geen enkel spoor van een
     mens in te staan. Deze controle is de reden dat de motor daar kan draaien. */
  const tekst = JSON.stringify(stad);
  for (const veld of ['codenaam', 'key', 'lid', 'member']) {
    assert.ok(!tekst.includes(veld), 'een hek draagt geen ' + veld);
  }
  assert.equal(p.plaatsHekken('nadering').hekken.length, 1, 'nadering pakt de zaak uit de navigatiekern');
  assert.equal(p.plaatsHekken('nadering').straalM, 900, 'nadering is ruim');
  assert.equal(p.plaatsHekken('verzonnen').status, 400, 'het doel is een gesloten lijst');
});

test('aanwezigheid op je werk gaat over JOUW werkgevers, en niemand anders', () => {
  const p = maak();
  /* Hier stond `lagen: ['leverancier']` op het doel dienst, waardoor het toestel
     van elk lid elke zaak van het eiland als hek kreeg. Onschuldig (openbare
     plaatsen) maar verkeerd: aanwezigheid op je werk gaat over jouw werkgevers.
     Zonder bron is de lijst dus leeg -- en dat is het juiste antwoord voor
     iemand die hier niet werkt. */
  assert.equal(p.plaatsHekken('dienst').hekken.length, 0,
    'zonder bron heeft niemand een werkhek');
  assert.equal(p.plaatsHekken('dienst').straalM, 120, 'werk is strak');

  // een domein levert zijn eigen plaatsen, en filtert zelf per lid
  const gezien = [];
  p.plaatsBron('proefwerk', 'dienst', (codenaam) => {
    gezien.push(codenaam);
    return codenaam === IK ? [{ id: 'leverancier:ZAAK1', naam: 'Zaak Een',
      soort: 'punt', punten: [{ lat: 38.91, lng: 1.43 }] }] : [];
  });
  const mijn = p.plaatsHekken('dienst', IK);
  assert.equal(mijn.hekken.length, 1, 'mijn werkplek staat erin');
  assert.equal(mijn.hekken[0].id, 'leverancier:ZAAK1');
  assert.equal(mijn.hekken[0].bron, 'proefwerk', 'het hek noemt zijn bron');
  assert.equal(mijn.hekken[0].straalM, 120, 'zonder eigen straal geldt die van het doel');
  assert.equal(gezien[gezien.length - 1], IK, 'de bron krijgt de codenaam en filtert zelf');

  /* EEN ANDER LID KRIJGT HEM NIET. Dit is de hele reden dat een bron de codenaam
     krijgt: de hekkenlijst gaat naar het TOESTEL, dus een bron die niet filtert
     lekt andermans plaatsen aan iedereen die de route aanroept. */
  assert.equal(p.plaatsHekken('dienst', 'Iemand Anders 9999').hekken.length, 0,
    'een ander lid krijgt mijn werkplek niet te zien');

  // een bron die stukloopt neemt de rest niet mee
  p.plaatsBron('kapot', 'dienst', () => { throw new Error('stuk'); });
  assert.equal(p.plaatsHekken('dienst', IK).hekken.length, 1,
    'een kapotte bron mag de goede niet meenemen');
});

test('een venster heeft altijd een reden en altijd een einde', () => {
  const p = maak();
  assert.equal(p.plaatsVensterOpen(IK, { doel: 'stad', minuten: 60 }).status, 400,
    'zonder reden gaat er geen venster open');
  assert.equal(p.plaatsVensterOpen(IK, { doel: 'onzin', bron: 'toets' }).status, 400);
  const r = p.plaatsVensterOpen(IK, { doel: 'stad', bron: 'toets', minuten: 60 });
  assert.equal(r.status, 200);
  assert.ok(new Date(r.venster.sluit).getTime() > Date.now(), 'het einde ligt in de toekomst');
  /* Een venster van een week is geen venster. De grens ligt op een dienst; wie
     meer vraagt krijgt het maximum en niet wat hij vroeg. */
  const lang = p.plaatsVensterOpen(IK, { doel: 'rit', bron: 'toets', minuten: 60 * 24 * 7 });
  const uren = (new Date(lang.venster.sluit) - Date.now()) / 3600000;
  assert.ok(uren <= 12.1, 'een venster wordt gekapt op ten hoogste twaalf uur, kreeg ' + uren);
});

test('twee vensters voor hetzelfde doel worden er een', () => {
  const p = maak();
  p.plaatsVensterOpen(IK, { doel: 'stad', bron: 'eerste', minuten: 30 });
  const tweede = p.plaatsVensterOpen(IK, { doel: 'stad', bron: 'tweede', minuten: 60 });
  assert.equal(tweede.verlengd, true, 'het bestaande venster wordt verlengd');
  assert.equal(p.plaatsStand(IK).vensters.length, 1,
    'twee einddatums voor hetzelfde doel betekent dat er een liegt');
});

test('een waarneming bestaat alleen binnen een venster', () => {
  const p = maak();
  const zonder = p.plaatsWaarneem(IK, { doel: 'stad', hek: 'zone:Z1', wat: 'binnen' });
  assert.equal(zonder.status, 403, 'buiten een venster wordt er niets waargenomen');
  p.plaatsVensterOpen(IK, { doel: 'stad', bron: 'toets' });
  assert.equal(p.plaatsWaarneem(IK, { doel: 'stad', hek: 'zone:verzonnen', wat: 'binnen' }).status, 400,
    'een hek dat niemand kent levert geen geschiedenis op');
  assert.equal(p.plaatsWaarneem(IK, { doel: 'stad', hek: 'zone:Z1', wat: 'misschien' }).status, 400);
  const goed = p.plaatsWaarneem(IK, { doel: 'stad', hek: 'zone:Z1', wat: 'binnen' });
  assert.equal(goed.status, 200);
  assert.equal(goed.nieuw, true);
  // dezelfde overgang nog eens is geen tweede feit (de rand van een hek trilt)
  assert.equal(p.plaatsWaarneem(IK, { doel: 'stad', hek: 'zone:Z1', wat: 'binnen' }).nieuw, false);
});

test('de waarneemroute WEIGERT een coordinaat', () => {
  const p = maak();
  p.plaatsVensterOpen(IK, { doel: 'stad', bron: 'toets' });
  /* Dit is de kernbelofte van PLAATS.md par. 1, en daarom een weigering en geen
     stille opschoning: een veld dat je negeert, staat er over een half jaar weer
     in omdat iemand dacht dat het meeging. */
  for (const veld of ['lat', 'lng', 'lon', 'coords', 'positie', 'nauwkeurig']) {
    const body = { doel: 'stad', hek: 'zone:Z1', wat: 'binnen' };
    body[veld] = veld === 'coords' || veld === 'positie' ? { lat: 38.9, lng: 1.43 } : 38.9;
    const r = p.plaatsWaarneem(IK, body);
    assert.equal(r.status, 400, 'een verzoek met ' + veld + ' hoort geweigerd te worden');
    assert.match(r.error, /geen positie aan/);
  }
  assert.equal(p.plaatsStand(IK).waarnemingen.length, 0, 'en er is niets van bewaard');
});

test('sluiten wist, en verlopen wist -- er blijft geen spoor liggen', () => {
  const p = maak();
  p.plaatsVensterOpen(IK, { doel: 'stad', bron: 'toets' });
  p.plaatsWaarneem(IK, { doel: 'stad', hek: 'zone:Z1', wat: 'binnen' });
  assert.equal(p.plaatsStand(IK).waarnemingen.length, 1);
  p.plaatsVensterSluit(IK, 'stad');
  /* In de la kijken, niet door het raam: plaatsStand() ruimt zelf op en zou dus
     ook een schone stand tonen als er nog rijen stonden. */
  assert.equal(p._db.data.plaatsWaarnemingen.length, 0,
    'na het sluiten staat er fysiek geen waarneming meer in de opslag');
  assert.equal(p._db.data.plaatsVensters.length, 0, 'en ook geen venster');
  const na = p.plaatsStand(IK);
  assert.equal(na.vensters.length, 0);
  assert.equal(na.waarnemingen.length, 0, 'een gesloten venster laat geen waarnemingen achter');
  /* Het actielog blijft wel: dat is de tegenhanger van de laag, en een lid moet
     kunnen navragen waarom zijn toestel iets heeft gemeld. */
  assert.ok(na.log.length >= 3, 'het actielog bewaart wat er is gebeurd');
  assert.ok(na.log.some(r => r.wat === 'waargenomen'),
    'de handeling in het log heet naar wat er gebeurde, niet naar de richting');
});

test('een verlopen venster neemt zijn waarnemingen mee', () => {
  const p = maak();
  const r = p.plaatsVensterOpen(IK, { doel: 'stad', bron: 'toets', minuten: 1 });
  p.plaatsWaarneem(IK, { doel: 'stad', hek: 'zone:Z1', wat: 'binnen' });
  // de klok een uur vooruit zetten door het venster zelf te verzetten
  r.venster.sluit = new Date(Date.now() - 1000).toISOString();
  const na = p.plaatsStand(IK);
  assert.equal(na.vensters.length, 0, 'een verlopen venster telt niet meer mee');
  assert.equal(na.waarnemingen.length, 0, 'en zijn waarnemingen zijn weg');
});

test('een domein krijgt binnen of buiten met een tijd, en nooit een plek', () => {
  const p = maak();
  p.plaatsBron('proefwerk', 'dienst', () => [{ id: 'leverancier:Proefzaak',
    naam: 'Proefzaak', soort: 'punt', punten: [{ lat: 38.91, lng: 1.43 }] }]);
  p.plaatsVensterOpen(IK, { doel: 'dienst', bron: 'dienstrooster' });
  const onbekend = p.plaatsAanwezig(IK, 'dienst', 'leverancier:Proefzaak');
  assert.equal(onbekend.bekend, false, 'zonder waarneming weten we het niet, en zeggen dat');
  p.plaatsWaarneem(IK, { doel: 'dienst', hek: 'leverancier:Proefzaak', wat: 'binnen' });
  const a = p.plaatsAanwezig(IK, 'dienst', 'leverancier:Proefzaak');
  assert.equal(a.binnen, true);
  assert.ok(a.sinds, 'met een tijd erbij');
  /* Grens 4 uit PLAATS.md: de werkgever krijgt aanwezigheid, geen locatie. Ook
     niet "hoe ver erbuiten" -- dat is een coordinaat met een omweg. */
  assert.deepEqual(Object.keys(a).sort(), ['bekend', 'binnen', 'sinds']);
});

/* ---------------------------------------------------------------------------
   DE MOTOR OP HET TOESTEL (public/shared/plaats.js), in een nagemaakte window.
   --------------------------------------------------------------------------- */
function laadMotor() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'plaats.js'), 'utf8');
  const window = { addEventListener() {} };
  const ctx = { window, fetch: () => Promise.resolve({ json: () => Promise.resolve({}) }),
    localStorage: { getItem: () => null }, console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return window.RTGPlaats;
}

test('de hek-motor houdt hysterese: eruit ga je later dan erin', () => {
  const M = laadMotor();
  const hek = { soort: 'punt', punten: [{ lat: 38.91, lng: 1.43 }], straalM: 100 };
  const bij = (m) => ({ lat: 38.91 + m / 111320, lng: 1.43 });
  assert.equal(M._staatIn(bij(50), hek, false), true, 'binnen de straal ga je naar binnen');
  assert.equal(M._staatIn(bij(130), hek, false), false, 'buiten de straal kom je er niet in');
  /* En de hysterese zelf: sta je er al in, dan blijf je erin tot straal + marge.
     Zonder deze regel wisselt een toestel op de rand tientallen keren per minuut
     tussen binnen en buiten, en gaan een accu, een dienstrooster en het
     vertrouwen in het systeem eraan kapot. */
  assert.equal(M._staatIn(bij(130), hek, true), true, 'net erbuiten blijf je binnen (marge)');
  assert.equal(M._staatIn(bij(200), hek, true), false, 'ver erbuiten ben je eruit');
  assert.ok(M.MARGE_M > 0, 'een marge van nul is geen hysterese');
});

test('de hek-motor rekent een vlak hetzelfde als de server', () => {
  const M = laadMotor();
  const vlak = { soort: 'vlak', straalM: 0, punten: [
    { lat: 38.90, lng: 1.42 }, { lat: 38.90, lng: 1.44 },
    { lat: 38.92, lng: 1.44 }, { lat: 38.92, lng: 1.42 }] };
  assert.equal(M._inVlak({ lat: 38.91, lng: 1.43 }, vlak.punten), true, 'midden in de zone');
  assert.equal(M._inVlak({ lat: 38.95, lng: 1.43 }, vlak.punten), false, 'ruim erbuiten');
  /* Dezelfde even-odd-regel als server/kern/stadsweefsel/meetkunde.js. Een vlak
     dat op het toestel anders uitpakt dan op de server levert twee waarheden
     over dezelfde zone op, en dan meldt een bewoner iets in een zone die de
     veldploeg niet kent -- precies wat geografie.js beschrijft. */
  const meetkunde = require('../server/kern/stadsweefsel/meetkunde')({ REF: { lat: 38.91, lng: 1.43 } });
  for (const p of [{ lat: 38.91, lng: 1.43 }, { lat: 38.95, lng: 1.43 },
                   { lat: 38.90, lng: 1.43 }, { lat: 38.919, lng: 1.439 }]) {
    assert.equal(M._inVlak(p, vlak.punten), meetkunde.inVlak(p, vlak.punten),
      'toestel en server zijn het oneens over ' + JSON.stringify(p));
  }
});

/* ---------------------------------------------------------------------------
   EN DE COORDINAAT DIE WEGGING, IN DE LA GECONTROLEERD.

   Bij fase 2a verdween `d.lat = Number(lat)` uit het inklokken van een bewaker:
   de rauwe positie werd op zijn dienst bewaard en NIEMAND las hem ooit. Een
   mutatieproef zette hem terug -- en geen enkele schermtoets zakte, want
   dienstPubliek() gaf hem toch al niet terug. Dat is dezelfde fout als eerder in
   deze suite: door het raam kijken in plaats van in de la. Een belofte over wat
   er NIET wordt bewaard, controleer je in de opslag zelf.

   Vandaar deze unit-toets op de kern, met een nagemaakte database: hij ziet de
   dienstregel zoals hij werkelijk wordt weggeschreven.
   --------------------------------------------------------------------------- */
test('een bewaker die inklokt laat geen coordinaat achter op zijn dienst', () => {
  const zaak = { code: 'PROEF', name: 'Proefteam', type: 'beveiliging',
    beveiliging: { posten: [{ id: 'p1', naam: 'Object', lat: 38.91, lng: 1.43, minMan: 1 }] } };
  const db = { data: { bevDiensten: [], suppliers: [zaak] } };
  const bev = require('../server/kern/beveiliging').maakBeveiliging({
    db, save: () => {}, crypto,
    accounts: { listStaff: () => [{ id: 7, name: 'Bewaker Zeven', role: 'staff' }],
      publicStaff: (x) => ({ id: x.id, name: x.name, role: x.role }) },
    findSupplier: (c) => (c === 'PROEF' ? zaak : null),
    notify: () => {}, notifySupplier: () => {}, sseToSupplier: () => {}, sseToOffice: () => {},
    logActivity: () => {}, haversine: () => 0
  });
  const dag = new Date().toISOString().slice(0, 10);
  const zet = bev.bevZetDienst(zaak, { postId: 'p1', shiftId: 'nacht', datum: dag, guardId: 7 });
  assert.ok(zet.dienst && zet.dienst.id, 'de dienst staat gepland: ' + JSON.stringify(zet));

  // klok in MET een coordinaat erbij, zoals een oude client hem nog zou sturen
  const r = bev.bevInklok('PROEF', 7, zet.dienst.id, 38.9115, 1.4412);
  assert.equal(r.status, 200, 'de bewaker klokt gewoon in');

  const rauw = db.data.bevDiensten.find(d => d.id === zet.dienst.id);
  assert.ok(rauw, 'de dienstregel staat in de opslag');
  assert.equal(rauw.status, 'ingeklokt');
  /* IN DE LA: geen breedtegraad, geen lengtegraad. Niet "wordt niet getoond" --
     niet bewaard (PLAATS.md grens 2: geen plaats zonder doel). */
  assert.equal(rauw.lat, undefined, 'er staat geen breedtegraad op de dienst');
  assert.equal(rauw.lng, undefined, 'en geen lengtegraad');
  const tekst = JSON.stringify(rauw);
  assert.ok(!tekst.includes('"lat"') && !tekst.includes('"lng"'),
    'de opgeslagen dienstregel draagt geen coordinaat: ' + tekst);
});
