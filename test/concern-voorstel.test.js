/* ============================================================================
   STAP 9: WAT UIT EEN DOCUMENT KOMT IS EEN VOORSTEL, NOOIT EEN FEIT.

   WAAROM DIT BESTAAT

   Document Intelligence is het deel dat het meest indrukwekkend oogt en het
   makkelijkst fout gaat: een patroonherkenner die zijn vondsten rechtstreeks
   als juridische waarheid wegschrijft. CONCERN.md verbiedt dat met zoveel
   woorden -- de AI mag extraheren, vergelijken, structureren en signaleren,
   maar nooit juridische geldigheid VERZINNEN.

   Deze toets legt die grens vast op de enige plek waar hij machinaal te
   handhaven is: lezen mag NIETS opleveren in de opslag, en bevestigen mag
   alleen opleveren wat een mens heeft aangewezen.

   OOK GETOETST: de bewijsstap voor de acht gereguleerde genres. Die stonden
   dicht met de reden "een vlag die niemand handhaaft is een open deur met een
   bordje ernaast". Nu ze open zijn, moet die handhaving er echt zijn.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

const register = require('../server/seed/genres');

function bouwConcern() {
  const db = { data: {} };
  db.capsVan = () => [];
  return require('../server/kern/concern')({
    db, save: () => {}, crypto,
    schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n),
    findSupplier: () => null, vandaag: () => '2027-06-14'
  });
}
const maakEnt = (K) => K.entiteitVind(
  K.entiteitNieuw('lid_a', { naam: 'Noordzee Hotels BV', land: 'NL' }).entiteit.id);

const AKTE = `
  UITTREKSEL HANDELSREGISTER
  Kamer van Koophandel nummer 87654321
  Rechtsvorm: Besloten vennootschap
  Statutair gevestigd te Amsterdam
  BTW-nummer NL001234567B01
  Datum van oprichting: 12 maart 2024
`;

test('lezen legt niets vast en draagt per kandidaat een vindplaats', () => {
  const K = bouwConcern();
  const e = maakEnt(K);
  const voor = K.tijdGeschiedenis(e.id).length;

  const r = K.voorstelLees(e, AKTE, { bestand: 'uittreksel.pdf' });
  assert.equal(r.ok, true);
  assert.match(r.kop, /bevestig/i, 'de kop hoort te zeggen dat er nog niets vaststaat');
  assert.match(r.grens, /nog niets vastgelegd/i);

  /* DE KERN VAN DEZE TOETS: lezen is lezen. */
  assert.equal(K.tijdGeschiedenis(e.id).length, voor,
    'voorstelLees() heeft feiten weggeschreven -- dat is precies wat wet 4 verbiedt');

  const soorten = r.voorstel.kandidaten.map(k => k.soort);
  assert.ok(soorten.includes('registratie'), 'het KvK-nummer hoort herkend te worden');
  assert.ok(soorten.includes('fiscaal'), 'het BTW-nummer hoort herkend te worden');
  assert.ok(soorten.includes('rechtsvorm'), 'de rechtsvorm hoort herkend te worden');

  for (const k of r.voorstel.kandidaten) {
    assert.ok(k.vindplaats && k.vindplaats.length > 5,
      k.soort + ' mist zijn vindplaats; aanvinken zonder te kunnen nakijken is blind bevestigen');
  }
  const reg = r.voorstel.kandidaten.find(k => k.soort === 'registratie');
  assert.equal(reg.waarde, '87654321');
});

test('bevestigen legt alleen vast wat is aangevinkt, met bron document', () => {
  const K = bouwConcern();
  const e = maakEnt(K);
  const r = K.voorstelLees(e, AKTE, { bestand: 'uittreksel.pdf' });
  const reg = r.voorstel.kandidaten.find(k => k.soort === 'registratie');
  const btw = r.voorstel.kandidaten.find(k => k.soort === 'fiscaal');

  const b = K.voorstelBevestig(e, r.voorstel.id, [reg.id], 'lid_a');
  assert.equal(b.vastgelegd, 1, 'er hoort er precies EEN vastgelegd te zijn');

  const staat = K.entiteitBeeld(e);
  assert.equal(staat.registraties.length, 1);
  assert.equal(staat.registraties[0].nummer, '87654321');
  assert.equal(staat.registraties[0].bron.soort, 'document',
    'een bevestigd document-gegeven hoort bron `document` te dragen en geen andere');

  /* WAT NIET IS AANGEVINKT BESTAAT NIET. Dit is het verschil tussen een
     voorstel en een import. */
  assert.equal(staat.fiscaal.length, 0,
    'het BTW-nummer is niet aangevinkt en hoort dus nergens te staan');
  assert.ok(btw, 'het stond wel als kandidaat klaar');

  // een lege keuze is geen bevestiging
  assert.equal(K.voorstelBevestig(e, r.voorstel.id, [], 'lid_a').ok, undefined);
  // en het voorstel van een ander is niet te bevestigen
  const ander = maakEnt(K);
  assert.equal(K.voorstelBevestig(ander, r.voorstel.id, [reg.id], 'lid_a').status, 404);
});

test('wij verzinnen liever niets: een tekst zonder herkenbare gegevens levert niets op', () => {
  const K = bouwConcern();
  const e = maakEnt(K);
  const r = K.voorstelLees(e, 'Beste heer, hierbij bevestig ik onze afspraak van volgende week. Groet, Jan.');
  assert.equal(r.ok, true);
  assert.equal(r.voorstel.kandidaten.filter(k => !k.alleenAlsIngang).length, 0);
  assert.match(r.leeg, /liever niets voorstellen dan iets verzinnen/i,
    'een lege uitslag hoort te zeggen waarom hij leeg is');
});

test('de bewijsstap houdt een gereguleerd genre tegen tot een mens tekent', () => {
  const B = require('../server/kern/aanmeldingen/bedrijf.js');
  const db = { data: { suppliers: [] } };
  const M = B({ db, save: () => {}, nu: () => '2026-08-11T00:00:00Z',
    kap: (v, n) => String(v == null ? '' : v).trim().slice(0, n),
    accounts: { createStaffSync: () => ({ id: 1 }) } });

  /* De acht bewijs-genres zijn nu aanvraagbaar -- dat is het punt van deze
     ronde. Zou de poort hieronder niet werken, dan is dat openzetten juist de
     fout die het register kwam voorkomen. */
  assert.ok(register.aanvraagbareGenres().includes('apotheek'),
    'een apotheek hoort aangevraagd te kunnen worden');

  const a = { naam: 'Zorgzaam' };
  assert.equal(M.zetBedrijf(a, { naam: 'Apotheek Noord', type: 'apotheek' }).ok, true);
  assert.equal(a.bedrijf.bewijsNodig, true, 'de eis hoort op de aanmelding te staan');

  assert.equal(M.provisioneer(a), null, 'zonder stuk hoort er geen zaak te ontstaan');
  assert.equal(db.data.suppliers.length, 0);
  assert.equal(M.bewijsStand(a).stand, 'ontbreekt');
  assert.match(M.bewijsStand(a).vraag, /apothekers/i, 'de vraag hoort het stuk bij naam te noemen');

  M.bewijsIndien(a, { soort: 'inschrijving', nummer: '19-123456' });
  assert.equal(M.provisioneer(a), null, 'INDIENEN is geen aftekenen; de zaak hoort te wachten');
  assert.equal(M.bewijsStand(a).stand, 'ingediend');

  assert.equal(M.bewijsTeken(a, '').status, 400, 'aftekenen zonder naam is geen aftekenen');
  assert.equal(M.bewijsTeken(a, 'Imran').ok, true);
  const z = M.provisioneer(a);
  assert.ok(z && z.code, 'na aftekenen hoort de zaak gewoon klaargezet te worden');

  // en een gewoon genre loopt precies zoals altijd
  const b2 = { naam: 'Vidal' };
  M.zetBedrijf(b2, { naam: 'Cafe Vidal', type: 'restaurant' });
  assert.equal(b2.bedrijf.bewijsNodig, undefined, 'een restaurant hoort geen bewijsvraag te krijgen');
  assert.ok(M.provisioneer(b2).code, 'en meteen te kunnen draaien');
});

test('een geweigerde branche laat een spoor na in plaats van een stilte', () => {
  const intake = require('../server/kern/onderneming/intake')({
    schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n) });
  const o = {};

  intake.intakeZet(o, { idee: { branche: 'restaurant' } });
  assert.equal(o.intake.idee.branche, 'restaurant');
  assert.equal(o.intake.brancheGeweigerd, undefined);

  /* Een gesloten genre: het veld blijft leeg -- er wordt niets VERVANGEN -- maar
     er staat nu bij waarom, en met welke stand. */
  const dicht = register.genresMetStand('binnenkort')[0];
  intake.intakeZet(o, { idee: { branche: dicht } });
  assert.equal(o.intake.idee.branche, null);
  assert.equal(o.intake.brancheGeweigerd.gevraagd, dicht);
  assert.equal(o.intake.brancheGeweigerd.stand, 'binnenkort');
  assert.ok(o.intake.brancheGeweigerd.uitleg);

  // en een geldige keuze daarna ruimt de melding op
  intake.intakeZet(o, { idee: { branche: 'hotel' } });
  assert.equal(o.intake.brancheGeweigerd, undefined, 'een opgeloste weigering hoort te verdwijnen');
});

/* ----------------------------------------------------------------------------
   DE MUTATIES DIE ZIJN GEDAAN (LAT-regel 2)

   1. voorstelLees() meteen tijdZet() laten doen  -> toets 1 zakt
   2. voorstelBevestig() alle kandidaten pakken   -> toets 2 zakt
   3. bron 'document' vervangen door 'register'   -> toets 2 zakt
   4. bewijsKlaar() altijd true                   -> toets 4 zakt
   5. bewijsTeken() zonder naam toestaan          -> toets 4 zakt
   6. brancheGeweigerd niet zetten                -> toets 5 zakt
   -------------------------------------------------------------------------- */
