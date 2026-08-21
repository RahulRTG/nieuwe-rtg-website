/* ============================================================================
   HET NUMMER WOONT IN DE KLUIS -- gemeten aan de OPSLAG, niet aan de uitgang.

   WAAROM DIT EEN EIGEN BESTAND IS. test/vakbewijs-routes.test.js bewaakt wat er
   over de lijn gaat: de stapel van het kantoor draagt geen nummer, de werkgever
   ziet ja of nee. Dat is de expositie, en die was al dichtgezet met een
   expliciet opgebouwde rij plus een toon() die het veld eruit haalt.

   Maar de vraag die de kluis stelt is een andere: WAAR STAAT HET DING. Een
   BIG-registratie staat in een openbaar register, dus een nummer naast een
   codenaam in de operationele data voert die codenaam terug naar een echte
   naam -- ook als geen enkele route hem toont, want een datalek vraagt geen
   route. Twee lagen bescherming die je niet uit elkaar houdt, worden er
   uiteindelijk een.

   Dat verschil is hier gemeten en niet aangenomen: de mutatie die het nummer
   NAAST de kluis ook in de rij laat staan, liet alle negen routetoetsen groen
   (zie het slot van dit bestand). Precies daarom bestaat dit bestand.

   Puur, dus zonder server: de store krijgt een nagemaakte accounts-laag mee die
   doet wat member_state doet -- opslaan per lid.
   Draai los: node --test test/vakbewijs-kluis.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vakbewijsMod = require('../server/kern/vakbewijs');

/* Een nagemaakt ledendossier. In het echt gaat dit versleuteld en gebonden aan
   de rij de kolom in (server/accounts/gebonden.js); voor deze toets telt alleen
   DAT het een andere plek is dan db.data. */
function bouw() {
  const db = { data: {} };
  const dossiers = new Map();
  const accounts = {
    getMemberState: (id) => dossiers.get(Number(id)) || null,
    saveMemberState: (id, obj) => { dossiers.set(Number(id), JSON.parse(JSON.stringify(obj))); }
  };
  const store = vakbewijsMod({ db, save() {}, accounts,
    schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200),
    tijdVandaag: () => '2026-08-17' });
  return { db, store, dossiers, sleutel: (lid) => store.sleutelLid(lid) };
}

test('1. het nummer staat in het dossier en NIET in de operationele rij', () => {
  const K = bouw();
  const s = K.sleutel(7);
  K.store.vakbewijsZet(s, { wat: 'big', nummer: '99012345678', tot: '2030-01-01' });

  const rij = K.db.data.vakbewijzen.find(v => v.sleutel === s && v.wat === 'big');
  assert.ok(rij, 'de rij bestaat');
  assert.equal(rij.nummer, undefined, 'de operationele rij draagt geen nummer meer');
  assert.equal(JSON.stringify(K.db.data).includes('99012345678'), false,
    'en het nummer staat nergens anders in de operationele data');

  assert.equal((K.dossiers.get(7) || {}).vakbewijsNummers.big, '99012345678',
    'het staat in het ledendossier, waar de naam en het e-mailadres ook liggen');
  assert.equal(K.store.vakbewijsNummer(s, 'big'), '99012345678',
    'en is met de sleutel gewoon op te halen door wie er recht op heeft');
});

test('2. de leesbare vorm van een rij draagt het nummer nooit', () => {
  const K = bouw();
  const s = K.sleutel(8);
  const r = K.store.vakbewijsZet(s, { wat: 'vog', nummer: 'VOG-1', tot: '2030-01-01' });
  assert.equal(r.vakbewijs.nummer, undefined, 'ook niet in het antwoord op het zetten');
  assert.equal(K.store.vakbewijzenVan(s)[0].nummer, undefined);
  /* De tweede laag, en die is expres dubbel: zou het nummer ooit toch in een rij
     belanden (een oude database, een concernrij), dan haalt toon() hem er nog
     steeds uit voordat een lijst hem kan tonen. */
  K.db.data.vakbewijzen[0].nummer = 'ER-TOCH-IN';
  assert.equal(K.store.vakbewijzenVan(s)[0].nummer, undefined,
    'toon() haalt hem eruit, ook als hij er op schijf staat');
});

test('3. een wijziging wist de aftekening, ook nu het nummer elders ligt', () => {
  /* Deze regel hing eerst op een vergelijking BINNEN de rij. Sinds het nummer in
     het dossier ligt moet hij daar worden opgehaald -- en als dat misgaat, ziet
     `anders` een wijziging over het hoofd en blijft een aftekening staan op een
     stuk dat niemand heeft gezien. Dat is de duurste stille fout van deze hele
     verhuizing, dus hij staat hier apart. */
  const K = bouw();
  const s = K.sleutel(9);
  K.store.vakbewijsZet(s, { wat: 'big', nummer: 'AAA', tot: '2030-01-01' });
  K.store.vakbewijsTeken(s, 'big', 'M. de Vries (RTG)');
  assert.equal(K.store.vakbewijsHeeft(s, 'big', { aftekening: true }).ok, true);

  K.store.vakbewijsZet(s, { wat: 'big', nummer: 'BBB', tot: '2030-01-01' });
  const na = K.store.vakbewijsHeeft(s, 'big', { aftekening: true });
  assert.equal(na.ok, false, 'een ander nummer is een ander stuk, en dat is niet gezien');
  assert.equal(na.reden, 'niet-gezien');
  assert.equal(K.store.vakbewijsNummer(s, 'big'), 'BBB', 'en het dossier draagt het nieuwe nummer');
});

test('4. zonder kluis valt hij terug op de rij, en dat is dan de ENIGE plek', () => {
  /* Een opzet zonder accounts (een toets, een deelproces). Dan is er geen
     dossier, en dan hoort het nummer gewoon in de rij te staan -- niet nergens.
     Stil weggooien zou erger zijn dan bewaren: dan is het stuk niet meer terug
     te vinden en weet niemand waarom. */
  const db = { data: {} };
  const store = vakbewijsMod({ db, save() {},
    schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200),
    tijdVandaag: () => '2026-08-17' });
  const s = store.sleutelLid(11);
  store.vakbewijsZet(s, { wat: 'vog', nummer: 'ZONDER-KLUIS', tot: '2030-01-01' });
  assert.equal(db.data.vakbewijzen[0].nummer, 'ZONDER-KLUIS');
  assert.equal(store.vakbewijsNummer(s, 'vog'), null,
    'en de kluisweg geeft niets terug, want er is geen kluis -- geen half antwoord');
});

test('5. de eenmalige verhuizing haalt bestaande nummers uit de rij', () => {
  const K = bouw();
  /* Een database van voor deze wijziging: het nummer staat in de rij. */
  K.db.data.vakbewijzen = [
    { sleutel: 'lid:21', wat: 'big', nummer: 'OUD-123', van: '2026-01-01', tot: '2030-01-01', afgetekend: null },
    { sleutel: 'concern:Zilveren Valk 1A', wat: 'rijbewijs-C', nummer: 'CONCERN-9', van: '2026-01-01', tot: null }
  ];
  K.store.vakbewijzenVan('lid:21');            // eerste lezing = de verhuizing

  assert.equal(K.db.data.vakbewijzen[0].nummer, undefined, 'het lid-nummer is verhuisd');
  assert.equal((K.dossiers.get(21) || {}).vakbewijsNummers.big, 'OUD-123', 'en staat in het dossier');
  assert.equal(K.db.data.vakbewijzen[1].nummer, 'CONCERN-9',
    'een concernrij blijft staan: die codenaam heeft geen RTG-account om een dossier aan te hangen');
});

/* ============================================================================
   DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2)

   F. AFGESLAGEN op de routetoetsen, RAAK hier -- en dat verschil is de reden
      dat dit bestand bestaat. In kern/vakbewijs.js de regel
      `if (!nummerZet(...)) v.nummer = nummer; else delete v.nummer` vervangen
      door `nummerZet(...); v.nummer = nummer`, zodat het nummer NAAST de kluis
      ook in de operationele rij blijft staan.
      -> alle negen toetsen van test/vakbewijs-routes.test.js bleven groen; de
         uitgang was immers al dicht.
      -> toets 1 hier zakte meteen: "de operationele rij draagt geen nummer
         meer".

   G. RAAK. `const anders = false` in vakbewijsZet -- de vorm waarin een nieuw
      nummer niet meer als een ander stuk telt, zodat een aftekening blijft
      staan op iets dat niemand heeft gezien. Dat is de duurste stille fout die
      deze verhuizing kon opleveren: de vergelijking hing eerst op een veld
      BINNEN de rij en moet nu uit het dossier komen.
      -> toets 3 zakte: "een ander nummer is een ander stuk, en dat is niet
         gezien".

   En op de routekant (test/vakbewijs-routes.test.js, toets 9):

   H. RAAK. De reden-eis bij /api/office/vakbewijs/nummer uitgezet.
      -> "zonder reden gaat de kluis niet open" zakte.

   I. RAAK. De aanroep van inzagelog.noteer() overgeslagen.
      -> "de inzage staat in het journaal" zakte -- gelezen door de betrokkene
         zelf via /api/privacy/inzage, want dat is waar het journaal voor is.
   ========================================================================== */
