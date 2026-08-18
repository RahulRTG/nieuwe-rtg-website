/* Prestaties, afgeleid uit de uitslagen. Drie keuzes maken dit anders dan een
   gewoon prestatiesysteem, en die staan hier alle drie als toets omdat ze
   anders stil terugdraaien: alleen wat BEHAALD is gaat terug (geen "7 van de
   10", geen lijst van wat je nog kunt halen), er zijn geen reeksen, en het
   venster is dat van de log -- dus een prestatie kan weer verdwijnen.

   Draai los: node --experimental-sqlite --test test/spelprestaties.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakUitslagen = require('../server/kern/spellen/uitslagen');
const maakPrestaties = require('../server/kern/spellen/prestaties');

const volwassen = (h) => !String(h).startsWith('kind');
function maak() {
  const db = { data: {} };
  const u = maakUitslagen({ db, save() {}, codenaamVan: (k) => 'CN-' + k,
    nu: () => new Date().toISOString(), progressieMag: volwassen });
  const p = maakPrestaties({ spelStand: u.spelStand, naamVanSpel: (s) => ({ schaak: 'Schaken', woord: 'Woordduel' })[s] || s });
  return { db, ...u, ...p };
}
// n partijen van een soort, waarvan `winst` gewonnen door anna
function speel(u, soort, n, winst) {
  for (let i = 0; i < n; i++) u.noteerUitslag({ id: soort + i, soort, modus: 'vrij', status: 'klaar',
    spelers: ['anna', 'boris'], winnaar: i < winst ? 'CN-anna' : 'CN-boris', gelijk: false });
}
const sleutels = (r) => r.prestaties.map(p => p.sleutel).sort();

test('een behaalde prestatie komt terug, met het spel erbij', () => {
  const u = maak();
  speel(u, 'schaak', 1, 1);
  const r = u.spelPrestaties('anna');
  assert.deepEqual(sleutels(r), ['eerste-winst:schaak']);
  assert.equal(r.prestaties[0].spel, 'Schaken', 'op naam, niet op sleutel');
  assert.ok(r.prestaties[0].uitleg, 'met uitleg erbij');
});

test('wat je NIET hebt behaald reist niet mee, en er is geen voortgang', () => {
  /* "3 van de 12" is een voortgangsbalk met een andere naam, en een doel dat
     je niet zelf hebt gekozen is precies de por die dit huis niet bouwt. */
  const u = maak();
  speel(u, 'schaak', 1, 1);
  const r = u.spelPrestaties('anna');
  assert.equal(r.prestaties.length, 1, 'alleen de behaalde');
  const tekst = JSON.stringify(r);
  assert.equal(/totaal|mogelijk|voortgang|van de|nog\b/i.test(tekst), false,
    'er hoort niets in te staan over wat je nog kunt of moet halen: ' + tekst);
});

test('per spel telt apart, en over alles heen telt ook', () => {
  const u = maak();
  speel(u, 'schaak', 10, 25);        // tien partijen, allemaal gewonnen
  speel(u, 'woord', 1, 1);
  const r = sleutels(u.spelPrestaties('anna'));
  assert.ok(r.includes('tien-partijen:schaak'), 'tien partijen schaak');
  assert.ok(r.includes('eerste-winst:woord'), 'en de eerste winst bij woordduel');
  assert.ok(!r.includes('tien-partijen:woord'), 'maar niet bij een spel waar het niet geldt');
});

test('allrounder vraagt vijf verschillende spellen', () => {
  const u = maak();
  for (const s of ['schaak', 'woord', 'dam', 'rummi']) speel(u, s, 1, 1);
  assert.ok(!sleutels(u.spelPrestaties('anna')).includes('allrounder'), 'vier is nog niet genoeg');
  speel(u, 'pesten', 1, 1);
  assert.ok(sleutels(u.spelPrestaties('anna')).includes('allrounder'), 'vijf wel');
});

test('een prestatie kan weer verdwijnen als de partijen eronder weg zijn', () => {
  /* Dat is geen fout maar het punt: het venster is dat van de log, en een
     stand die kan zakken is iets anders dan een ratel die alleen omhoog gaat. */
  const u = maak();
  speel(u, 'schaak', 10, 10);
  assert.ok(sleutels(u.spelPrestaties('anna')).includes('tien-partijen:schaak'));
  u.db.data.spelUitslagen = u.db.data.spelUitslagen.slice(0, 3);   // alsof de rest verlopen is
  assert.ok(!sleutels(u.spelPrestaties('anna')).includes('tien-partijen:schaak'), 'weer weg');
  assert.ok(sleutels(u.spelPrestaties('anna')).includes('eerste-winst:schaak'), 'wat nog wel telt blijft');
});

test('er bestaan geen reeksen', () => {
  // "vijf dagen achter elkaar" straft een dag overslaan; spelen hoort geen
  // verplichting te worden
  const { _PRESTATIES } = maak();
  const tekst = JSON.stringify(_PRESTATIES.map(p => [p.sleutel, p.naam, p.uitleg]));
  assert.equal(/reeks|streak|op rij|achter elkaar|dagen achtereen/i.test(tekst), false,
    'geen enkele prestatie hoort over een reeks te gaan: ' + tekst);
});

test('onder de progressiegrens bestaan er geen prestaties', () => {
  const u = maak();
  u.noteerUitslag({ id: 'p1', soort: 'schaak', modus: 'vrij', status: 'klaar',
    spelers: ['anna', 'kind1'], winnaar: 'CN-kind1', gelijk: false });
  const r = u.spelPrestaties('kind1');
  assert.deepEqual(r.prestaties, []);
  assert.equal(r.progressie, false);
  assert.match(r.reden, /identiteitsbewijs heeft gezien/);
});

test('het venster reist mee, zodat het scherm het kan zeggen', () => {
  const u = maak();
  speel(u, 'schaak', 1, 1);
  assert.equal(u.spelPrestaties('anna').vensterDagen, u.spelStand('anna').vensterDagen);
});
