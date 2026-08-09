/* Uitslagen die een potje overleven -- de bron onder winrate, niveaus en
   toernooien, die er tot nu toe niet was (een klaar potje werd na 24 uur
   weggegooid).

   De regel die het meeste werk doet: de progressiegrens geldt ook voor het
   BEWAREN. Een partij wordt vastgelegd, maar alleen deelnemers binnen de grens
   staan er met codenaam in; speelde niemand binnen de grens mee, dan wordt er
   niets bewaard. Zo raakt een volwassene zijn historie niet kwijt zodra hij met
   een tiener speelt, en bouwt het systeem toch geen profiel van die tiener op.

   Draai los: node --experimental-sqlite --test test/speluitslagen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakUitslagen = require('../server/kern/spellen/uitslagen');
const { BELEID } = require('../server/bewaarbeleid');
const bewaar = require('../server/bewaartermijnen');

// alles wat niet met 'kind' begint is volwassen; zo is de grens in een oogopslag te lezen
const volwassen = (h) => !String(h).startsWith('kind');
function maak(extra = {}) {
  const db = { data: {} };
  const laag = maakUitslagen(Object.assign({
    db, save() {}, codenaamVan: (k) => 'CN-' + k,
    nu: () => '2026-08-09T12:00:00.000Z', progressieMag: volwassen
  }, extra));
  return { db, ...laag };
}
const potje = (o = {}) => Object.assign({
  id: 'p1', soort: 'schaak', modus: 'vrij', status: 'klaar',
  spelers: ['anna', 'boris'], winnaar: 'CN-anna', gelijk: false
}, o);

test('een afgelopen potje wordt vastgelegd, met wie er won', () => {
  const u = maak();
  u.noteerUitslag(potje());
  assert.equal(u.db.data.spelUitslagen.length, 1);
  const r = u.db.data.spelUitslagen[0];
  assert.equal(r.soort, 'schaak');
  assert.deepEqual(r.spelers.map(s => [s.codenaam, s.won]), [['CN-anna', true], ['CN-boris', false]]);
});

test('een potje dat nog loopt wordt niet vastgelegd', () => {
  const u = maak();
  u.noteerUitslag(potje({ status: 'bezig' }));
  assert.equal(u.db.data.spelUitslagen, undefined, 'er hoort nog niets te staan');
});

test('twee keer noteren geeft een uitslag, geen twee', () => {
  /* Hij wordt aangeroepen vanuit zowel een winnende zet als opgeven; zonder
     die vlag zou een herhaalde aanroep dezelfde partij dubbel in de stand
     zetten en telt iemand een overwinning te veel. */
  const u = maak();
  const p = potje();
  u.noteerUitslag(p);
  u.noteerUitslag(p);
  assert.equal(u.db.data.spelUitslagen.length, 1);
});

test('een gelijkspel kent geen winnaar', () => {
  const u = maak();
  u.noteerUitslag(potje({ gelijk: true, winnaar: null }));
  assert.deepEqual(u.db.data.spelUitslagen[0].spelers.map(s => s.won), [false, false]);
  assert.equal(u.db.data.spelUitslagen[0].gelijk, true);
});

test('bij teams winnen twee spelers samen', () => {
  /* potje.winnaar is een WEERGAVETEKST met ' & ' ertussen. Terugrekenen naar
     sleutels mag exact, want die tekst is gemaakt door codenaamVan los te
     laten op precies deze spelers -- er wordt niets geraden. */
  const u = maak();
  u.noteerUitslag(potje({ soort: 'mejn', modus: 'teams', spelers: ['anna', 'boris', 'chris', 'dana'],
    winnaar: 'CN-anna & CN-chris' }));
  assert.deepEqual(u.db.data.spelUitslagen[0].spelers.map(s => [s.codenaam, s.won]),
    [['CN-anna', true], ['CN-boris', false], ['CN-chris', true], ['CN-dana', false]]);
});

/* ---------- de progressiegrens, bij het BEWAREN ---------- */

test('een deelnemer onder de grens staat er zonder codenaam in', () => {
  const u = maak();
  u.noteerUitslag(potje({ spelers: ['anna', 'kind1'] }));
  const r = u.db.data.spelUitslagen[0];
  assert.deepEqual(r.spelers[0], { key: 'anna', codenaam: 'CN-anna', won: true });
  assert.deepEqual(r.spelers[1], { anoniem: true, won: false }, 'geen sleutel en geen codenaam');
  assert.equal(JSON.stringify(r).includes('kind1'), false, 'de sleutel van het kind reist nergens mee');
});

test('speelde niemand binnen de grens mee, dan komt er niets bij', () => {
  /* Een potje tussen tieners onderling laat geen enkel spoor na -- ook niet
     anoniem. Gemeten als "de lijst groeit niet" en niet als "de lijst is leeg":
     dat tweede zou ook slagen op een lijst die nooit is aangemaakt, en dan
     toetst het niets zodra er al partijen in staan. */
  const u = maak();
  u.noteerUitslag(potje({ id: 'volwassen', spelers: ['anna', 'boris'] }));
  const voor = u.db.data.spelUitslagen.length;
  u.noteerUitslag(potje({ id: 'tieners', spelers: ['kind1', 'kind2'], winnaar: 'CN-kind1' }));
  assert.equal(u.db.data.spelUitslagen.length, voor, 'er hoort niets bij te zijn gekomen');
  assert.equal(JSON.stringify(u.db.data.spelUitslagen).includes('tieners'), false,
    'ook het potje-id van een partij tussen tieners hoort nergens te staan');
});

test('de volwassene houdt zijn historie ook als hij met een tiener speelde', () => {
  /* Dit is waarom deelnemers anoniem worden in plaats van dat de hele partij
     wegvalt: anders zou samen spelen zichzelf uitwissen. */
  const u = maak();
  u.noteerUitslag(potje({ spelers: ['anna', 'kind1'] }));
  const r = u.spelUitslagen('anna');
  assert.equal(r.uitslagen.length, 1);
  assert.equal(r.uitslagen[0].ik, true, 'anna won');
  assert.deepEqual(r.uitslagen[0].tegen, [{ codenaam: null, won: false }], 'de ander is een medespeler zonder naam');
});

test('onder de grens is er geen historie om te lezen', () => {
  const u = maak();
  u.noteerUitslag(potje({ spelers: ['anna', 'kind1'] }));
  const r = u.spelUitslagen('kind1');
  assert.deepEqual(r.uitslagen, []);
  assert.equal(r.progressie, false);
  assert.match(r.reden, /geverifieerde volwassen leeftijd/);
});

test('je ziet alleen je eigen partijen', () => {
  const u = maak();
  u.noteerUitslag(potje({ id: 'p1', spelers: ['anna', 'boris'] }));
  u.noteerUitslag(potje({ id: 'p2', spelers: ['chris', 'dana'], winnaar: 'CN-chris' }));
  assert.deepEqual(u.spelUitslagen('anna').uitslagen.map(x => x.id), ['p1']);
  assert.deepEqual(u.spelUitslagen('chris').uitslagen.map(x => x.id), ['p2']);
});

test('de nieuwste partij staat bovenaan en het aantal is begrensd', () => {
  const u = maak();
  for (let i = 0; i < 40; i++) u.noteerUitslag(potje({ id: 'p' + i }));
  const r = u.spelUitslagen('anna', 5);
  assert.equal(r.uitslagen.length, 5);
  assert.equal(r.uitslagen[0].id, 'p39', 'de laatste partij eerst');
  assert.equal(u.spelUitslagen('anna').uitslagen.length, 25, 'zonder aantal: vijfentwintig');
  assert.equal(u.spelUitslagen('anna', 9999).uitslagen.length, 40, 'en een absurd aantal wordt afgekapt op honderd');
});

/* ---------- de bewaartermijn ---------- */

test('uitslagen staan in het bewaarbeleid en verlopen dus', () => {
  /* `db.data.spelUitslagen` staat op het HOOGSTE niveau en niet genest onder
     `spellen`, precies omdat de bewaarmotor `db.data[tak]` leest. Stond hij
     genest, dan viel hij buiten het beleid en kwam hij op de lijst
     zonderBeleid() -- gegevens met codenamen die nooit verlopen. */
  const regel = BELEID.find(r => r.tak === 'spelUitslagen');
  assert.ok(regel, 'er hoort een bewaarregel voor spelUitslagen te zijn');
  assert.equal(regel.vorm, 'lijst');
  assert.equal(regel.datum, 'at', 'de motor moet weten welk veld de datum is');
  assert.ok(regel.dagen > 0 && regel.dagen <= 366, 'een jaar of korter, geen eeuwigheid: ' + regel.dagen);
  assert.ok(regel.waarom && regel.waarom.length > 10, 'met een reden erbij');
});

test('de bewaarmotor veegt oude uitslagen ook echt weg', () => {
  /* De toets hierboven eist dat de REGEL bestaat. Dat is niet hetzelfde als
     dat hij werkt: een regel met de verkeerde `vorm` of een `datum` die niet
     bestaat wordt door de motor stil overgeslagen, en dan staat er beleid op
     papier terwijl er niets verloopt. Daarom hier de motor zelf, op een verse
     en een verlopen partij. */
  const DAG = 86400000;
  const geleden = (d) => new Date(Date.now() - d * DAG).toISOString();
  const rij = (id, dagen) => ({ id, at: geleden(dagen), soort: 'schaak',
    spelers: [{ key: 'anna', codenaam: 'CN-anna', won: true }] });
  const db = { data: { spelUitslagen: [rij('vers', 30), rij('oud', 400)] } };

  bewaar.veeg(db, { echt: true });
  assert.deepEqual(db.data.spelUitslagen.map(r => r.id), ['vers'],
    'een partij van meer dan een jaar terug hoort weg te zijn, een verse te blijven');

  // en de tak staat niet op de lijst van takken zonder beleid
  const zonder = bewaar.zonderBeleid({ data: { spelUitslagen: [rij('x', 1)] } }) || [];
  assert.deepEqual(zonder.filter(t => String(t).includes('spelUitslagen')), [],
    'spelUitslagen hoort niet op de lijst zonderBeleid te staan');
});
