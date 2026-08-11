/* De klok per beurt: tempo, verlopen, toewijzen en de vervaltermijn.

   Wat hier bewaakt wordt is niet "telt hij goed af" maar de vier BESLUITEN uit
   de kop van server/kern/spellen/klok.js:

   1. een tempo mag alleen op een spel dat async KAN (`vormen`);
   2. de klok verloopt naar een AANBOD -- er gebeurt niets vanzelf, behalve in
      een toernooiwedstrijd;
   3. toewijzen loopt langs `spelOpgeven`, zodat er maar EEN plek is die een
      potje beeindigt (en de uitslag dus vanzelf klopt);
   4. de vervaltermijn volgt het tempo, met de oude dertig dagen als bodem.

   Draai los: node --experimental-sqlite --test test/spelklok.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakSpellen = require('../server/kern/spellen');
const maakKlok = require('../server/kern/spellen/klok');

function opstelling() {
  const db = { data: { spellen: { potjes: {}, wachtrij: {} } } };
  const kern = maakSpellen({ db, save() {}, crypto: require('crypto'), zijnVrienden: () => true,
    codenaamVan: (x) => 'CN-' + x, sseToCustomer() {}, isGeblokkeerd: () => false,
    socialZoek: async () => [], sociaalRate: () => true, volwassen: () => true,
    sseClients: [], lidBoardUit: () => false });
  return { db, kern };
}

// een lopend potje met een klok die AL verlopen is
function verlopenPotje(db, { soort = 'schaak', tempo = '24u', toernooi = null } = {}) {
  const p = { id: 'p1', soort, modus: 'vrij', spelers: ['a', 'b'], uitgenodigd: [], beurt: 0,
    teams: [0, 1], status: 'bezig', winnaar: null, at: new Date().toISOString(), tempo,
    beurtTot: new Date(Date.now() - 1000).toISOString() };
  if (toernooi) p.toernooi = toernooi;
  const REG = require('../server/kern/spellen/register')({ save() {}, crypto: require('crypto'),
    schud: (a) => a, beurtDoor() {}, codenaamVan: (x) => x, nudge() {} });
  REG.INITS[soort](p);
  db.data.spellen.potjes.p1 = p;
  return p;
}

/* ---------- 1. het tempo hoort bij het spel ---------- */

test('een tempo kan alleen bij een spel dat async kan', async () => {
  const o = opstelling();
  const goed = await o.kern.spelNieuw('a', { soort: 'schaak', vrienden: ['b'], wereld: 'rtg', tempo: '24u' });
  assert.equal(goed.status, 200, 'schaken draagt async, dus 24 uur per beurt mag');

  /* Reactieduel niet: dat is een reflexspel, en 24 uur per beurt maakt er iets
     anders van. De weigering leest `vormen` uit de descriptor en kent geen
     spelnaam -- er staat dus nergens een lijst die kan verouderen. */
  const fout = await o.kern.spelNieuw('a', { soort: 'reactie', vrienden: ['b'], wereld: 'rtf', tempo: '24u' });
  assert.equal(fout.status, 400);
  assert.match(fout.error, /live/);
});

test('een tempo dat niet bestaat wordt geweigerd', async () => {
  const o = opstelling();
  const r = await o.kern.spelNieuw('a', { soort: 'schaak', vrienden: ['b'], wereld: 'rtg', tempo: '3 weken' });
  assert.equal(r.status, 400);
  assert.match(r.error, /bestaat niet/);
});

test('geen tempo is gewoon goed: een potje zonder klok blijft wat het was', async () => {
  const o = opstelling();
  const r = await o.kern.spelNieuw('a', { soort: 'reactie', vrienden: ['b'], wereld: 'rtf' });
  assert.equal(r.status, 200);
  assert.equal(o.db.data.spellen.potjes[r.id].tempo, null);
});

/* ---------- 2. verlopen doet uit zichzelf niets ---------- */

test('een verlopen klok beeindigt de partij NIET uit zichzelf', () => {
  /* Het besluit uit de kop: verlies-door-tijd is hard in een vriendenpotje.
     De partij blijft dus gewoon staan tot iemand hem opeist. */
  const o = opstelling();
  verlopenPotje(o.db);
  o.kern.mijnSpellen('a');                       // dit draait opschonen()
  assert.equal(o.db.data.spellen.potjes.p1.status, 'bezig', 'de partij loopt nog');
  assert.equal(o.db.data.spellen.potjes.p1.winnaar, null);
});

test('een toernooiwedstrijd verloopt WEL vanzelf', () => {
  /* De uitzondering, en de reden staat erbij: in een toernooi houdt een hele
     ronde stil terwijl iemand niet komt opdagen, en de uitslag hangt aan een
     afspraak die vooraf gemaakt is. */
  const o = opstelling();
  verlopenPotje(o.db, { toernooi: 't1' });
  o.kern.mijnSpellen('a');
  const p = o.db.data.spellen.potjes.p1;
  assert.equal(p.status, 'klaar', 'de wedstrijd is afgemaakt');
  assert.equal(p.winnaar, 'CN-b', 'de speler die er wel was heeft gewonnen');
});

/* ---------- 3. toewijzen ---------- */

test('wie wacht mag de partij opeisen zodra de klok verliep', () => {
  const o = opstelling();
  verlopenPotje(o.db);
  const r = o.kern.spelToewijzen('b', 'p1');     // 'a' is aan zet en kwam niet
  assert.equal(r.status, 200);
  assert.equal(o.db.data.spellen.potjes.p1.winnaar, 'CN-b');
});

test('je kunt je EIGEN verlopen klok niet gebruiken om de partij op te eisen', () => {
  /* De enige controle hier die echt iets tegenhoudt: anders laat je je eigen
     beurt verlopen en wint je daarmee de partij. */
  const o = opstelling();
  verlopenPotje(o.db);
  const r = o.kern.spelToewijzen('a', 'p1');     // 'a' is zelf aan zet
  assert.equal(r.status, 409);
  assert.match(r.error, /aan zet/);
});

test('toewijzen kan niet zolang de klok loopt', () => {
  const o = opstelling();
  const p = verlopenPotje(o.db);
  p.beurtTot = new Date(Date.now() + 3600000).toISOString();   // nog een uur
  const r = o.kern.spelToewijzen('b', 'p1');
  assert.equal(r.status, 409);
  assert.match(r.error, /klok loopt nog/);
});

test('toewijzen kan niet in een potje zonder klok', () => {
  const o = opstelling();
  const p = verlopenPotje(o.db);
  p.tempo = null; p.beurtTot = null;
  const r = o.kern.spelToewijzen('b', 'p1');
  assert.equal(r.status, 409);
  assert.match(r.error, /geen klok/);
});

test('een toegewezen partij landt in de uitslagen, net als opgeven', () => {
  /* Dit is waarom toewijzen langs `spelOpgeven` loopt en geen eigen einde
     heeft: de uitslag, het toernooi en het sein hangen daar al aan. Een tweede
     manier om een potje te beeindigen is een tweede plek waar dat vergeten kan
     worden. */
  const o = opstelling();
  verlopenPotje(o.db);
  o.kern.spelToewijzen('b', 'p1');
  const uit = o.kern.spelUitslagen('b');
  assert.equal(uit.uitslagen.length, 1, 'de partij staat in de uitslagen');
  assert.equal(uit.uitslagen[0].ik, true, 'en b heeft hem gewonnen');
  assert.equal(uit.uitslagen[0].soort, 'schaak');
});

/* ---------- 4. de klok loopt met de zetten mee ---------- */

test('elke geaccepteerde zet zet de klok opnieuw', async () => {
  const o = opstelling();
  const r = await o.kern.spelNieuw('a', { soort: 'schaak', vrienden: ['b'], wereld: 'rtg', tempo: '15m' });
  o.kern.spelAntwoord('b', r.id, true);
  const p = o.db.data.spellen.potjes[r.id];
  const eerste = p.beurtTot;
  assert.ok(eerste, 'bij het starten begint de eerste beurt');
  p.beurtTot = new Date(Date.now() - 1000).toISOString();       // kunstmatig verlopen
  o.kern.spelZet('a', r.id, { van: 52, naar: 36 });             // pion twee vooruit
  assert.ok(new Date(p.beurtTot).getTime() > Date.now(), 'na een zet loopt de klok weer');
});

test('een geweigerde zet zet de klok NIET opnieuw', () => {
  /* Anders koop je tijd met een zet die niet mag: eindeloos een ongeldige zet
     insturen zou je beurt oneindig verlengen. */
  const o = opstelling();
  const p = verlopenPotje(o.db, { tempo: '15m' });
  const voor = p.beurtTot;
  const r = o.kern.spelZet('a', 'p1', { van: 0, naar: 63 });
  assert.ok(r.error, 'die zet kan niet');
  assert.equal(p.beurtTot, voor, 'en de klok is niet verzet');
});

/* ---------- 5. de vervaltermijn ---------- */

test('de vervaltermijn is tien gemiste beurten, met dertig dagen als bodem', () => {
  const klok = maakKlok({ get SPEL() { return {}; } });
  const DAG = 86400000;
  assert.equal(klok.vervalMs({}), 30 * DAG, 'zonder klok precies zoals het was');
  for (const [tempo, ms] of Object.entries(maakKlok.TEMPO)) {
    const v = klok.vervalMs({ tempo });
    assert.ok(v >= 10 * ms, tempo + ': minstens tien gemiste beurten');
    assert.ok(v >= 30 * DAG, tempo + ': en nooit onder de oude bodem');
  }
});

test('bij elk BESTAAND tempo wint de bodem, en dat is hier geen bug', () => {
  /* Deze toets legt vast wat er vandaag werkelijk gebeurt, en niet wat ik eerst
     dacht dat er gebeurde. `10 x 72 uur` is toevallig exact dertig dagen, dus de
     formule geeft bij elk tempo dat we hebben hetzelfde antwoord als de vaste
     maand die er stond -- de naad is uitgesproken, het gedrag is ongewijzigd.

     Verandert dat ooit (een tempo boven 72 uur), dan zakt deze toets en is dat
     precies het moment om te kijken of de langere termijn ook echt gewenst is. */
  const klok = maakKlok({ get SPEL() { return {}; } });
  const DAG = 86400000;
  for (const tempo of Object.keys(maakKlok.TEMPO))
    assert.equal(klok.vervalMs({ tempo }), 30 * DAG, tempo + ' hoort vandaag op de bodem uit te komen');
});

test('een partij die stilligt verdwijnt nog steeds, ook met een klok', () => {
  /* De andere kant van dezelfde regel: de klok maakt een verlaten partij niet
     onsterfelijk. Eenendertig dagen zonder dat iemand iets doet is verlaten,
     bij welk tempo dan ook. */
  const o = opstelling();
  const p = verlopenPotje(o.db, { soort: 'magnaat', tempo: '72u' });
  p.zetAt = new Date(Date.now() - 31 * 86400000).toISOString();
  o.kern.mijnSpellen('a');
  assert.equal(o.db.data.spellen.potjes.p1, undefined, 'de partij is opgeruimd');
});

test('een partij die nog gespeeld wordt blijft staan', () => {
  const o = opstelling();
  const p = verlopenPotje(o.db, { soort: 'magnaat', tempo: '72u' });
  p.zetAt = new Date(Date.now() - 3 * 86400000).toISOString();   // de langste legitieme stilte
  o.kern.mijnSpellen('a');
  assert.ok(o.db.data.spellen.potjes.p1, 'drie dagen is een beurt, geen verlating');
});
