/* MENSEN BUITEN HET POTJE -- fase 5a uit SAMENLEVING.md.

   Tot nu toe was een mens een DEELNEMER van campagne X: hij bestond zolang het
   potje bestond. Alleen zijn loopbaan bleef staan, en die is geschiedenis en
   geen persoon -- wie nooit een baan had, liet niets achter en bestond nergens.

   ACHT BEWERINGEN:

   1. EEN MENS BESTAAT, OOK ALS ER NIETS GEBEURD IS. Dat is het gat: precies de
      speler die in campagne vier ineens leverancier blijkt te zijn.
   2. EEN POTJE GEBRUIKT HEM TIJDELIJK EN BEZIT HEM NIET -- hij overspant
      campagnes.
   3. DE STAND IS EEN MOMENTOPNAME en geen lopende toestand.
   4. ER STAAT GEEN BEDRAG IN, en geen enkel getal waar de economie iets mee doet.
   5. DE GESCHIEDENIS WORDT NIET GEKOPIEERD -- twee registers met hetzelfde feit
      gaan uit elkaar lopen.
   6. IDEMPOTENT: een partij kan maar een keer klaar zijn.
   7. DE POORT GELDT PER PERSOON en niet per potje.
   8. WIE STOPT, VERDWIJNT -- en dat is hier anders dan bij de loopbaan, want
      hier staat een persoon in en geen samenwerking.

   Draai los: node --experimental-sqlite --test test/spelpersonen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kav = (z, n = 0) => kaart('ijmuiden').kavels.filter(k => k.zone === z)[n];

function wereld({ magWerken = () => true } = {}) {
  const db = { data: {} };
  const codenaamVan = (h) => 'CN-' + h;
  const L = require('../server/kern/spellen/loopbaan')({
    db, save() {}, codenaamVan, progressieMag: magWerken, GEEN_PROGRESSIE: 'te jong' });
  const P = require('../server/kern/spellen/persoon')({
    db, save() {}, codenaamVan, mag: magWerken });
  const herkomst = {
    van: (h) => L.profiel(h, codenaamVan(h)),
    tussen: (h, a) => L.tussen(h, codenaamVan(h), a),
    ervaringIn: (h, s) => L.ervaringIn(h, codenaamVan(h), s) };
  const maak = () => require('../server/kern/spellen/magnaat/index')({
    save() {}, crypto: require('crypto'), codenaamVan, nudge() {}, herkomst });
  /* Een campagne draaien en netjes afsluiten, zoals partij.js dat doet. */
  function campagne(id, spelers, doe, mnd = 24) {
    const m = maak();
    const p = { id, soort: 'magnaat', spelers, teams: spelers.map((_, i) => i), modus: 'vrij',
      status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
    m.spel.init(p);
    for (const h of spelers) p.staat.geld[h] = 3000000;
    if (doe) doe(m, p);
    for (let i = 0; i < mnd; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); }
    p.status = 'klaar';
    L.noteerLoopbaan(p);
    P.noteerPersonen(p);
    return p;
  }
  /* De standaardopstelling: werkgever met een zaak, werknemer erin. */
  const inDienst = (m, p, wg, wn) => {
    m.eco.zet(p, wg, { actie: 'open', kavel: kav('boulevard').id, sector: 'horeca', omvang: 30 });
    const f = m.eco.zet(p, wg, { actie: 'functie-openen',
      vestiging: p.staat.vestigingen[wg][0].id, rol: 'hulp' });
    m.eco.zet(p, wn, { actie: 'solliciteren', id: f.id });
    m.eco.zet(p, wg, { actie: 'aannemen', id: f.id, speler: wn });
  };
  return { db, L, P, maak, campagne, inDienst };
}

/* ============ 1. een mens bestaat, ook als er niets gebeurd is ============ */

test('wie meespeelt en niets bijzonders doet, bestaat toch', () => {
  /* HET GAT DAT FASE 5A DICHT. De loopbaan weet pas iets als iemand gewerkt
     heeft, de ondernemerskring pas als hij een zaak had, de uitslagen tellen
     partijen en geen personen. Wie meedeed en verder niets, bestond nergens --
     en dat is precies de mens die in campagne vier ineens leverancier blijkt. */
  const w = wereld();
  w.campagne('c1', ['anna', 'boris', 'carla'], (m, p) => w.inDienst(m, p, 'anna', 'boris'));
  const carla = w.P.van('CN-carla');
  assert.ok(carla, 'carla hoort te bestaan, ook zonder baan en zonder zaak');
  assert.equal(carla.campagnes, 1);
  assert.equal(carla.sinds, 'c1');
  assert.equal(w.db.data.loopbaan['CN-carla'], undefined,
    'terwijl ze in de loopbaan nog steeds niets heeft -- en dat is het verschil');
  assert.equal(w.P.van('CN-niemand'), null, 'wie nooit meedeed bestaat niet');
});

/* ============ 2. een potje bezit hem niet ============ */

test('dezelfde mens overspant campagnes', () => {
  const w = wereld();
  w.campagne('c1', ['anna', 'boris'], (m, p) => w.inDienst(m, p, 'anna', 'boris'));
  w.campagne('c2', ['boris', 'mike'], (m, p) => w.inDienst(m, p, 'boris', 'mike'));
  const b = w.P.van('CN-boris');
  assert.equal(b.campagnes, 2, 'boris deed twee keer mee');
  assert.equal(b.sinds, 'c1');
  assert.equal(b.laatst, 'c2');
  /* EN ZIJN LOOPBAAN LOOPT MEE: hulpkracht in c1, eigenaar-werkgever in c2. */
  assert.equal(b.ondernemer, true, 'in c2 had hij een eigen zaak');
  assert.equal(b.werkgever, true, 'en iemand in dienst');
  /* Mike bestaat pas sinds c2, en anna niet meer sinds c1. */
  assert.equal(w.P.van('CN-mike').sinds, 'c2');
  assert.equal(w.P.van('CN-anna').laatst, 'c1');
});

test('wie ooit iemand in dienst had, blijft dat -- ook als die ander weggaat', () => {
  /* Dezelfde asymmetrie als bij de loopbaan: dat er iemand voor je werkte is
     JOUW geschiedenis, en die verdwijnt niet als hij vertrekt. */
  const w = wereld();
  w.campagne('c1', ['anna', 'boris'], (m, p) => w.inDienst(m, p, 'anna', 'boris'));
  assert.equal(w.P.van('CN-anna').werkgever, true);
  w.campagne('c2', ['anna', 'carla']);          // anna doet niets in c2
  assert.equal(w.P.van('CN-anna').werkgever, true, 'dat blijft waar');
  assert.equal(w.P.van('CN-anna').stand.rol, null, 'maar zijn STAND is nu leeg');
});

/* ============ 3. de stand is een momentopname ============ */

test('de stand zegt hoe iemand ervoor stond, niet waar hij nu werkt', () => {
  /* WEZENLIJK VERSCHIL. Tussen twee campagnes werkt niemand ergens: de zaak
     waar hij werkte bestaat niet meer, want bedrijven blijven in het potje
     (VERHAAL.md par. 1). Wat blijft is hoe het ERVOOR STOND. */
  const w = wereld();
  w.campagne('c1', ['anna', 'boris'], (m, p) => w.inDienst(m, p, 'anna', 'boris'));
  const b = w.P.van('CN-boris');
  assert.deepEqual(Object.keys(b.stand).sort(), ['eigenZaken', 'rol', 'sector', 'werkgever']);
  assert.equal(b.stand.rol, 'hulp');
  assert.equal(b.stand.sector, 'horeca');
  assert.equal(b.stand.werkgever, 'CN-anna');
  assert.equal(b.stand.eigenZaken, 0);
  /* EN EEN EIGEN ZAAK GAAT VOOR: wie onderneemt EN in dienst is, is voor de
     buitenwereld ondernemer. */
  const w2 = wereld();
  w2.campagne('c1', ['anna', 'boris'], (m, p) => {
    w2.inDienst(m, p, 'anna', 'boris');
    m.eco.zet(p, 'boris', { actie: 'open', kavel: kav('centrum').id, sector: 'retail', omvang: 10 });
  });
  assert.equal(w2.P.van('CN-boris').stand.rol, 'eigenaar');
  assert.equal(w2.P.van('CN-boris').stand.sector, 'retail');
});

/* ============ 4 en 5. geen bedrag, geen tweede waarheid ============ */

test('er staat geen bedrag in, en geen enkel getal waar de economie iets mee doet', () => {
  const w = wereld();
  w.campagne('c1', ['anna', 'boris'], (m, p) => w.inDienst(m, p, 'anna', 'boris'));
  const tekst = JSON.stringify(w.P.iedereen());
  for (const woord of ['geld', 'kas', 'vermogen', 'omzet', 'loon', 'waarde', 'bonus', 'niveau', 'score'])
    assert.equal(new RegExp(woord, 'i').test(tekst), false,
      'het woord "' + woord + '" hoort niet in een personenregister voor te komen');
  assert.deepEqual(Object.keys(w.P.van('CN-boris')).sort(),
    ['campagnes', 'laatst', 'ondernemer', 'sinds', 'stand', 'volgnummer', 'werkgever']);
});

test('de geschiedenis wordt niet gekopieerd -- die woont in de loopbaan', () => {
  /* Twee registers met hetzelfde feit gaan uit elkaar lopen, en dan is "hoe
     lang werkte hij daar" op twee plekken beantwoord. Het personenregister
     draagt de TOESTAND; ./loopbaan.js draagt wat er gebeurd is. */
  const w = wereld();
  w.campagne('c1', ['anna', 'boris'], (m, p) => w.inDienst(m, p, 'anna', 'boris'), 40);
  const p = w.P.van('CN-boris');
  assert.equal(p.banen, undefined, 'geen banen');
  assert.equal(p.momenten, undefined, 'geen momenten');
  assert.equal(p.maanden, undefined, 'en geen maandentelling');
  assert.ok(w.db.data.loopbaan['CN-boris'].banen.length, 'die staan in de loopbaan');
});

/* ============ 6, 7 en 8. de grenzen ============ */

test('een afgelopen campagne wordt EEN keer opgeschreven', () => {
  const w = wereld();
  const p = w.campagne('c1', ['anna', 'boris'], (m, x) => w.inDienst(m, x, 'anna', 'boris'));
  w.P.noteerPersonen(p); w.P.noteerPersonen(p);
  assert.equal(w.P.van('CN-boris').campagnes, 1,
    'een tweede telling zou de campagneteller laten oplopen zonder dat er iets gebeurde');
});

test('de poort geldt per persoon, en onder de grens bestaat er niemand', () => {
  const w = wereld({ magWerken: () => false });
  w.campagne('c1', ['anna', 'boris'], (m, p) => w.inDienst(m, p, 'anna', 'boris'));
  assert.equal(w.P.van('CN-boris'), null, 'onder de werkgrens wordt er niets bewaard');
  assert.deepEqual(w.P.iedereen(), []);
  /* EN PER PERSOON: in dezelfde partij kan de een wel en de ander niet. */
  const gemengd = wereld({ magWerken: (h) => h === 'anna' });
  gemengd.campagne('c1', ['anna', 'boris'], (m, p) => gemengd.inDienst(m, p, 'anna', 'boris'));
  assert.ok(gemengd.P.van('CN-anna'), 'anna wel');
  assert.equal(gemengd.P.van('CN-boris'), null, 'boris niet');
});

test('wie stopt verdwijnt, en dat is hier anders dan bij de loopbaan', () => {
  /* Bij de loopbaan blijft de kant van de ANDER staan: dat jij drie jaar voor
     iemand werkte is ook diens geschiedenis. Hier staat een PERSOON in en geen
     samenwerking, dus er is geen kant die blijft. */
  const w = wereld();
  w.campagne('c1', ['anna', 'boris'], (m, p) => w.inDienst(m, p, 'anna', 'boris'));
  assert.equal(w.P.stoptErmee('CN-boris').weg, true);
  assert.equal(w.P.van('CN-boris'), null);
  assert.ok(w.P.van('CN-anna'), 'anna blijft gewoon staan');
  assert.equal(w.P.stoptErmee('CN-niemand').weg, false);
});

test('de lijst staat op tijd en niet op prestatie', () => {
  /* Oudste eerst, zoals de ondernemerskring: dit is een geschiedenis en geen
     ranglijst. Zou hij op iets anders sorteren, dan is er stil een volgorde van
     beste naar minste ontstaan. */
  const w = wereld();
  w.campagne('c1', ['anna', 'boris'], (m, p) => w.inDienst(m, p, 'anna', 'boris'));
  w.campagne('c2', ['mike', 'carla']);
  /* CARLA SPEELT HET VAAKST EN STAAT ACHTERAAN, en dat is precies wat deze toets
     moet kunnen zeggen. Zonder die derde campagne had iedereen er even veel en
     gaf sorteren op aantal hetzelfde antwoord als sorteren op tijd -- dan
     bewijst de toets niets, en een mutatie die op prestatie sorteert komt er
     ongestraft langs. Hij deed dat ook. */
  w.campagne('c3', ['carla']);
  assert.equal(w.P.van('CN-carla').campagnes, 2, 'zij deed het vaakst mee');
  assert.deepEqual(w.P.iedereen().map(x => x.codenaam),
    ['CN-anna', 'CN-boris', 'CN-mike', 'CN-carla'],
    'en staat toch achteraan: dit is een geschiedenis en geen ranglijst');
});
