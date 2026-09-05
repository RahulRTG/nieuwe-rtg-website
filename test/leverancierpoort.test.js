/* DE LEVERANCIERSPOORT: de acht functies waar elke supplier-route langs komt.

   WAAROM DEZE TOETS ER NU PAS IS. Deze acht stonden midden in server.js, in een
   bestand van tweeduizend regels, en waren daardoor niet los aan te roepen.
   Sinds ze in server/opzet/leverancierpoort.js wonen kan het wel -- en dat was
   ook meteen nodig, want bij het afsplitsen bleek er geen enkele toets op te
   staan. Twee mutaties op de nieuwe naad overleefden:

     - `kern` zonder late binding (de persoonseis valt terug op zijn
       noodpad, en voor een gereguleerd genre gaat de deur dan DICHT)
     - een bus die niets publiceert (elk SSE-sein verdwijnt spoorloos)

   Geen van beide liet iets zakken. Dat zegt niets over de verhuizing -- de
   functies zijn woord voor woord dezelfde -- maar wel over wat er aan bewijs
   ontbrak: de plek waar de persoonseis WORDT AFGEDWONGEN had er geen.
   test/persoonseis.test.js toetst het register en de regels; hier staat de
   deur zelf.

   Draai los: node --experimental-sqlite --test test/leverancierpoort.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const maakPoort = require('../server/opzet/leverancierpoort');
const staffSessie = require('../server/accounts/staff-sessie');
const persoonseisModule = require('../server/kern/persoonseis');

/* Een genre MET een werk-eis en een genre zonder, uit het register zelf
   gehaald en niet overgetypt: een vaste naam hier zou stil verlopen zodra het
   register verandert, en dan toetst deze zaak iets anders dan hij zegt. */
const GEREGULEERD = Object.keys(persoonseisModule.EISEN)
  .find((g) => (persoonseisModule.EISEN[g].werk || []).length);
const VRIJ = 'hotel';

function opstelling(opties) {
  const o = opties || {};
  const db = { data: { suppliers: [], supplierNotifications: {}, supplierActivity: {} } };
  const geseind = [];
  const bus = { publish: (kanaal, bericht) => geseind.push({ kanaal, ...bericht }) };
  let kern = o.kern === undefined ? {} : o.kern;
  const accounts = o.accounts || {
    // Deze toets gaat over de leverancierspoort, niet over de productiecutover;
    // een aparte toets hieronder zet de accountgrens bewust dicht.
    legacyStaffPinToegestaan: () => true,
    getStaffById: () => null,
    getUserById: id => ({ id, actief: 1, sessies_vanaf: 0 }),
    isActief: () => true
  };
  if (typeof accounts.controleerStaffSessie !== 'function')
    accounts.controleerStaffSessie = sess => staffSessie.controleer(accounts, sess);
  let saves = 0;
  const poort = maakPoort({
    db, save: () => { saves++; }, crypto, accounts,
    rtgKlok: { datum: () => new Date('2026-08-19T12:00:00Z') },
    sessionFor: (t) => o.sessies && o.sessies[t],
    grootSupplierSync: () => null,   // de grote kast is hier leeg; de kleine doet het werk
    DEMO: !!o.demo,
    busGeef: () => bus,
    kernGeef: () => kern
  });
  return { poort, db, geseind, zetKern: (k) => { kern = k; }, saves: () => saves };
}

test('de productiesupplierpoort controleert de verse staff/account-binding', () => {
  const lid = { id: 7, actief: 1, sessies_vanaf: 0 };
  const staff = { id: 4, supplier_code: 'AAA', member_id: 7, active: 1 };
  const accounts = {
    legacyStaffPinToegestaan: () => false,
    getStaffById: id => id === 4 ? staff : null,
    getUserById: id => id === 7 ? lid : null,
    isActief: u => !!u && u.actief !== 0
  };
  const sessies = { goed: { role: 'supplier', code: 'AAA', staffId: 4, lid: 7,
    lidKey: 'user-7', lidInlogOp: 100 } };
  const { poort, db } = opstelling({ accounts, sessies });
  db.data.suppliers.push({ code: 'AAA', type: VRIJ });
  let door = false;
  poort.supplierAuth({ get: () => 'Bearer goed', path: '/state' }, antwoord(), () => { door = true; });
  assert.equal(door, true);

  staff.active = 0;
  accounts.getStaffById = () => null;
  const uitDienst = antwoord();
  poort.supplierAuth({ get: () => 'Bearer goed', path: '/state' }, uitDienst, () => assert.fail('uit dienst'));
  assert.equal(uitDienst.uit.status, 401);

  accounts.getStaffById = () => staff;
  staff.active = 1;
  lid.sessies_vanaf = 101;
  const ingetrokken = antwoord();
  poort.supplierAuth({ get: () => 'Bearer goed', path: '/state' }, ingetrokken, () => assert.fail('ingetrokken'));
  assert.equal(ingetrokken.uit.status, 401);
  assert.match(ingetrokken.uit.body.error, /ingetrokken/);
});

function antwoord() {
  const uit = {};
  return {
    uit,
    status(c) { uit.status = c; return this; },
    json(b) { uit.body = b; return this; }
  };
}

test('de bus wordt pas bij het SEINEN opgehaald, niet bij het bouwen', () => {
  /* Dit is de reden dat busGeef een functie is: server.js bouwt deze poort
     VOOR de dienstenlaag, omdat die laag findSupplier en de twee SSE-wegen als
     waarde meekrijgt. Een vaste verwijzing zou hier voor altijd undefined zijn. */
  const { poort, geseind } = opstelling();
  poort.sseToSupplier('ABC', 'sync', { scope: 'team' });
  poort.sseToOffice('nieuw', { wat: 'iets' });
  assert.equal(geseind.length, 2);
  /* De `envelop` hierin is een OPGAVE en nog geen envelop: deze poort zegt hoe
     gevoelig de inhoud is, en server/bus.js vult daar id, tijd en keten bij.
     Hier staat een stub-bus, dus je ziet precies wat de poort zelf meegeeft. */
  assert.deepEqual(geseind[0], { kanaal: 'sse', doel: 'sup', match: 'ABC', event: 'sync',
    data: { scope: 'team' }, envelop: { classificatie: 'intern' } });
  assert.equal(geseind[1].doel, 'office');
});

test('findSupplier bouwt zijn index opnieuw zodra er een zaak bij komt', () => {
  /* De index bestaat omdat een lineaire scan per verzoek bij miljoenen zaken te
     duur is. Hij hangt aan de LENGTE van de lijst; zonder herbouw vindt hij een
     nieuwe partner nooit, en dat is precies het soort fout dat pas in productie
     opvalt. */
  const { poort, db } = opstelling();
  db.data.suppliers.push({ code: 'AAA', type: VRIJ });
  assert.equal(poort.findSupplier('AAA').code, 'AAA');
  assert.equal(poort.findSupplier('BBB'), null, 'onbekend is null en niet undefined');
  db.data.suppliers.push({ code: 'BBB', type: VRIJ });
  assert.equal(poort.findSupplier('BBB').code, 'BBB', 'de index hoort mee te groeien');
});

test('de poort laat niemand door zonder sessie, en een gesloten partner ook niet', () => {
  const { poort, db } = opstelling({ sessies: { goed: { role: 'supplier', code: 'AAA' } } });
  db.data.suppliers.push({ code: 'AAA', type: VRIJ });

  const zonder = antwoord();
  poort.supplierAuth({ get: () => '' }, zonder, () => assert.fail('mag niet door'));
  assert.equal(zonder.uit.status, 401);

  const verkeerdeRol = antwoord();
  poort.supplierAuth({ get: () => 'Bearer lid' }, verkeerdeRol, () => assert.fail('mag niet door'));
  assert.equal(verkeerdeRol.uit.status, 401);

  db.data.suppliers[0].partnerStatus = 'geschorst';
  const dicht = antwoord();
  poort.supplierAuth({ get: () => 'Bearer goed' }, dicht, () => assert.fail('mag niet door'));
  assert.equal(dicht.uit.status, 401);
  assert.match(dicht.uit.body.error, /gesloten/);
});

test('de persoonseis houdt OOK de manager tegen, en dat is de hele reden dat hij hier staat', () => {
  /* CLAUDE.md zegt het met zoveel woorden: bij een kinderopvang is er geen
     functie waarbij je niet in de buurt van een kind komt, en juist de
     vrijstelling voor de baas is de deur waar een fraudeur op mikt. */
  const geweigerd = { ok: false, error: 'Voor dit werk is een VOG op uw eigen naam nodig.', missend: ['vog'] };
  const kern = { persoonseis: {
    isGedeeldeInlog: () => false,
    persoonVanActor: (a) => ({ lid: a.lid, sleutel: 'k' + a.lid }),
    magWerkenHier: (genre) => (genre === GEREGULEERD ? geweigerd : { ok: true })
  } };
  const { poort, db } = opstelling({ kern });
  db.data.suppliers.push({ code: 'AAA', type: GEREGULEERD });
  const req = { get: () => 'Bearer m' };
  const res = antwoord();
  const poort2 = opstelling({ kern, sessies: { m: { role: 'supplier', code: 'AAA', manager: true, staffId: null, lid: 7 } } });
  poort2.db.data.suppliers.push({ code: 'AAA', type: GEREGULEERD });
  poort2.poort.supplierAuth(req, res, () => assert.fail('een manager zonder VOG mag hier niet door'));
  assert.equal(res.uit.status, 403);
  assert.deepEqual(res.uit.body.persoonseis, ['vog']);

  // en een genre zonder eis gaat gewoon open
  const vrij = opstelling({ kern, sessies: { m: { role: 'supplier', code: 'BBB', manager: true, lid: 7 } } });
  vrij.db.data.suppliers.push({ code: 'BBB', type: VRIJ });
  let door = false;
  vrij.poort.supplierAuth({ get: () => 'Bearer m' }, antwoord(), () => { door = true; });
  assert.equal(door, true, 'een hotel vraagt geen VOG');
  void poort;
});

test('zonder de persoonseislaag gaat een gereguleerd genre DICHT, niet stilzwijgend open', () => {
  /* Fail-closed, en dat is geen detail: een toets die de kern niet opbouwt zou
     anders een groene deur meten die in productie een eis moet stellen. */
  const { poort, db } = opstelling({ kern: {}, sessies: { m: { role: 'supplier', code: 'AAA', manager: true, lid: 7 } } });
  db.data.suppliers.push({ code: 'AAA', type: GEREGULEERD });
  const res = antwoord();
  poort.supplierAuth({ get: () => 'Bearer m' }, res, () => assert.fail('zonder de laag hoort dit dicht te zijn'));
  assert.equal(res.uit.status, 403);
  assert.match(res.uit.body.error, /niet beschikbaar/);

  const vrij = opstelling({ kern: {}, sessies: { m: { role: 'supplier', code: 'BBB', manager: true, lid: 7 } } });
  vrij.db.data.suppliers.push({ code: 'BBB', type: VRIJ });
  let door = false;
  vrij.poort.supplierAuth({ get: () => 'Bearer m' }, antwoord(), () => { door = true; });
  assert.equal(door, true, 'een genre zonder eis hoort ook zonder de laag te werken');
});

test('de gedeelde bedrijfsinlog komt ALLEEN in demostand langs de persoonseis', () => {
  const kern = { persoonseis: {
    isGedeeldeInlog: (a) => !!(a && a.manager && a.staffId == null && a.lid == null),
    persoonVanActor: () => null,
    magWerkenHier: () => ({ ok: false, error: 'nee', missend: ['vog'] })
  } };
  const sessies = { g: { role: 'supplier', code: 'AAA', manager: true, staffId: null, lid: null } };

  const demo = opstelling({ kern, sessies, demo: true });
  demo.db.data.suppliers.push({ code: 'AAA', type: GEREGULEERD });
  let doorInDemo = false;
  demo.poort.supplierAuth({ get: () => 'Bearer g' }, antwoord(), () => { doorInDemo = true; });
  assert.equal(doorInDemo, true);

  const echt = opstelling({ kern, sessies, demo: false });
  echt.db.data.suppliers.push({ code: 'AAA', type: GEREGULEERD });
  const res = antwoord();
  echt.poort.supplierAuth({ get: () => 'Bearer g' }, res, () => assert.fail('buiten demostand hoort dit dicht'));
  assert.equal(res.uit.status, 403);
});

test('het activiteitenjournaal bewaart de laatste tachtig en seint de teamtab', () => {
  const { poort, db, geseind } = opstelling();
  for (let i = 0; i < 85; i++) poort.logActivity('AAA', { name: 'Ik' }, 'regel ' + i);
  assert.equal(db.data.supplierActivity.AAA.length, 80, 'een journaal dat oneindig groeit is geen journaal');
  assert.equal(db.data.supplierActivity.AAA[0].text, 'regel 84', 'nieuwste bovenaan');
  assert.equal(geseind.length, 85, 'elke regel seint de teamtab');
  assert.equal(geseind[0].event, 'sync');
});

test('notifySupplier houdt veertig meldingen en zet ze ongelezen bovenaan', () => {
  const { poort, db, geseind } = opstelling();
  for (let i = 0; i < 45; i++) poort.notifySupplier('AAA', { text: 'melding ' + i });
  const lijst = db.data.supplierNotifications.AAA;
  assert.equal(lijst.length, 40);
  assert.equal(lijst[0].text, 'melding 44');
  assert.equal(lijst[0].read, false);
  assert.match(lijst[0].id, /^[0-9a-f]{8}$/, 'een id uit de CSPRNG, niet uit de klok');
  assert.equal(geseind.at(-1).event, 'notify');
});

/* ============================================================================
   DE ABONNEMENTSPOORT -- het onderdeel waar dit verzoek heen gaat, zit dat in
   het abonnement van de zaak?

   WAAROM HIER EN NIET IN DE KASSABESTANDEN. Om dezelfde reden als de
   persoonseis hierboven: dit is het enige keelgat waar elke leveranciersroute
   doorheen moet, dus een kassaroute die er morgen naast wordt gebouwd valt er
   vanzelf onder. Een controle per bestand is de zevenenzeventigste
   pas-id-controle in een ander jasje.

   HET VERSCHIL MET DE PERSOONSEIS. Die valt DICHT als haar laag ontbreekt; deze
   valt terug op de ruimste zakelijke trede. Dat verschil is een besluit en geen
   slordigheid -- toets 3 hieronder houdt het vast.
   ========================================================================== */

/* De trede uit de tabel halen en niet overtypen: een vaste naam hier zou stil
   verlopen zodra het productprofiel verandert. */
const capsTabel = require('../server/kern/commercie/capaciteiten');
const GOVERNANCE_WEL = capsTabel.tredenMet('can_use_enterprise_governance')[0];
const GOVERNANCE_NIET = capsTabel.tredenMet('can_be_partner')
  .find((t) => !capsTabel.mag(t, 'can_use_enterprise_governance'));

function zaakOpTrede(trede, schaduw) {
  const sessies = { g: { role: 'supplier', code: 'AAA', manager: true, lid: 7 } };
  const kern = {
    persoonseis: { isGedeeldeInlog: () => false, persoonVanActor: () => ({ lid: 7, sleutel: 'k' }),
      magWerkenHier: () => ({ ok: true }) },
    zaakAbonnement: trede === undefined ? undefined : { van: () => ({ pas: trede, herkomst: 'vastgelegd' }) },
    handhavingSchaduw: schaduw || undefined
  };
  const o = opstelling({ kern, sessies });
  o.db.data.suppliers.push({ code: 'AAA', type: VRIJ });
  return o;
}

function verzoek(o, pad) {
  const res = antwoord();
  let door = false;
  o.poort.supplierAuth({ get: () => 'Bearer g', path: pad }, res, () => { door = true; });
  return { door, uit: res.uit };
}

test('de abonnementspoort houdt een onderdeel tegen dat niet in het abonnement zit', () => {
  const lite = zaakOpTrede(GOVERNANCE_NIET);
  const geweigerd = verzoek(lite, '/api/supplier/command/beleid/zet');
  assert.equal(geweigerd.door, false, GOVERNANCE_NIET + ' bevat geen governance');
  assert.equal(geweigerd.uit.status, 402, 'dit is een betaalgrens en geen verboden deur');
  assert.equal(geweigerd.uit.body.capability, 'can_use_enterprise_governance');
  assert.match(geweigerd.uit.body.error, /abonnement van deze zaak/);

  // en de rest van dezelfde cockpit gaat gewoon open
  assert.equal(verzoek(lite, '/api/supplier/command/graaf').door, true,
    'alleen beleid en journaal zijn governance; de cockpit hoort bij elke zakelijke trede');
  assert.equal(verzoek(lite, '/api/supplier/pos/sale').door, true, 'de kassa zit wel in deze trede');
});

test('een zaak op de hoogste trede komt overal langs', () => {
  const groot = zaakOpTrede(GOVERNANCE_WEL);
  for (const pad of ['/api/supplier/command/beleid', '/api/supplier/pos/sale',
    '/api/supplier/payroll/runs', '/api/supplier/rooster/voorstel', '/api/supplier/mall'])
    assert.equal(verzoek(groot, pad).door, true, pad + ' hoort open te zijn op ' + GOVERNANCE_WEL);
});

test('zonder de abonnementslaag valt de poort TERUG en niet dicht', () => {
  /* Dit is het spiegelbeeld van de persoonseis erboven, en met opzet. Die
     beschermt kinderen en hoort dicht te vallen; deze bewaakt een productgrens.
     Een zaak die vandaag een kassa draait en morgen niet meer, omdat een laag
     niet gemount was, is een storing met een nette naam. */
  const kaal = zaakOpTrede(undefined);
  assert.equal(verzoek(kaal, '/api/supplier/pos/sale').door, true);
  assert.equal(verzoek(kaal, '/api/supplier/command/beleid').door, true,
    'de terugval is de ruimste zakelijke trede, zodat er niemand iets kwijtraakt');
});

test('een pad dat nergens onder valt, wordt door de poort niet aangeraakt', () => {
  const lite = zaakOpTrede(GOVERNANCE_NIET);
  assert.equal(verzoek(lite, '/api/supplier/state').door, true);
  assert.equal(verzoek(lite, undefined).door, true, 'geen pad is geen weigering');
});

/* ============================================================================
   DE SCHADUWSTAND AAN DE DEUR ZELF.

   kern/commercie/schaduw.js is met zes mutaties nagelopen en geen daarvan liet
   deze poort zakken -- dus dat de deur de schaduwlaag werkelijk raadpleegt, was
   nergens bewezen. Een laag die je alleen los toetst, is een laag waarvan je
   hoopt dat hij is aangesloten.
   ========================================================================== */
const { maakSchaduw } = require('../server/kern/commercie/schaduw');

function schaduwlaag(modus) {
  const db = { data: {} };
  const S = maakSchaduw({ db, save: () => {}, nu: () => 1000 });
  const id = 'abonnementspoort.can_use_enterprise_governance';
  S.meld(id, 'SCHADUW');
  if (modus === 'AFDWINGEN') {
    S.stelVrij(id, 'in deze toets gaat het om de deur en niet om de rijpheid', 'toets');
    S.zetModus(id, 'AFDWINGEN', 'toets');
  }
  return { S, id };
}

test('een regel in de SCHADUW laat het verzoek door en telt wat hij zou doen', () => {
  const { S, id } = schaduwlaag('SCHADUW');
  const lite = zaakOpTrede(GOVERNANCE_NIET, S);

  const r = verzoek(lite, '/api/supplier/command/beleid/zet');
  assert.equal(r.door, true, 'een schaduwregel houdt niemand tegen -- ook niet aan de echte deur');

  const st = S.stand(id);
  assert.equal(st.waarnemingen, 1, 'maar de deur meldt hem wel');
  assert.equal(st.zouTegenhouden, 1);
  assert.equal(st.voorbeelden[0].wie, 'AAA');
  assert.equal(st.voorbeelden[0].wat, '/api/supplier/command/beleid/zet');
});

test('dezelfde regel op AFDWINGEN houdt hetzelfde verzoek wel tegen', () => {
  const { S } = schaduwlaag('AFDWINGEN');
  const lite = zaakOpTrede(GOVERNANCE_NIET, S);
  const r = verzoek(lite, '/api/supplier/command/beleid/zet');
  assert.equal(r.door, false);
  assert.equal(r.uit.status, 402);
});

test('zonder schaduwlaag doet de poort wat hij altijd deed, niet stilzwijgend minder', () => {
  const lite = zaakOpTrede(GOVERNANCE_NIET);       // geen schaduwlaag gemount
  assert.equal(verzoek(lite, '/api/supplier/command/beleid/zet').door, false,
    'een ontbrekende schaduwlaag mag geen handhaving uitzetten');
});
