/* DE VERIFICATIESTERKTE EN DE STEP-UP -- laag 2 en 3 van de Trust Fabric.

   Deze toetsen gaan bijna allemaal over NIET vragen, en dat is met opzet. De
   enige echte ontwerpfout die in een step-up te maken valt is te vaak vragen:
   wie bij elke handeling een bevestiging krijgt, klikt hem binnen een week weg
   zonder te lezen, en dan is de veiligheid verlaagd en de bediening verzwaard.

   Zes beweringen:

   1. Een lichte handeling vraagt nooit, hoe zwak de sessie ook is.
   2. Een zware handeling met een verse harde verificatie op een bekend apparaat
      vraagt ook niet -- dat is de "invisible when safe" van VERTROUWEN.md.
   3. Een uitzonderlijke handeling vraagt altijd.
   4. "Niet vastgelegd" en "geen persoon" zijn twee verschillende antwoorden en
      leveren twee verschillende uitslagen.
   5. Een ongewogen handeling levert geen stilte maar een `onzeker` met reden.
   6. Het apparaat wordt herkend, en er wordt niets bewaard dan een hash.

   Draai los: node --test test/vertrouwenstapop.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../server/kern/vertrouwen/blootstelling');
const V = require('../server/kern/vertrouwen/verificatie');
const S = require('../server/kern/vertrouwen/stapop');

const licht = () => B.meet({ soort: 'rol.geven', aantal: 1 }, null);
const zwaar = () => B.meet({ soort: 'mens.gevoelig.inzage', aantal: 20 }, null);
const extreem = () => B.meet({ soort: 'tenant.uitvoer', aantal: 100000 }, null);
const sterk = { hoe: 'passkey', naam: 'een passkey', sterkte: 'sterk', ouderdomMs: 60000, vers: true, apparaatNieuw: false };

test('1. een lichte handeling vraagt nooit, ook niet bij de zwakste sessie', () => {
  assert.equal(licht().zwaarte, 'licht');
  for (const ver of [null, V.zonderPersoon(), { sterkte: 'zwak', naam: 'een pincode', vers: false, ouderdomMs: 9e6, apparaatNieuw: true }]) {
    const u = S.beoordeel(licht(), ver);
    assert.equal(u.nodig, false, 'niets vragen bij een handeling die niets raakt');
    assert.equal(u.zin, null, 'en dus ook niets te lezen');
  }
});

test('2. zwaar plus vers en hard op een bekend apparaat: de gebruiker merkt niets', () => {
  const u = S.beoordeel(zwaar(), sterk);
  assert.equal(zwaar().zwaarte, 'zwaar');
  assert.equal(u.nodig, false, 'dit is de "invisible when safe" van de hele laag');
  assert.deepEqual(u.waarom, []);

  /* En elk van de drie eigenschappen los kantelt hem wel. */
  assert.equal(S.beoordeel(zwaar(), { ...sterk, vers: false, ouderdomMs: 40 * 60000 }).nodig, true, 'oud');
  assert.equal(S.beoordeel(zwaar(), { ...sterk, apparaatNieuw: true }).nodig, true, 'nieuw apparaat');
  assert.equal(S.beoordeel(zwaar(), { ...sterk, sterkte: 'zwak' }).nodig, true, 'te zacht');
});

test('3. een uitzonderlijke handeling vraagt altijd, ook bij de beste sessie', () => {
  const u = S.beoordeel(extreem(), sterk);
  assert.equal(extreem().zwaarte, 'uitzonderlijk');
  assert.equal(u.nodig, true);
  assert.equal(u.mogelijk, true);
  assert.match(u.zin, /100000/, 'het getal staat in de zin');
  assert.match(u.zin, /tweede bevestiging/);
});

test('4. "niet vastgelegd" en "geen persoon" zijn twee antwoorden', () => {
  const onbekend = S.beoordeel(zwaar(), null);
  assert.equal(onbekend.nodig, true);
  assert.equal(onbekend.mogelijk, true, 'er kan iemand zijn, we weten het alleen niet');
  assert.match(onbekend.zin, /niet vastgelegd/);

  const sleutel = S.beoordeel(zwaar(), V.zonderPersoon('een beheer-token'));
  assert.equal(sleutel.nodig, true, 'de handeling verdient nog steeds een tweede moment');
  assert.equal(sleutel.mogelijk, false, 'maar er is niemand om het aan te vragen');
  assert.match(sleutel.zin, /geen persoon om het aan te vragen/);
  assert.equal(V.zonderPersoon('een beheer-token').reden,
    'Deze deur gaat open op een beheer-token en niet op een persoon.',
    'de deur noemt de sleutel, de fabric formuleert de zin -- anders schrijft elke deur zijn eigen versie');
  assert.ok(!/tweede bevestiging\./.test(sleutel.zin), 'geen belofte die deze deur niet kan waarmaken');
});

test('5. een ongewogen handeling levert geen stilte maar een onzekerheid', () => {
  const u = S.beoordeel(B.meet({ soort: 'iets.verzonnen', aantal: 9e9 }, null), sterk);
  assert.equal(u.nodig, false, 'niet bij elke onbekende handeling vragen');
  assert.equal(u.onzeker, true, 'maar het is geen groen vinkje');
  assert.match(u.reden, /ongewogen/);
  assert.match(u.reden, /een keuze en geen oordeel/);
});

test('6. het apparaat wordt herkend, en er staat niets herleidbaars in de bak', () => {
  const bak = {};
  const eerste = V.noteer(bak, 'sess-1', { hoe: 'wachtwoord', account: 'lid-7', apparaat: 'Firefox op een Mac' });
  assert.equal(eerste.apparaatNieuw, true, 'de eerste keer is elk apparaat nieuw');
  const tweede = V.noteer(bak, 'sess-2', { hoe: 'wachtwoord', account: 'lid-7', apparaat: 'Firefox op een Mac' });
  assert.equal(tweede.apparaatNieuw, false, 'en daarna kent hij hem');
  assert.equal(V.noteer(bak, 'sess-3', { hoe: 'wachtwoord', account: 'lid-7', apparaat: 'Chrome op Windows' }).apparaatNieuw,
    true, 'een ander apparaat is wel nieuw');

  const ruw = JSON.stringify(bak);
  for (const geheim of ['sess-1', 'lid-7', 'Firefox op een Mac', 'Chrome op Windows'])
    assert.equal(ruw.includes(geheim), false, geheim + ' hoort niet leesbaar in de bak te staan');

  const v = V.lees(bak, 'sess-1');
  assert.equal(v.hoe, 'wachtwoord');
  assert.equal(v.sterkte, 'gewoon');
  assert.equal(v.vers, true, 'net gezet');
  assert.equal(V.lees(bak, 'sess-onbekend'), null, 'een onbekende sessie levert null en geen verzonnen sterkte');
});

test('7. de sterkte van de provider wordt niet verzonnen', () => {
  /* Wij weten niet hoe hard de klant zijn eigen mensen verifieert. Doen alsof
     dat "gewoon" is, zou een bewering zonder bron zijn. */
  assert.equal(V.MANIEREN.provider.sterkte, 'overgenomen');
  const bak = {};
  V.noteer(bak, 's', { hoe: 'provider', account: 'a', apparaat: 'x' });
  const u = S.beoordeel(zwaar(), V.lees(bak, 's'));
  assert.equal(u.nodig, true, 'bij een zware handeling vragen wij er zelf een moment bij');
  assert.match(u.zin, /identiteitsprovider/);
});

test('8. een onbekende manier wordt een sleutel en geen sterke sessie', () => {
  const bak = {};
  V.noteer(bak, 's', { hoe: 'iets-nieuws-dat-niemand-woog', account: 'a', apparaat: 'x' });
  const v = V.lees(bak, 's');
  assert.equal(v.sterkte, 'geen', 'de veilige kant, niet de vriendelijke');
  assert.equal(S.beoordeel(zwaar(), v).mogelijk, false);

  /* EN DE TERUGVAL AAN DE LEESKANT APART, want die is via noteer() niet te
     bereiken -- noteer normaliseert de manier al. Een mutatie op die tweede
     terugval overleefde daardoor de eerste versie van deze toets: hij dekte
     twee plekken met een pad. Zo'n regel staat er wel voor een reden: een rij
     die door een OUDERE versie is weggeschreven kan een manier dragen die dit
     huis niet meer kent, en die mag geen sterke sessie opleveren. Hier wordt
     zo'n rij met de hand neergezet. */
  const oud = { sessies: { }, apparaten: {} };
  V.noteer(oud, 's2', { hoe: 'wachtwoord', account: 'a', apparaat: 'x' });
  const sleutel = Object.keys(oud.sessies)[0];
  oud.sessies[sleutel].hoe = 'manier-uit-een-vorige-versie';
  assert.equal(V.lees(oud, 's2').sterkte, 'geen',
    'een manier die dit huis niet meer kent, telt als geen persoon');

  /* NAGEMETEN, want dit is een valkuil in de mutatiemeting zelf: de
     normalisatie in noteer() en de terugval in lees() DEKKEN ELKAAR. Zet er een
     van de twee uit en deze toets blijft groen -- niet omdat hij niets vastlegt
     maar omdat de andere wacht het overneemt. Pas met allebei tegelijk weg
     zakt hij. Dat is diepteverdediging en geen dode code, en het staat hier
     opgeschreven zodat een volgende mutatieronde die twee overlevers niet als
     een gat leest. */
});
