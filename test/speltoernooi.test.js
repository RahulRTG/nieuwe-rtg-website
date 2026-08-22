/* Toernooien: een knockout waarvan elke wedstrijd een GEWOON potje is.

   De keuze die het meeste uitlegt: een toernooi valt NIET onder de
   progressiegrens. Het is een begrensd evenement en geen blijvende stand -- het
   begint, het eindigt, en er blijft geen ranglijst van over. Ook onder de
   18+-poort mag je dus een toernooitje spelen; wat daar al niet gebeurt (de
   uitslag in de blijvende log) gebeurt hier ook niet.

   Draai los: node --test test/speltoernooi.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakSpellen = require('../server/kern/spellen');
const { BELEID } = require('../server/bewaarbeleid');
const bewaar = require('../server/bewaartermijnen');

const volwassen = (h) => !String(h).startsWith('kind');
function kern(volw = volwassen) {
  const db = { data: {} };
  return { db, k: maakSpellen({
    db, save() {}, crypto: require('crypto'), zijnVrienden: () => true, codenaamVan: (x) => 'CN-' + x,
    sseToCustomer() {}, isGeblokkeerd: () => false, socialZoek: async () => [], sociaalRate: () => true,
    volwassen: volw, sseClients: [], lidBoardUit: () => false }) };
}
const eerste = (db) => db.data.spelToernooien[0];
function vulAan(k, db, spelers) {          // iedereen zegt ja
  for (const s of spelers) k.toernooiAntwoord(s, eerste(db).id, true);
  return eerste(db);
}

test('een toernooi van vier vraagt precies drie medespelers', () => {
  const { k } = kern();
  assert.match(k.toernooiNieuw('a', { soort: 'schaak', maat: 4, spelers: ['b'] }).error, /precies 3/);
  assert.match(k.toernooiNieuw('a', { soort: 'schaak', maat: 4, spelers: ['b', 'c', 'd', 'e'] }).error, /precies 3/);
  assert.ok(k.toernooiNieuw('a', { soort: 'schaak', maat: 4, spelers: ['b', 'c', 'd'] }).ok);
});

test('een spel dat niet een tegen een kan, kan geen knockout zijn', () => {
  /* 30 Seconden heeft min 4. Dat leest deze laag uit de descriptor -- er staat
     geen spelnaam in de toernooicode. */
  const { k } = kern();
  assert.match(k.toernooiNieuw('a', { soort: 'seconden', maat: 4, spelers: ['b', 'c', 'd'] }).error,
    /niet een tegen een/);
});

test('als iedereen ja zegt begint het toernooi, met echte potjes', () => {
  const { db, k } = kern();
  k.toernooiNieuw('a', { soort: 'schaak', maat: 4, spelers: ['b', 'c', 'd'] });
  const t = vulAan(k, db, ['b', 'c', 'd']);
  assert.equal(t.status, 'bezig');
  assert.equal(t.ronde, 1);
  assert.equal(t.paren.length, 2, 'vier spelers geven twee wedstrijden');
  for (const p of t.paren) {
    const potje = db.data.spellen.potjes[p.potje];
    assert.ok(potje, 'elke wedstrijd is een echt potje');
    assert.equal(potje.status, 'bezig', 'en die is meteen begonnen');
    assert.deepEqual(potje.spelers.slice().sort(), [p.a, p.b].sort());
    assert.equal(potje.toernooi, t.id, 'het potje weet bij welk toernooi het hoort');
  }
});

test('zegt iemand nee, dan gaat het toernooi niet door met een gat', () => {
  /* Een knockout met een oneven veld vraagt een vrijlot, en dat is een
     wedstrijd die iemand wint zonder te spelen. Liever eerlijk afzeggen. */
  const { db, k } = kern();
  k.toernooiNieuw('a', { soort: 'schaak', maat: 4, spelers: ['b', 'c', 'd'] });
  const id = eerste(db).id;
  k.toernooiAntwoord('b', id, true);
  k.toernooiAntwoord('c', id, false);
  const r = k.toernooiAntwoord('d', id, true);
  assert.equal(r.afgezegd, true);
  assert.equal(eerste(db).status, 'klaar');
  assert.equal(eerste(db).winnaar, null, 'niemand wint een toernooi dat niet is gespeeld');
});

test('een gewonnen wedstrijd schuift de ronde op, en de finale levert een winnaar', () => {
  const { db, k } = kern();
  k.toernooiNieuw('a', { soort: 'schaak', maat: 4, spelers: ['b', 'c', 'd'] });
  const t = vulAan(k, db, ['b', 'c', 'd']);

  // ronde 1: in elk paar geeft speler a op, dus b wint
  const ronde1 = t.paren.map(p => ({ verliezer: p.a, winnaar: p.b, potje: p.potje }));
  for (const w of ronde1) k.spelOpgeven(w.verliezer, w.potje);

  assert.equal(t.ronde, 2, 'de tweede ronde staat klaar');
  assert.equal(t.paren.length, 1, 'en dat is de finale');
  assert.deepEqual(t.paren[0] && [t.paren[0].a, t.paren[0].b].sort(), ronde1.map(w => w.winnaar).sort(),
    'de winnaars van ronde 1 spelen de finale');

  k.spelOpgeven(t.paren[0].a, t.paren[0].potje);
  assert.equal(t.status, 'klaar');
  assert.equal(t.winnaar, t.paren[0].b, 'wie de finale wint, wint het toernooi');
});

test('een toernooi mag ook onder de 18+-grens', () => {
  /* Dit is de kern van het ontwerp: een toernooi is een begrensd evenement en
     geen stand, dus de progressiegrens raakt het niet. Wat daar al niet
     gebeurt is dat de uitslag in de blijvende log landt -- en dat blijft zo. */
  const { db, k } = kern();
  assert.ok(k.toernooiNieuw('kind1', { soort: 'schaak', maat: 4, spelers: ['kind2', 'kind3', 'kind4'] }).ok,
    'tieners mogen een schoolkampioenschap houden');
  const t = vulAan(k, db, ['kind2', 'kind3', 'kind4']);
  assert.equal(t.status, 'bezig');
  k.spelOpgeven(t.paren[0].a, t.paren[0].potje);
  assert.deepEqual(db.data.spelUitslagen || [], [], 'maar er blijft geen uitslag van staan');
});

test('je ziet alleen je eigen toernooien, en alleen je eigen wedstrijd is te openen', () => {
  const { db, k } = kern();
  k.toernooiNieuw('a', { soort: 'schaak', maat: 4, spelers: ['b', 'c', 'd'] });
  const t = vulAan(k, db, ['b', 'c', 'd']);
  const mijn = k.mijnToernooien('a').toernooien;
  assert.equal(mijn.length, 1);
  assert.deepEqual(k.mijnToernooien('vreemde').toernooien, [], 'een buitenstaander ziet niets');

  const bord = k.toernooiStaat('a', t.id).toernooi;
  const eigen = bord.paren.filter(p => p.potje);
  assert.equal(eigen.length, 1, 'alleen de wedstrijd waar je zelf in zit heeft een potje-id');
  assert.equal(k.toernooiStaat('vreemde', t.id).status, 404);
});

/* ---------- bewaren en vergeten ---------- */

test('toernooien staan in het bewaarbeleid en verlopen ook echt', () => {
  const regel = BELEID.find(r => r.tak === 'spelToernooien');
  assert.ok(regel, 'er hoort een bewaarregel te zijn');
  assert.equal(regel.vorm, 'lijst');
  assert.equal(regel.datum, 'at');
  assert.ok(regel.dagen > 0 && regel.dagen <= 366, 'geen eeuwigheid: ' + regel.dagen);

  const DAG = 86400000, geleden = (d) => new Date(Date.now() - d * DAG).toISOString();
  const db = { data: { spelToernooien: [
    { id: 'vers', at: geleden(10), spelers: ['a'] }, { id: 'oud', at: geleden(200), spelers: ['a'] }] } };
  bewaar.veeg(db, { echt: true });
  assert.deepEqual(db.data.spelToernooien.map(t => t.id), ['vers']);
});

test('een verwijderd lid laat geen toernooi met zijn sleutel achter', () => {
  const { db, k } = kern();
  k.toernooiNieuw('a', { soort: 'schaak', maat: 4, spelers: ['weg', 'c', 'd'] });
  vulAan(k, db, ['weg', 'c', 'd']);
  k.spelVergeet('weg');
  const tekst = JSON.stringify(db.data.spelToernooien || []);
  assert.equal(tekst.includes('"weg"'), false, 'zijn sleutel staat nergens meer: ' + tekst);
});

/* ---------- de twee vormen, en wat er bij een gelijkspel gebeurt ----------
   Hier praten we rechtstreeks met de module, met een nagemaakte `potjeDirect`.
   Reden: een remise is via `opgeven` niet te maken -- wie opgeeft verliest --
   en juist het overspelen is de regel die getoetst moet worden. */
const maakToernooi = require('../server/kern/spellen/toernooi');

function losseModule() {
  const db = { data: { spellen: { potjes: {}, wachtrij: {} } } };
  let n = 0;
  const potjeDirect = (soort, spelers, extra) => {
    const p = Object.assign({ id: 'potje' + (++n), soort, spelers: spelers.slice(), status: 'bezig',
      winnaar: null, gelijk: false }, extra);
    db.data.spellen.potjes[p.id] = p;
    return p;
  };
  const t = maakToernooi({ db, save() {}, rid: () => 'T' + (++n), nu: () => new Date().toISOString(),
    codenaamVan: (k) => 'CN-' + k, isGeblokkeerd: () => false,
    SPEL: { schaak: { naam: 'Schaken', max: 2, wereld: 'rtg' } }, SOORTEN: { schaak: 'Schaken' },
    schud: (a) => a, potjeDirect, leeftijdFout: () => null, nudge() {} });
  return { db, potjeDirect, ...t };
}
const klaar = (db, id, winnaar, gelijk) => {
  const p = db.data.spellen.potjes[id];
  p.status = 'klaar'; p.winnaar = winnaar ? 'CN-' + winnaar : null; p.gelijk = !!gelijk;
  return p;
};

test('een gelijkspel in een knockout wordt overgespeeld, tot er een winnaar is', () => {
  const m = losseModule();
  m.toernooiNieuw('a', { soort: 'schaak', maat: 4, vorm: 'knockout', spelers: ['b', 'c', 'd'] });
  const t = m.db.data.spelToernooien[0];
  ['b', 'c', 'd'].forEach(x => m.toernooiAntwoord(x, t.id, true));
  const paar = t.paren[0], eerste = paar.potje;

  m.toernooiPotjeKlaar(klaar(m.db, eerste, null, true));
  assert.notEqual(t.paren[0].potje, eerste, 'er staat een NIEUWE wedstrijd tussen dezelfde twee');
  assert.equal(t.paren[0].winnaar, null, 'en nog steeds geen winnaar');
  assert.equal(t.paren[0].overgespeeld, 1);
  assert.deepEqual(m.db.data.spellen.potjes[t.paren[0].potje].spelers.slice().sort(), [paar.a, paar.b].sort());

  // ook de tweede remise wordt overgespeeld: er is geen bovengrens
  m.toernooiPotjeKlaar(klaar(m.db, t.paren[0].potje, null, true));
  assert.equal(t.paren[0].overgespeeld, 2, 'onbegrensd overspelen is de gekozen regel');

  m.toernooiPotjeKlaar(klaar(m.db, t.paren[0].potje, paar.b, false));
  assert.equal(t.paren[0].winnaar, paar.b, 'pas een echte winnaar sluit de wedstrijd');
});

test('een toernooi loopt niet eeuwig vast als de wedstrijd verdwijnt', () => {
  /* Dat is het risico van "overspelen tot er een winnaar is": een verlaten
     partij wordt na dertig dagen opgeruimd, en dan wacht het toernooi op een
     uitslag die nooit komt. */
  const m = losseModule();
  m.toernooiNieuw('a', { soort: 'schaak', maat: 4, vorm: 'knockout', spelers: ['b', 'c', 'd'] });
  const t = m.db.data.spelToernooien[0];
  ['b', 'c', 'd'].forEach(x => m.toernooiAntwoord(x, t.id, true));
  delete m.db.data.spellen.potjes[t.paren[0].potje];      // alsof opschonen langs is geweest

  const bord = m.toernooiStaat('a', t.id).toernooi;
  assert.equal(bord.status, 'klaar');
  assert.equal(bord.afgebroken, true, 'afgebroken, en niet stil blijven wachten');
  assert.equal(bord.winnaar, null, 'niemand wint een toernooi dat niet is uitgespeeld');
});

test('round robin: iedereen tegen iedereen, winst 3 en gelijk 1', () => {
  const m = losseModule();
  m.toernooiNieuw('a', { soort: 'schaak', maat: 3, vorm: 'roundrobin', spelers: ['b', 'c'] });
  const t = m.db.data.spelToernooien[0];
  ['b', 'c'].forEach(x => m.toernooiAntwoord(x, t.id, true));
  assert.equal(t.paren.length, 3, 'drie spelers geven drie wedstrijden');

  // a wint van b, a wint van c, b en c spelen gelijk
  const paar = (x, y) => t.paren.find(p => [p.a, p.b].sort().join() === [x, y].sort().join());
  m.toernooiPotjeKlaar(klaar(m.db, paar('a', 'b').potje, 'a', false));
  m.toernooiPotjeKlaar(klaar(m.db, paar('a', 'c').potje, 'a', false));
  m.toernooiPotjeKlaar(klaar(m.db, paar('b', 'c').potje, null, true));

  assert.equal(t.status, 'klaar');
  assert.equal(t.winnaar, 'a');
  const stand = m.toernooiStaat('a', t.id).toernooi.stand;
  assert.deepEqual(stand.map(r => [r.codenaam, r.punten]),
    [['CN-a', 6], ['CN-b', 1], ['CN-c', 1]], 'winst 3, gelijk 1');
});

test('gelijk aan de top blijft gelijk: er wordt geen winnaar verzonnen', () => {
  /* Een tweede criterium bedenken zou een winnaar aanwijzen die niemand heeft
     afgesproken. Liever gedeeld. */
  const m = losseModule();
  m.toernooiNieuw('a', { soort: 'schaak', maat: 3, vorm: 'roundrobin', spelers: ['b', 'c'] });
  const t = m.db.data.spelToernooien[0];
  ['b', 'c'].forEach(x => m.toernooiAntwoord(x, t.id, true));
  for (const p of t.paren) m.toernooiPotjeKlaar(klaar(m.db, p.potje, null, true));   // alles gelijk
  assert.equal(t.status, 'klaar');
  assert.equal(t.winnaar, null);
  assert.equal(t.gedeeld, true);
});

test('de vorm bepaalt hoeveel spelers er mogen meedoen', () => {
  const m = losseModule();
  // knockout kent alleen machten van twee; 3 valt terug op de eerste maat (4)
  m.toernooiNieuw('a', { soort: 'schaak', maat: 3, vorm: 'knockout', spelers: ['b', 'c', 'd'] });
  assert.equal(m.db.data.spelToernooien[0].maat, 4, 'knockout met drie bestaat niet');
  // round robin mag wel met drie
  m.toernooiNieuw('a', { soort: 'schaak', maat: 3, vorm: 'roundrobin', spelers: ['b', 'c'] });
  assert.equal(m.db.data.spelToernooien[1].maat, 3);
});
