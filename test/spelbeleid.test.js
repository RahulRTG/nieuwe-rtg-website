/* De beleidslaag: alle toetredingsvragen op een plek, in volgorde.

   Wat hier bewaakt wordt is NIET dat er nieuwe regels zijn -- die zijn er
   juist niet. Beleid.js roept gedeeld.js, grens.js en zicht.js aan en neemt
   niets over; een policylaag die zelf gaat beslissen is een tweede kopie, en
   dan zijn er weer twee antwoorden op dezelfde vraag.

   Wat er wel bij komt is de VOLGORDE en de volledigheid, plus twee dingen die
   hiervoor impliciet waren en nu uitgesproken zijn: dat meedoen een smallere
   vraag is dan starten, en dat de context van een potje nooit uit het verzoek
   komt.

   Draai los: node --experimental-sqlite --test test/spelbeleid.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakSpellen = require('../server/kern/spellen');
const maakBeleid = require('../server/kern/spellen/beleid');

function opstelling({ volwassen = () => true } = {}) {
  const db = { data: { spellen: { potjes: {}, wachtrij: {} } } };
  const kern = maakSpellen({ db, save() {}, crypto: require('crypto'), zijnVrienden: () => true,
    codenaamVan: (x) => 'CN-' + x, sseToCustomer() {}, isGeblokkeerd: () => false,
    socialZoek: async () => [], sociaalRate: () => true, volwassen,
    sseClients: [], lidBoardUit: () => false });
  return { db, kern };
}

/* ---------- het beleid beslist niet zelf ---------- */

test('de leeftijdspoort komt uit gedeeld.js en niet uit het beleid', async () => {
  /* Als `volwassen()` nee zegt, hoort Proost geweigerd te worden -- en die
     weigering hoort woordelijk van de bestaande poort te komen. Zou beleid.js
     een eigen grens hebben, dan zou deze toets slagen met een andere tekst en
     zouden er twee regels bestaan. */
  const o = opstelling({ volwassen: () => false });
  const r = await o.kern.spelNieuw('a', { soort: 'proost', vrienden: ['b'], wereld: 'rtg' });
  assert.equal(r.status, 403);
  assert.match(r.error, /Proost is 18\+/);
});

test('de wereldpoort komt ook uit gedeeld.js', async () => {
  const o = opstelling();
  const r = await o.kern.spelNieuw('a', { soort: 'proost', vrienden: ['b'], wereld: 'rtf' });
  assert.equal(r.status, 400);
  assert.match(r.error, /RTG-leden-app/);
});

test('een onbekend spel valt als eerste af', async () => {
  const o = opstelling();
  const r = await o.kern.spelNieuw('a', { soort: 'kwartet', vrienden: ['b'], wereld: 'rtg' });
  assert.equal(r.status, 400);
  assert.match(r.error, /Onbekend spel/);
});

/* ---------- iedereen die je meeneemt gaat langs dezelfde vraag ---------- */

test('een uitgenodigde die de poort niet haalt houdt het potje tegen', async () => {
  /* De starter is volwassen, de gast niet. Dit stond hiervoor als losse lus in
     de lobby; nu is het dezelfde aanroep met een lijst erin, zodat er geen
     tweede plek is die de vraag net anders stelt. */
  const o = opstelling({ volwassen: (h) => h === 'a' });
  const r = await o.kern.spelNieuw('a', { soort: 'proost', vrienden: ['b'], wereld: 'rtg' });
  assert.equal(r.status, 403);
  assert.match(r.error, /18\+/);
});

/* ---------- meedoen is smaller dan starten ---------- */

test('meedoen kent de leeftijdspoort wel en de wereldpoort niet', () => {
  /* De asymmetrie die hiervoor alleen bestond doordat de ene aanroep een
     controle miste die de andere wel had. `wereld` zegt welke app een potje
     mag STARTEN; meespelen kan altijd over en weer. */
  const beleid = maakBeleid({
    wereldFout: (wereld, soort) => wereld === 'rtf' ? 'Dit spel vind je in de RTG-leden-app.' : null,
    leeftijdFout: (soort, h) => h === 'kind' ? 'Proost is 18+.' : null,
    progressieMag: () => true, ZICHT: {}, GEEN_PROGRESSIE: '',
    get SPEL() { return { proost: { naam: 'Proost', volwassen: true } }; }
  });
  assert.ok(beleid.mag('a', 'proost', { wereld: 'rtf' }), 'starten in de verkeerde app kan niet');
  assert.equal(beleid.magMeedoen('a', 'proost'), null, 'maar meedoen vraagt niet naar de app');
  assert.ok(beleid.magMeedoen('kind', 'proost'), 'de leeftijdspoort geldt wel');
});

/* ---------- de context komt nooit uit het verzoek ---------- */

test('een context die niet bestaat valt terug op de veilige stand', async () => {
  /* Dezelfde regel als bij `online` in routes/spellen.js: wie zijn eigen
     beleid mag meesturen, opent straks een 18+-spel als schoolsessie. */
  const o = opstelling();
  const r = await o.kern.spelNieuw('a', { soort: 'schaak', vrienden: ['b'], wereld: 'rtg', context: 'baas' });
  assert.equal(r.status, 200);
  assert.equal(o.db.data.spellen.potjes[r.id].context, 'hall');
});

test('een context uit de gesloten lijst blijft staan', async () => {
  const o = opstelling();
  const r = await o.kern.spelNieuw('a', { soort: 'schaak', vrienden: ['b'], wereld: 'rtg', context: 'chat', bron: 'gesprek:ab12' });
  const p = o.db.data.spellen.potjes[r.id];
  assert.equal(p.context, 'chat');
  assert.equal(p.bron, 'gesprek:ab12', 'en de weg terug naar waar het potje vandaan komt');
});

test('de starter is de host, en de wachtrij levert er geen', async () => {
  const o = opstelling();
  const r = await o.kern.spelNieuw('a', { soort: 'schaak', vrienden: ['b'], wereld: 'rtg' });
  assert.equal(o.db.data.spellen.potjes[r.id].host, 'a');

  o.kern.spelRandom('x', 'schaak', 2, 'nl', 'rtg');
  o.kern.spelRandom('y', 'schaak', 2, 'nl', 'rtg');
  const random = Object.values(o.db.data.spellen.potjes).find(p => p.door === 'random');
  assert.ok(random, 'de wachtrij heeft gekoppeld');
  assert.equal(random.host, null, 'de wachtrij koppelt vreemden; niemand is daar gastheer');
  assert.equal(random.context, 'hall');
});

/* ---------- het zicht is de bron voor "mag hier meegekeken worden" ---------- */

test('meekijken wordt uit het zicht afgeleid, niet uit een vlag', () => {
  const beleid = maakBeleid({
    wereldFout: () => null, leeftijdFout: () => null,
    ZICHT: { schaak: { speler() {}, kijker() {}, publiek() {} }, seconden: { speler() {}, kijker: null, publiek() {} } },
    get SPEL() { return { schaak: {}, seconden: {} }; }
  });
  assert.equal(beleid.magBekeken('schaak'), true);
  assert.equal(beleid.magBekeken('seconden'), false, 'geen kijkweergave, dus niet te bekijken');
  assert.equal(beleid.magBekeken('kwartet'), false, 'een spel dat niet bestaat al helemaal niet');
});

test('de partij stelt die vraag ook echt HIER en niet zelf aan ZICHT', () => {
  /* Anders zijn er weer twee plekken die hem beantwoorden, en dat is precies
     wat deze laag moest opheffen. Gemeten via de echte kern: 30 Seconden heeft
     geen kijkweergave, dus de poort hoort dicht te zitten. */
  const o = opstelling();
  const p = { id: 's1', soort: 'seconden', modus: 'teams', spelers: ['a', 'b', 'c', 'd'],
    uitgenodigd: [], beurt: 0, teams: [0, 1, 0, 1], status: 'bezig', winnaar: null,
    at: new Date().toISOString() };
  require('../server/kern/spellen/register')({ save() {}, crypto: require('crypto'),
    schud: (a) => a, beurtDoor() {}, codenaamVan: (x) => x, nudge() {} }).INITS.seconden(p);
  o.db.data.spellen.potjes.s1 = p;
  const r = o.kern.spelKijk('vriend', 's1');
  assert.equal(r.status, 403);
  assert.match(r.error, /niet meekijken/);
});

/* ---------- de progressiegrens zelf, door de ECHTE bedrading ---------- */

/* WAAROM DEZE TOETS ER PAS NU STAAT, en het is een vondst van npm run sabotage.

   CLAUDE.md zegt het met zoveel woorden: "De grens staat op één plek in de code
   (`progressieMag` in `server/kern/spellen/grens.js`); nieuwe progressievormen
   hangen daaraan en krijgen geen eigen kopie van de regel." Elke toets die de
   progressie raakte, gaf `progressieMag` echter ZELF mee -- speluitslagen,
   spelprestaties, speltelling en speldag zetten er alle vier hun eigen functie
   in. Dat is goed voor wat die toetsen bewijzen (de consument gehoorzaamt de
   grens), maar het betekende dat de BEDRADING nergens werd geraakt: zet in
   grens.js `progressieMag: () => true` -- de poort helemaal open, elke tiener
   een ranglijst -- en er werd niets rood.

   Aangetoond en niet bedacht: WETTEN.json draagt die mutatie als de sabotage
   van toegang-progressie-stopt-bij-18, en die kwam AFGESLAGEN terug.

   Deze toets gaat daarom NIET langs een injectie maar door maakSpellen() heen,
   want daar wordt grens.js echt aangeroepen. Drie progressievormen, twee
   leeftijden: dat de poort dicht is voor wie hem niet haalt, dat hij open is
   voor wie hem wel haalt, en -- de andere helft van de regel -- dat het spel
   eronder gewoon speelbaar blijft. */
test('de progressiegrens hangt aan de echte leeftijdspoort in grens.js', () => {
  const kind = opstelling({ volwassen: () => false }).kern;
  const volw = opstelling({ volwassen: () => true }).kern;

  for (const vorm of ['spelStand', 'spelUitslagen', 'spelPrestaties']) {
    const onder = kind[vorm]('iemand');
    const boven = volw[vorm]('iemand');
    assert.equal(onder.progressie, false, vorm + ': onder de grens wordt er niets bewaard');
    assert.match(onder.reden, /identiteitsbewijs heeft gezien/,
      vorm + ': en er staat waarom, in plaats van een lege lijst zonder uitleg');
    assert.equal(boven.progressie, true, vorm + ': boven de grens wel');
  }

  /* De tegenhanger, en die is de helft van de wet: onder de grens blijft het
     spel VOLLEDIG speelbaar. Zonder deze regel zou "alles dicht" ook slagen, en
     dat is een ander product dan wat CLAUDE.md belooft. */
  const potje = kind.spelNieuw('iemand', { soort: 'seconden', modus: 'solo' });
  assert.ok(!potje.error, 'onder de grens start een potje gewoon: ' + JSON.stringify(potje).slice(0, 120));
});
