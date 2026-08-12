/* MAGNAAT: WAAR JE VANDAAN KOMT -- fase 3, de loopbaan die vooruit gelezen wordt.

   `loopbaan.js` schreef al aan het eind van een partij; niemand las het aan het
   begin van de volgende. Daardoor voelde een tweede campagne als New Game+ en
   niet als het volgende hoofdstuk van hetzelfde leven.

   NEGEN BEWERINGEN, en de eerste is de enige die er echt toe doet:

   1. GESCHIEDENIS SCHENKT GEEN WAARDE. Twee identieke werelden, een speler met
      een loopbaan en een zonder: de economie hoort tot op de cent hetzelfde te
      rekenen. Dit is de bewering waar de hele laag op staat of valt.
   2. HET PROFIEL DRAAGT GEEN GETAL WAAR IETS MEE VERMENIGVULDIGD WORDT.
   3. WAT ER WEL IN ZIT: maanden per vak, rollen, werkgevers, bekenden.
   4. HERKENNING IS WEDERZIJDS. Een eenzijdige herinnering is een
      informatievoorsprong.
   5. EEN VACATURE VAN IEMAND DIE JE KENT ZEGT DAT, en verandert verder niets.
   6. DE OVERGANG WERKNEMER -> ONDERNEMER OVERSPANT EEN CAMPAGNE.
   7. EN HIJ IS EEN EERSTE, dus hoogstens een keer.
   8. ZONDER VERLEDEN IS ER GEEN PROFIEL, en dat wordt gezegd.
   9. DE WERKGRENS GELDT: onder de zestien wordt er niets bewaard, dus is er
      niets terug te lezen.

   Draai los: node --experimental-sqlite --test test/spelherkomst.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kav = (z, n = 0) => kaart('ijmuiden').kavels.filter(k => k.zone === z)[n];

/* Een verse wereld met een eigen loopbaanregister. Elk potje krijgt zijn eigen
   `db`, zodat de ene toets de andere niet voedt. */
function wereld({ magWerken = () => true } = {}) {
  const db = { data: {} };
  const codenaamVan = (h) => 'CN-' + h;
  const L = require('../server/kern/spellen/loopbaan')({
    db, save() {}, codenaamVan, progressieMag: magWerken, GEEN_PROGRESSIE: 'te jong' });
  const herkomst = {
    van: (h) => L.profiel(h, codenaamVan(h)),
    tussen: (h, a) => L.tussen(h, codenaamVan(h), a),
    ervaringIn: (h, s) => L.ervaringIn(h, codenaamVan(h), s) };
  const maak = () => require('../server/kern/spellen/magnaat/index')({
    save() {}, crypto: require('crypto'), codenaamVan, nudge() {}, herkomst });
  return { db, L, herkomst, maak, codenaamVan };
}

function potje(m, id, spelers) {
  const p = { id, soort: 'magnaat', spelers, teams: spelers.map((_, i) => i), modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of spelers) p.staat.geld[h] = 2000000;
  return p;
}
const maanden = (m, p, n) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } };

/* Een loopbaan opbouwen: werknemer werkt N maanden voor werkgever bij een zaak. */
function loopbaanVan(w, id, werkgever, werknemer, mnd = 40, sector = 'horeca') {
  const m = w.maak();
  const p = potje(m, id, [werkgever, werknemer]);
  m.eco.zet(p, werkgever, { actie: 'open', kavel: kav('boulevard').id, sector, omvang: 30 });
  const f = m.eco.zet(p, werkgever, { actie: 'functie-openen',
    vestiging: p.staat.vestigingen[werkgever][0].id, rol: 'hulp' });
  m.eco.zet(p, werknemer, { actie: 'solliciteren', id: f.id });
  m.eco.zet(p, werkgever, { actie: 'aannemen', id: f.id, speler: werknemer });
  maanden(m, p, mnd);
  p.status = 'klaar';
  w.L.noteerLoopbaan(p);
  return p;
}

/* ============ 1. geschiedenis schenkt geen waarde ============ */

test('een loopbaan verandert geen enkel getal in de economie', () => {
  /* DE BEWERING WAAR DEZE HELE LAAG OP STAAT OF VALT, en ze is met opzet de
     strengste die er is: twee identieke werelden, in de ene heeft de speler een
     jarenlange loopbaan en in de andere niets, en de maandcijfers horen TOT OP
     DE CENT gelijk te zijn.

     Zou er ook maar een procent verschil zijn, dan is een oude speler
     structureel sterker dan een nieuwe en is elke eerste campagne een
     verplichte inhaalronde. Dat is exact de grens waar stadsgeheugen.js op
     staat, hier toegepast op een mens in plaats van op een stad. */
  const metVerleden = wereld();
  loopbaanVan(metVerleden, 'oud', 'anna', 'boris', 60);
  assert.ok(metVerleden.herkomst.van('boris').er, 'boris heeft een verleden');

  const zonder = wereld();
  assert.equal(zonder.herkomst.van('boris').er, false, 'en hier heeft hij dat niet');

  const cijfers = [];
  for (const w of [metVerleden, zonder]) {
    const m = w.maak();
    const p = potje(m, 'nieuw', ['boris', 'carla']);
    m.eco.zet(p, 'boris', { actie: 'open', kavel: kav('boulevard').id, sector: 'horeca', omvang: 30 });
    maanden(m, p, 12);
    const r = p.staat.laatste.boris.regels.find(x => x.id === p.staat.vestigingen.boris[0].id);
    cijfers.push({ kas: p.staat.geld.boris, regel: r });
  }
  assert.equal(cijfers[0].kas, cijfers[1].kas,
    'de kas van een ervaren speler hoort gelijk te zijn aan die van een beginner');
  assert.deepEqual(cijfers[0].regel, cijfers[1].regel,
    'en elke post op zijn maandoverzicht ook');
});

test('het profiel draagt geen getal waar iets mee vermenigvuldigd wordt', () => {
  /* Geen `bonus`, geen `factor`, geen `niveau`, geen score. Zodra er zo'n veld
     in staat, is de verleiding om het ergens in te vermenigvuldigen een kwestie
     van tijd -- en dan is de grens hierboven stil vervallen. */
  const w = wereld();
  loopbaanVan(w, 'oud', 'anna', 'boris', 40);
  const p = w.herkomst.van('boris');
  const tekst = JSON.stringify(p);
  for (const woord of ['bonus', 'factor', 'niveau', 'level', 'score', 'punt', 'korting', 'multiplier'])
    assert.equal(new RegExp(woord, 'i').test(tekst), false,
      'het woord "' + woord + '" hoort niet in een loopbaanprofiel voor te komen');
  assert.deepEqual(Object.keys(p).sort(),
    ['banen', 'bekenden', 'codenaam', 'er', 'ervaring', 'maanden', 'ondernemer', 'rollen', 'werkgevers']);
});

/* ============ 2. wat er wel in zit ============ */

test('een profiel weet welk vak je leerde, bij wie, en hoe lang', () => {
  const w = wereld();
  loopbaanVan(w, 'oud', 'anna', 'boris', 48, 'horeca');
  const p = w.herkomst.van('boris');
  assert.equal(p.ervaring.horeca, 48, 'vier jaar horeca');
  assert.equal(p.ervaring.retail, undefined, 'en geen retail');
  assert.equal(w.herkomst.ervaringIn('boris', 'horeca'), 48);
  assert.equal(w.herkomst.ervaringIn('boris', 'logistiek'), 0);
  assert.ok(p.rollen.hulp > 0, 'hij was hulpkracht');
  assert.equal(p.werkgevers['CN-anna'], 48, 'bij anna');
  assert.equal(p.ondernemer, false, 'en hij had nog nooit een eigen zaak');
  /* HET VAK STAAT OP DE BAAN, en dat was er niet. Zonder sector kan een loopbaan
     wel zeggen dat je ergens vier jaar werkte maar niet WAT je leerde -- en dan
     is "zes jaar horeca" onbeantwoordbaar. */
  assert.equal(w.db.data.loopbaan['CN-boris'].banen[0].sector, 'horeca');
});

test('je netwerk komt uit je banen EN uit je momenten', () => {
  const w = wereld();
  loopbaanVan(w, 'oud', 'anna', 'boris', 40);
  const p = w.herkomst.van('boris');
  const anna = p.bekenden.find(x => x.codenaam === 'CN-anna');
  assert.ok(anna, 'anna hoort bij zijn bekenden');
  assert.ok(anna.hoe.includes('werkgever'), 'als werkgever');
  assert.ok(anna.hoe.includes('eerste_baan'), 'en omdat ze hem zijn eerste baan gaf');
  assert.equal(p.bekenden.length, 1, 'en verder kent hij niemand');
});

/* ============ 3. herkenning ============ */

test('herkenning is wederzijds -- anders is het een informatievoorsprong', () => {
  const w = wereld();
  loopbaanVan(w, 'oud', 'anna', 'boris', 40);
  const bA = w.herkomst.tussen('boris', 'CN-anna');
  const aB = w.herkomst.tussen('anna', 'CN-boris');
  assert.ok(bA.er, 'boris kent anna');
  assert.ok(aB.er, 'en anna kent boris');
  assert.equal(bA.maanden, 40, 'hij werkte veertig maanden voor haar');
  assert.equal(aB.maanden, 0, 'zij nooit voor hem, en dat is geen gebrek maar het feit');
  const vreemd = w.herkomst.tussen('boris', 'CN-carla');
  assert.equal(vreemd.er, false);
  assert.match(vreemd.reden, /geen gedeeld verleden/);
});

test('een vacature van iemand die je kent zegt dat, en verandert verder niets', () => {
  /* DE DEUR WORDT ZICHTBAAR, HIJ GAAT NIET VANZELF OPEN. Er verandert niets aan
     het loon, aan de band, aan wie er wordt aangenomen of aan de kans dat je
     gekozen wordt. Wat verandert is dat je ZIET waar je iemand van kent. */
  const w = wereld();
  loopbaanVan(w, 'oud', 'anna', 'boris', 40);
  const m = w.maak();
  const p = potje(m, 'nieuw', ['anna', 'boris', 'carla']);
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kav('boulevard').id, sector: 'horeca', omvang: 30 });
  const f = m.eco.zet(p, 'anna', { actie: 'functie-openen',
    vestiging: p.staat.vestigingen.anna[0].id, rol: 'hulp' });
  const vanBoris = m.eco.zicht(p, p.staat, 'boris').werk.vacatures.find(v => v.id === f.id);
  const vanCarla = m.eco.zicht(p, p.staat, 'carla').werk.vacatures.find(v => v.id === f.id);
  assert.ok(vanBoris.bekend, 'boris ziet dat hij deze werkgever kent');
  assert.ok(vanBoris.bekend.hoe.includes('werkgever'));
  assert.equal(vanBoris.ervaring, 40, 'en dat hij dit vak eerder deed');
  assert.equal(vanCarla.bekend, null, 'carla kent haar niet');
  assert.equal(vanCarla.ervaring, 0);
  /* EN VERDER IS HET DEZELFDE VACATURE. Zou een van beide een ander loon of een
     andere band zien, dan is herkenning een voordeel geworden. */
  for (const veld of ['id', 'werkgever', 'rol', 'rolnaam', 'loon', 'sector', 'zaak', 'verlooptOver'])
    assert.equal(vanBoris[veld], vanCarla[veld], veld + ' hoort voor beiden gelijk te zijn');
  /* En solliciteren levert allebei exact hetzelfde op. */
  const a = m.eco.zet(p, 'boris', { actie: 'solliciteren', id: f.id });
  const b = m.eco.zet(p, 'carla', { actie: 'solliciteren', id: f.id });
  assert.equal(a.gevraagd, b.gevraagd, 'een bekende krijgt geen ander bod');
});

/* ============ 4. de overgang ============ */

test('werknemer worden ondernemer overspant een campagne', () => {
  /* HET MOMENT WAAR FASE 3 OM DRAAIT. Tot nu toe kon `eerste_zaak` alleen
     BINNEN een partij vallen -- hij werd geschreven vanuit de
     dienstverbandenlus, en wie deze campagne geen baan had kwam daar nooit
     langs. Precies de mens die het betreft dus. */
  const w = wereld();
  loopbaanVan(w, 'oud', 'anna', 'boris', 60);
  assert.equal(w.herkomst.van('boris').ondernemer, false, 'nog geen ondernemer');

  const m = w.maak();
  const p = potje(m, 'nieuw', ['boris', 'carla']);
  m.eco.zet(p, 'boris', { actie: 'open', kavel: kav('boulevard').id, sector: 'horeca', omvang: 20 });
  maanden(m, p, 6);
  p.status = 'klaar';
  w.L.noteerLoopbaan(p);

  const mom = w.db.data.loopbaan['CN-boris'].momenten.find(x => x.soort === 'eerste_zaak');
  assert.ok(mom, 'de overgang hoort een moment te zijn');
  assert.equal(mom.samen, 'CN-anna', 'met de werkgever waar hij het leerde erbij');
  assert.equal(mom.potje, 'nieuw', 'en hij hoort bij de campagne waarin hij begon');
  assert.equal(w.herkomst.van('boris').ondernemer, true);
  /* DE ZIN WAAR HET OM GAAT. */
  const t = w.L.terugblik('boris', 'CN-boris');
  const zin = t.momenten.find(x => x.soort === 'eerste_zaak').zin;
  assert.match(zin, /Je begon voor jezelf, na 5 jaar bij CN-anna/);
  /* EN CARLA KRIJGT HEM NIET: zij had geen verleden om uit voort te komen. */
  assert.equal((w.db.data.loopbaan['CN-carla'] || { momenten: [] }).momenten.length, 0);
});

test('een eerste is maar een keer een eerste, ook over campagnes heen', () => {
  const w = wereld();
  loopbaanVan(w, 'oud', 'anna', 'boris', 60);
  for (const id of ['een', 'twee']) {
    const m = w.maak();
    const p = potje(m, id, ['boris', 'carla']);
    m.eco.zet(p, 'boris', { actie: 'open', kavel: kav('boulevard').id, sector: 'horeca', omvang: 20 });
    maanden(m, p, 4);
    p.status = 'klaar';
    w.L.noteerLoopbaan(p);
  }
  const eersten = w.db.data.loopbaan['CN-boris'].momenten.filter(x => x.soort === 'eerste_zaak');
  assert.equal(eersten.length, 1, 'twee keer een zaak openen is geen twee keer beginnen');
  assert.equal(eersten[0].potje, 'een');
});

test('wie nooit in dienst was, komt nergens uit voort', () => {
  /* Een ondernemer die meteen voor zichzelf begon heeft geen overgang gemaakt.
     Dat is geen gebrek: er is niemand om het moment mee te delen, en een moment
     zonder tweede mens bestaat niet. */
  const w = wereld();
  const m = w.maak();
  const p = potje(m, 'solo', ['boris', 'carla']);
  m.eco.zet(p, 'boris', { actie: 'open', kavel: kav('boulevard').id, sector: 'horeca', omvang: 20 });
  maanden(m, p, 6);
  p.status = 'klaar';
  w.L.noteerLoopbaan(p);
  assert.equal((w.db.data.loopbaan['CN-boris'] || { momenten: [] }).momenten.length, 0);
});

/* ============ 5. de grenzen ============ */

test('zonder verleden is er geen profiel, en dat wordt gezegd', () => {
  const w = wereld();
  const p = w.herkomst.van('niemand');
  assert.equal(p.er, false);
  assert.match(p.reden, /nog geen werkverleden/);
  /* STIL EEN LEEG OBJECT TERUGGEVEN zou betekenen dat een scherm niet weet of er
     niets IS of dat het niet mag. Dat onderscheid is de hele poort. */
  assert.equal(p.ervaring, undefined);
});

test('onder de werkgrens is er niets bewaard, dus niets terug te lezen', () => {
  const w = wereld({ magWerken: () => false });
  loopbaanVan(w, 'oud', 'anna', 'boris', 60);
  const p = w.herkomst.van('boris');
  assert.equal(p.er, false);
  assert.match(p.reden, /te jong/);
  assert.equal(w.herkomst.ervaringIn('boris', 'horeca'), 0);
  assert.equal(w.herkomst.tussen('boris', 'CN-anna').er, false);
});

test('de rekenlagen krijgen het verleden niet eens te zien', () => {
  /* DE STERKSTE VORM VAN DE EERSTE BEWERING, en hij is structureel in plaats van
     empirisch. Bovenstaande toets meet dat de cijfers gelijk zijn; deze meet
     WAAROM ze niet anders KUNNEN zijn: de modules die geld uitrekenen krijgen
     `herkomst` niet aangereikt.

     Zonder deze regel is "geschiedenis schenkt geen waarde" een eigenschap die
     iemand per ongeluk kan wegnemen door een parameter door te geven -- en dan
     zakt er niets, want de eerste toets meet maar een handvol posten in een
     handvol maanden. Hier zakt hij meteen.

     De lijst met wie hem WEL ziet is met opzet kort en staat hier voluit: als er
     iemand bij komt, hoort dat een besluit te zijn en geen bijwerking. */
  const fs = require('fs'), path = require('path');
  const map = path.join(__dirname, '..', 'server', 'kern', 'spellen');
  /* `loopbaan-profiel.js` staat er NIET in, en dat is geen omissie: dat bestand
     levert de functies (`profiel`, `tussen`, `ervaringIn`) en kent de naam
     `herkomst` zelf niet. Die naam valt pas bij wie hem uitdeelt. */
  const MAG = [
    'magnaat/economie.js',            // deelt hem uit
    'magnaat/lagen.js',               // geeft hem door
    'magnaat/weergave.js',            // geeft hem door
    'magnaat/eigenscherm.js',         // toont waar je vandaan komt
    'magnaat/dienst-beeld.js',        // toont wie je kent
    'magnaat/dienst-acties.js'        // bouwt dat beeld
  ];
  const gevonden = [];
  (function loop(dir, voor) {
    for (const naam of fs.readdirSync(dir)) {
      const vol = path.join(dir, naam);
      if (fs.statSync(vol).isDirectory()) { loop(vol, voor + naam + '/'); continue; }
      if (!naam.endsWith('.js')) continue;
      if (/\bherkomst\b/.test(fs.readFileSync(vol, 'utf8'))) gevonden.push(voor + naam);
    }
  })(map, '');
  assert.deepEqual(gevonden.sort(), MAG.slice().sort(),
    'wie het verleden mag zien is een besluit; deze lijst hoort niet vanzelf te groeien');
  /* En de drie plekken waar geld wordt uitgerekend staan er met zoveel woorden
     NIET in. Zonder deze regel zou de lijst hierboven kunnen kloppen terwijl
     iemand hem stilletjes had uitgebreid. */
  for (const rekenaar of ['magnaat/stap.js', 'magnaat/maand.js', 'magnaat/maand-lasten.js',
    'magnaat/opzet.js', 'magnaat/acties.js', 'magnaat/bank.js', 'magnaat/waardering.js'])
    assert.equal(gevonden.includes(rekenaar), false,
      rekenaar + ' rekent geld uit en hoort het verleden niet te kennen');
});
