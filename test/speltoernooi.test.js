/* Toernooien: een knockout waarvan elke wedstrijd een GEWOON potje is.

   De keuze die het meeste uitlegt: een toernooi valt NIET onder de
   progressiegrens. Het is een begrensd evenement en geen blijvende stand -- het
   begint, het eindigt, en er blijft geen ranglijst van over. Ook onder de
   18+-poort mag je dus een toernooitje spelen; wat daar al niet gebeurt (de
   uitslag in de blijvende log) gebeurt hier ook niet.

   Draai los: node --experimental-sqlite --test test/speltoernooi.test.js */
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
