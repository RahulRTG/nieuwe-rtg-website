/* Uitslagen die een potje overleven -- de bron onder winrate, niveaus en
   toernooien, die er tot nu toe niet was (een klaar potje werd na 24 uur
   weggegooid).

   De regel die het meeste werk doet: de progressiegrens geldt ook voor het
   BEWAREN. Een partij wordt vastgelegd, maar alleen deelnemers binnen de grens
   staan er met codenaam in; speelde niemand binnen de grens mee, dan wordt er
   niets bewaard. Zo raakt een volwassene zijn historie niet kwijt zodra hij met
   een tiener speelt, en bouwt het systeem toch geen profiel van die tiener op.

   Draai los: node --test test/speluitslagen.test.js */
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

/* ---------- het recht op vergetelheid ----------
   Een uitslagenlijst met sleutels en codenamen erin is persoonsdata, en die
   moet wisbaar zijn. test/vergeten.test.js veegt door ELKE tak van db.json en
   faalt als de sleutel of codenaam van een verwijderd lid er nog in staat --
   deze tak zou daar dus doorheen zijn gevallen als hij niet in het beleid was
   gezet. Dat gat was er echt: de tak is eerst gebouwd en pas daarna aan
   vergeten/anoniem.js toegevoegd. */
const maakAnoniem = require('../server/kern/vergeten/anoniem');

test('een verwijderd lid verdwijnt uit de uitslagen, de partij van de ander blijft', () => {
  const u = maak();
  u.noteerUitslag(potje({ id: 'p1', spelers: ['anna', 'boris'] }));
  maakAnoniem({ db: u.db, accounts: {} }).anonimiseer('anna', 'CN-anna', null);

  const r = u.db.data.spelUitslagen[0];
  assert.ok(r, 'de partij blijft bestaan voor boris');
  assert.deepEqual(r.spelers[0], { anoniem: true, won: true }, 'anna is eruit, haar uitslag niet');
  assert.deepEqual(r.spelers[1], { key: 'boris', codenaam: 'CN-boris', won: false });
  const tekst = JSON.stringify(u.db.data.spelUitslagen);
  assert.equal(tekst.includes('anna'), false, 'sleutel noch codenaam blijft achter');
});

test('blijft er niemand met naam over, dan gaat de hele partij weg', () => {
  // een rij waarin niemand meer staat is voor niemand nog historie
  const u = maak();
  u.noteerUitslag(potje({ id: 'metKind', spelers: ['anna', 'kind1'] }));
  maakAnoniem({ db: u.db, accounts: {} }).anonimiseer('anna', 'CN-anna', null);
  assert.deepEqual(u.db.data.spelUitslagen, [], 'de laatste genoemde speler weg = de rij weg');
});

test('het wissen van het ene lid raakt de partijen van een ander niet', () => {
  const u = maak();
  u.noteerUitslag(potje({ id: 'p1', spelers: ['anna', 'boris'] }));
  u.noteerUitslag(potje({ id: 'p2', spelers: ['chris', 'dana'], winnaar: 'CN-chris' }));
  maakAnoniem({ db: u.db, accounts: {} }).anonimiseer('anna', 'CN-anna', null);
  assert.deepEqual(u.spelUitslagen('chris').uitslagen.map(x => x.id), ['p2'], 'chris houdt zijn historie');
  assert.deepEqual(u.spelUitslagen('boris').uitslagen.map(x => x.id), ['p1'], 'en boris ook');
});

/* ---------- de stand: afgeleid, niet bijgehouden ---------- */

test('de stand telt per spel wat je speelde, won, verloor en gelijk hield', () => {
  const u = maak();
  u.noteerUitslag(potje({ id: '1', soort: 'schaak', winnaar: 'CN-anna' }));
  u.noteerUitslag(potje({ id: '2', soort: 'schaak', winnaar: 'CN-boris' }));
  u.noteerUitslag(potje({ id: '3', soort: 'schaak', winnaar: null, gelijk: true }));
  u.noteerUitslag(potje({ id: '4', soort: 'woord', winnaar: 'CN-anna' }));

  const s = u.spelStand('anna');
  assert.deepEqual(s.stand.find(x => x.soort === 'schaak'),
    { soort: 'schaak', gespeeld: 3, gewonnen: 1, gelijk: 1, verloren: 1 });
  assert.deepEqual(s.totaal, { gespeeld: 4, gewonnen: 2, gelijk: 1, verloren: 1 });
  assert.equal(s.stand[0].soort, 'schaak', 'het meest gespeelde spel staat bovenaan');

  // en van de andere kant gezien klopt hij ook
  const b = u.spelStand('boris');
  assert.deepEqual(b.totaal, { gespeeld: 4, gewonnen: 1, gelijk: 1, verloren: 2 });
});

test('een gelijkspel is voor niemand een overwinning', () => {
  const u = maak();
  u.noteerUitslag(potje({ winnaar: null, gelijk: true }));
  for (const wie of ['anna', 'boris'])
    assert.deepEqual(u.spelStand(wie).totaal, { gespeeld: 1, gewonnen: 0, gelijk: 1, verloren: 0 }, wie);
});

test('de stand noemt het venster, en haalt dat uit de bewaartermijn', () => {
  /* "12 gewonnen" dat stilzwijgend "in het afgelopen jaar" betekent leest als
     een totaal-voor-altijd. Het getal komt uit het bewaarbeleid en staat hier
     niet apart, zodat een kortere termijn niet stil een verkeerd venster
     oplevert. */
  const u = maak();
  const regel = BELEID.find(r => r.tak === 'spelUitslagen');
  assert.equal(u.spelStand('anna').vensterDagen, regel.dagen,
    'het venster hoort gelijk te zijn aan de bewaartermijn van de log');
});

test('onder de grens bestaat er geen stand', () => {
  const u = maak();
  u.noteerUitslag(potje({ spelers: ['anna', 'kind1'] }));
  const s = u.spelStand('kind1');
  assert.deepEqual(s.stand, []);
  assert.equal(s.totaal, null);
  assert.equal(s.progressie, false);
});

test('een partij waar je niet in meespeelde telt niet mee', () => {
  const u = maak();
  u.noteerUitslag(potje({ id: 'vanAnderen', spelers: ['chris', 'dana'], winnaar: 'CN-chris' }));
  assert.deepEqual(u.spelStand('anna').totaal, { gespeeld: 0, gewonnen: 0, gelijk: 0, verloren: 0 });
});

test('wie zich laat verwijderen verdwijnt ook uit zijn eigen stand', () => {
  // de stand is afgeleid, dus het wispad hoeft hem niet apart te kennen -- die
  // eenvoud is precies waarom hij niet apart wordt bijgehouden
  const u = maak();
  u.noteerUitslag(potje({ id: 'p1', spelers: ['anna', 'boris'] }));
  assert.equal(u.spelStand('anna').totaal.gespeeld, 1);
  maakAnoniem({ db: u.db, accounts: {} }).anonimiseer('anna', 'CN-anna', null);
  assert.equal(u.spelStand('anna').totaal.gespeeld, 0, 'niets meer van anna');
  assert.equal(u.spelStand('boris').totaal.gespeeld, 1, 'boris houdt de zijne');
});

/* ---------- weggaan telt als opgeven ----------
   `vergeten` raakte db.data.spellen helemaal niet aan: de sleutel van een
   verwijderd lid bleef staan in elk potje waarin hij speelde, en `opschonen`
   ruimt een potje met status 'bezig' nooit op -- dus dat kon voor altijd
   blijven staan. Dat was bestaand en onzichtbaar, omdat het scenario in
   test/vergeten.test.js geen potje speelt. */
const maakSpellen = require('../server/kern/spellen');

function spellenKern(volw = () => true) {
  const db = { data: {} };
  const kern = maakSpellen({
    db, save() {}, crypto: require('crypto'), zijnVrienden: () => true, codenaamVan: (k) => 'CN-' + k,
    sseToCustomer() {}, isGeblokkeerd: () => false, socialZoek: async () => [], sociaalRate: () => true,
    volwassen: volw, sseClients: [], lidBoardUit: () => false
  });
  return { db, kern };
}
const lopend = (id, spelers) => ({ id, soort: 'schaak', modus: 'vrij', status: 'bezig',
  spelers, uitgenodigd: [], beurt: 0, teams: [0, 1], winnaar: null, at: new Date().toISOString() });

test('wie zich laat verwijderen geeft zijn lopende potjes op, en de ander wint', () => {
  const { db, kern } = spellenKern();
  db.data.spellen = { potjes: { p1: lopend('p1', ['weg', 'blijf']) }, wachtrij: { 'schaak:2': ['weg', 'ander'] } };

  require('../server/kern/vergeten/anoniem')({ db, accounts: {}, spelVergeet: kern.spelVergeet })
    .anonimiseer('weg', 'CN-weg', null);

  assert.deepEqual(Object.keys(db.data.spellen.potjes), [], 'het potje is weg -- er zat een sleutel in');
  assert.deepEqual(db.data.spellen.wachtrij, { 'schaak:2': ['ander'] }, 'en uit de wachtrij, zonder de ander te raken');

  const r = (db.data.spelUitslagen || [])[0];
  assert.ok(r, 'de partij landt wel als uitslag: de ander won hem');
  assert.deepEqual(r.spelers.find(s => s.key === 'blijf'), { key: 'blijf', codenaam: 'CN-blijf', won: true });
  assert.deepEqual(r.spelers.find(s => s.anoniem), { anoniem: true, won: false }, 'de vertrekker staat er anoniem in');
  assert.equal(JSON.stringify(db.data).includes('CN-weg'), false, 'zijn codenaam staat nergens meer');
  assert.equal(JSON.stringify(db.data).includes('"weg"'), false, 'zijn sleutel ook niet');
});

test('de volgorde klopt: eerst opgeven, dan pas anonimiseren', () => {
  /* Draai je die om, dan maakt het opgeven een VERSE uitslagrij met de
     codenaam van het verwijderde lid erin, nadat de anonimisering al langs is
     geweest. Deze toets meet dat aan het eindresultaat. */
  const { db, kern } = spellenKern();
  db.data.spellen = { potjes: { p1: lopend('p1', ['weg', 'blijf']) }, wachtrij: {} };
  require('../server/kern/vergeten/anoniem')({ db, accounts: {}, spelVergeet: kern.spelVergeet })
    .anonimiseer('weg', 'CN-weg', null);
  assert.equal(JSON.stringify(db.data.spelUitslagen).includes('weg'), false,
    'de verse uitslagrij hoort ook geanonimiseerd te zijn');
});

test('een verlaten partij wordt opgeruimd, een levende niet', () => {
  const { db, kern } = spellenKern();
  const oud = new Date(Date.now() - 40 * 86400000).toISOString();
  const vers = new Date().toISOString();
  db.data.spellen = { potjes: {
    verlaten: Object.assign(lopend('verlaten', ['a', 'b']), { at: oud, zetAt: oud }),
    levend: Object.assign(lopend('levend', ['a', 'b']), { at: oud, zetAt: vers })
  }, wachtrij: {} };
  kern.mijnSpellen('a');   // hierin zit het opschonen
  assert.deepEqual(Object.keys(db.data.spellen.potjes), ['levend'],
    'gemeten op de laatste ZET, niet op het aanmaken -- anders sneuvelt een lange levende partij');
});
