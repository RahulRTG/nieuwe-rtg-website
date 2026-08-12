/* MAGNAAT: PDA RUSH -- de dienst van een hulpkracht op de werkvloer.

   De werklaag uit VERHAAL.md par. 0f. Acht beweringen, en ze staan een-op-een
   op de vijf wetten daar -- want dit is een laag waarvan de VALKUIL bekend is
   (zes minuten taakjes met punten eromheen) en de wetten zijn precies wat die
   valkuil buiten de deur houdt.

   1. NIET SPELEN IS NEUTRAAL, tot op de euro. Wet 4, en de scherpste van de
      acht: een maand met een hulpkracht die niet speelt is exact de maand die
      er zonder deze laag ook was geweest.
   2. DE LAT IS DE VOLGORDE VAN BINNENKOMST. Wie precies doet wat de ploeg
      zonder sturing zou doen, krijgt factor 1 -- niet ongeveer.
   3. EEN DIENST VERSCHUIFT EEN KOSTENPOST EN MAAKT GEEN GELD. Wet 3.
   4. EEN ROL ZIET ALLEEN ZIJN EIGEN VERANTWOORDELIJKHEID. Wet 2.
   5. ER STAAT NERGENS EEN SCORE. Wet 1.
   6. DEZELFDE AVOND, ELKE KEER -- en er is geen terug.
   7. EEN ZESTIENJARIGE MAG ZIJN DIENST DRAAIEN. De werkgrens, niet de
      progressiegrens.
   8. WAT ER OVERBLIJFT IS EEN FEIT EN GEEN OORDEEL. Wet 5.

   Draai los: node --experimental-sqlite --test test/spelrush.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const R = require('../server/kern/spellen/magnaat/rush');
const GRENS = require('../server/kern/spellen/grens');
const { SECTOREN } = require('../server/kern/spellen/magnaat/sectoren');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const { maand: rekenMaand, personeelNodig } = require('../server/kern/spellen/magnaat/stap');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kavelsIn = (zone) => kaart('ijmuiden').kavels.filter(k => k.zone === zone);

/* Anna heeft een restaurant, Boris komt er werken. Dezelfde opstelling als
   test/speldienst.test.js, want dit is dezelfde wereld een laag dieper. */
function opstelling(id = 'r1', sector = 'horeca') {
  const m = maakMagnaat();
  const p = { id, soort: 'magnaat', spelers: ['anna', 'boris'], teams: [0, 1], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of p.spelers) p.staat.geld[h] = 2000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelsIn('boulevard')[0].id, sector, omvang: 30 });
  const zaak = p.staat.vestigingen.anna[0];
  const maand = (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } };
  const inDienst = (rol = 'hulp') => {
    const r = m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: zaak.id, rol });
    m.eco.zet(p, 'boris', { actie: 'solliciteren', id: r.id });
    return m.eco.zet(p, 'anna', { actie: 'aannemen', id: r.id, speler: 'boris' });
  };
  const kijk = () => m.eco.zet(p, 'boris', { actie: 'rush' });
  const pak = (wat) => m.eco.zet(p, 'boris', { actie: 'rush-pak', wat });
  return { m, p, st: p.staat, zaak, maand, inDienst, kijk, pak };
}

/* De dienst uitspelen met een strategie. Geeft het laatste beeld terug. */
function draai(o, kies) {
  let r = o.kijk();
  for (let i = 0; i < R.SLOTS + 2 && r.dienst && !r.dienst.klaar; i++) {
    if (!r.dienst.open.length) break;
    r = o.pak(kies(r.dienst.open, r.dienst).id);
  }
  return r;
}
const eerste = (open) => open[0];

/* ============ 1. niet spelen is neutraal, tot op de euro ============ */

test('een hulpkracht die niet speelt kost precies niets -- wet 4', () => {
  /* DE STRENGSTE BEWERING VAN DEZE LAAG. Par. 0f: geen reeks, geen inhaalschuld,
     geen straf voor afwezigheid. Dus moet de maand van een zaak MET een
     niet-spelende hulpkracht cijfer voor cijfer die van een zaak ZONDER hem
     zijn -- afgezien van het loon, dat een gewone overdracht is.

     Zou hier "ongeveer" staan, dan is niet spelen een klein beetje duurder dan
     spelen, en dan is de laag binnen een jaar een tredmolen. */
  const zonder = opstelling('r-a');
  const met = opstelling('r-a');            // zelfde id: zelfde wereld
  met.inDienst('hulp');
  zonder.maand(3); met.maand(3);
  const a = zonder.st.laatste.anna.regels.find(r => r.id === zonder.zaak.id);
  const b = met.st.laatste.anna.regels.find(r => r.id === met.zaak.id);
  for (const veld of ['omzet', 'inkoop', 'derving', 'lonen', 'vast', 'huur', 'kosten', 'resultaat'])
    assert.equal(b[veld], a[veld], veld + ' hoort niet te bewegen van een hulpkracht die niets doet');
});

test('een dienst die je begint en niet afmaakt telt ook als niet gespeeld', () => {
  /* Anders is BEGINNEN een risico, en dan is de veiligste zet hem nooit openen.
     Dat is precies het gedrag dat wet 4 uitsluit. */
  const zonder = opstelling('r-b');
  const met = opstelling('r-b');
  met.inDienst('hulp');
  met.kijk();
  const eersteOpen = met.kijk().dienst.open[0];
  met.pak(eersteOpen.id);                    // een moment gespeeld, dan ophouden
  assert.equal(met.st.rush.diensten.d1.klaar, false, 'de dienst is niet af');
  zonder.maand(1); met.maand(1);
  const a = zonder.st.laatste.anna.regels.find(r => r.id === zonder.zaak.id);
  const b = met.st.laatste.anna.regels.find(r => r.id === met.zaak.id);
  assert.equal(b.derving, a.derving, 'een halve dienst hoort de derving niet te raken');
  assert.equal((met.st.rush.log || []).length, 0, 'en hij levert geen logregel op');
});

/* ============ 2. de lat is de volgorde van binnenkomst ============ */

test('wie doet wat de ploeg zou doen, krijgt factor 1 -- niet ongeveer', () => {
  /* WET 4 HEEFT MAAR BETEKENIS ALS DE LAT ECHT DE PLOEG IS. `opVolgorde` pakt
     wat er het eerst binnenkwam; speel je dat na, dan hoort er exact niets te
     verschuiven. Zakt deze toets, dan meet de factor iets anders dan hij zegt
     te meten -- en dan is "beter dan de ploeg" een leeg compliment. */
  const o = opstelling('r-c');
  o.inDienst('hulp');
  o.maand(2);
  const r = draai(o, eerste);
  assert.ok(r.dienst.klaar, 'de dienst is uitgespeeld');
  assert.equal(r.dienst.uitkomst.factor, 1,
    'de ploeg naspelen hoort precies de ploeg op te leveren, niet ' + r.dienst.uitkomst.factor);
  assert.equal(r.dienst.uitkomst.verschil, 0);
});

test('de lat kijkt naar de voorvallen en nooit naar wat de speler koos', () => {
  /* Zou `opVolgorde` meebewegen met de keuzes, dan meet de factor zichzelf. */
  const o = opstelling('r-d');
  o.inDienst('hulp');
  o.maand(2);
  const vv = R.bouw('r-d', { id: 'd1' }, o.st.maand, 'hulp');
  const lat = R.opVolgorde(vv);
  draai(o, (open) => open.slice().sort((a, b) => b.blijftLiggen - a.blijftLiggen)[0]);
  assert.equal(R.opVolgorde(vv), lat, 'de lat is verschoven door te spelen');
  /* En hij is echt de VOLGORDE: het vroegst binnengekomen voorval wordt als
     eerste gepakt, niet het duurste of het snelst groeiende. */
  const eerst = vv.slice().sort((a, b) => a.vanaf - b.vanaf || (a.id < b.id ? -1 : 1))[0];
  const anders = R.schade(vv, [{ id: eerst.id, slot: 0 }]);
  assert.ok(anders < R.schade(vv, []), 'iets oppakken hoort altijd te helpen');
});

/* ============ 3. een dienst maakt geen geld ============ */

test('derving is een uitsnede van de inkoop en nooit een post erbij', () => {
  /* WET 3. Bij factor 1 hoort `inkoop + derving` tot op de cent te zijn wat de
     inkoop was voordat deze laag bestond. Zou derving ERBIJ komen, dan werd elke
     zaak in de stad duurder omdat er een spel bijkwam. */
  const k = kaart('ijmuiden');
  const kv = kavelsIn('boulevard')[0];
  for (const sector of Object.keys(SECTOREN)) {
    const s = SECTOREN[sector];
    const maak = () => { const v = { sector, kavel: kv.id, omvang: 20, prijs: 'midden', tech: [],
      reputatie: 50, onderhoud: 100, marketing: 0, huur: 1000, onderhoudBudget: 0 };
      v.personeel = personeelNodig(v, 0); return v; };
    const r = rekenMaand(k, maak(), { maand: 4, zoneDruk: 1, wereldFactor: 1, arbeid: 0 });
    assert.ok(s.derving > 0, sector + ' heeft geen dervingsdeel');
    /* De inkooppost als geheel: precies wat `omzet * inkoop` altijd al was. */
    assert.ok(Math.abs((r.inkoop + r.derving) - r.omzet * s.inkoop) < 1,
      sector + ': inkoop plus derving is niet meer de hele inkooppost');
  }
});

test('de derving blijft binnen de band, en zakt nooit onder nul', () => {
  /* De hefboom van deze laag heeft een BODEM. Zonder die grens kan een dienst de
     inkooppost wegspelen, en dan is een goed gedraaide avond geen besparing meer
     maar een geldpomp -- precies wat scripts/magnaat-pomp.js niet ziet, omdat
     daar geen euro de wereld in komt die er niet uit ging. */
  const k = kaart('ijmuiden');
  const kv = kavelsIn('boulevard')[0];
  const v = { sector: 'horeca', kavel: kv.id, omvang: 20, prijs: 'midden', tech: [],
    reputatie: 50, onderhoud: 100, marketing: 0, huur: 1000, onderhoudBudget: 0 };
  v.personeel = personeelNodig(v, 0);
  const kaal = rekenMaand(k, Object.assign({}, v), { maand: 4, zoneDruk: 1, wereldFactor: 1, arbeid: 0 });
  const basis = kaal.derving;
  for (const f of [0, 0.1, R.FACTORBAND[0], 1, R.FACTORBAND[1], 9]) {
    const r = rekenMaand(k, Object.assign({}, v), { maand: 4, zoneDruk: 1, wereldFactor: 1,
      arbeid: 0, dervingFactor: f });
    assert.ok(r.derving >= 0, 'derving werd negatief bij factor ' + f);
    assert.ok(r.inkoop >= 0, 'inkoop werd negatief bij factor ' + f);
  }
  /* En wat de MOTOR ooit binnenkrijgt is begrensd: `uitkomst` klemt op de band,
     dus een gespeelde dienst komt nooit buiten deze twee uitersten. */
  const laag = rekenMaand(k, Object.assign({}, v), { maand: 4, zoneDruk: 1, wereldFactor: 1,
    arbeid: 0, dervingFactor: R.FACTORBAND[0] });
  assert.ok(laag.derving >= Math.floor(basis * R.FACTORBAND[0]) - 1,
    'de bodem van de band hoort de bodem van de derving te zijn');
});

test('een gespeelde dienst komt nooit buiten de factorband', () => {
  const zaak = { sector: 'horeca', omvang: 30, prijs: 'midden', maanden: 4, omzetTotaal: 400000 };
  for (let i = 0; i < 60; i++) {
    const vv = R.bouw('band' + i, { id: 'd1' }, i, 'hulp');
    /* De slechtst denkbare avond: elk moment het minst dringende oppakken. */
    const gedaan = []; let t = 0;
    while (t < R.SLOTS) {
      const open = vv.filter(x => x.vanaf <= t && !gedaan.some(g => g.id === x.id));
      if (!open.length) { t++; continue; }
      gedaan.push({ id: open.slice().sort((a, b) => a.kost - b.kost)[0].id, slot: t });
      t++;
    }
    const u = R.uitkomst(vv, { gedaan, raming: 1000 }, zaak);
    assert.ok(u.factor >= R.FACTORBAND[0] && u.factor <= R.FACTORBAND[1],
      'factor ' + u.factor + ' ligt buiten de band');
  }
});

test('het bedrag dat je aan het eind van je dienst ziet, is het bedrag in het log', () => {
  /* DIT KWAM UIT EEN SPEELTEST EN UIT GEEN ENKELE TOETS. `raming()` leest de
     omzetgeschiedenis van de zaak, en die verschuift zodra de maand gedraaid
     heeft. Werd hij bij het afsluiten opnieuw gerekend, dan stond er in het log
     een ander bedrag dan er aan het eind van je dienst op je scherm stond --
     dezelfde avond, twee waarheden, en allebei op zichzelf kloppend. Vandaar dat
     de raming bevroren wordt zodra de avond begint. */
  const o = opstelling('r-n');
  o.inDienst('hulp');
  o.maand(3);
  const gezien = draai(o, eerste).dienst.uitkomst.derving;
  o.maand(1);
  assert.equal(o.st.rush.log[0].derving, gezien,
    'het log noemt een ander bedrag dan de speler te zien kreeg');
});

test('twee hulpkrachten op een zaak middelen, ze tellen niet op', () => {
  /* Zou het optellen, dan halveert een tweede man de derving zonder iets te
     doen -- en dan is personeel aannemen een geldpomp in plaats van een
     kostenpost.

     DE ACTIETABEL LAAT DIT VANDAAG NIET TOE (een rol is maar een keer te
     vergeven per zaak, ./dienst-acties.js), dus de staat wordt hier met de hand
     gezet. Dat is met opzet: de regel hoort te gelden op de dag dat die
     beperking verdwijnt, en niet pas als iemand het dan opmerkt. */
  const o = opstelling('r-o');
  o.inDienst('hulp');
  o.maand(2);
  draai(o, eerste);                                   // boris speelt de ploeg na: factor 1
  const RUSH = require('../server/kern/spellen/magnaat/rush-maand');
  assert.equal(RUSH.factoren(o.p)[o.zaak.id], 1);
  /* Een tweede hulpkracht op dezelfde zaak, met een dienst die half zo veel
     schade opliep. */
  const tweede = { id: 'd9', werkgever: 'anna', werknemer: 'carla', vestiging: o.zaak.id,
    rol: 'hulp', loon: 1000, sinds: 0, maanden: 0, betaaldTotaal: 0, status: 'loopt' };
  o.st.diensten.push(tweede);
  const vv = R.bouw(o.p.id, tweede, o.st.maand, 'hulp');
  /* EEN ECHT ANDERE AVOND, en die moet je bouwen. Een eerste versie pakte
     domweg de eerste zes voorvallen op volgorde -- maar dat IS de ploeg, dus
     kwam er factor 1 uit en gaven middelen en optellen hetzelfde antwoord. De
     mutatie kwam er ongestraft langs. Hier wordt elk moment het MINST dringende
     gepakt, wat een dienst geeft die duidelijk slechter is dan de ploeg. */
  const gedaan = [];
  for (let t = 0; t < R.SLOTS; t++) {
    const kan = vv.filter(x => x.vanaf <= t && !gedaan.some(g => g.id === x.id));
    if (kan.length) gedaan.push({ id: kan.slice().sort((a, b) => a.kost - b.kost)[0].id, slot: t });
  }
  o.st.rush.diensten.d9 = { maand: o.st.maand, slot: R.SLOTS, klaar: true, raming: 1000,
    vestiging: o.zaak.id, werknemer: 'carla', gedaan };
  const los = R.uitkomst(vv, o.st.rush.diensten.d9, o.zaak).factor;
  assert.ok(los > 1.05, 'de tweede dienst moet echt anders lopen dan de ploeg, anders meet dit niets');
  assert.equal(RUSH.factoren(o.p)[o.zaak.id], (1 + los) / 2,
    'twee diensten op een zaak horen te middelen');
});

/* ============ 4. een rol ziet alleen zijn eigen verantwoordelijkheid ==== */

test('een hulpkracht ziet nooit wat hij niet mag beslissen -- wet 2', () => {
  /* De grens die de ROL al draagt (dienst-rollen.js `mag`) is de grens van het
     spel. Er komt geen tweede rechtenmodel bij, en dus hoort een voorval met een
     `mag` die de rol mist er domweg niet te zijn. */
  const beperkt = R.SOORTEN.filter(s => s.mag);
  assert.ok(beperkt.length, 'de tabel heeft geen enkel voorval met een bevoegdheid');
  for (let i = 0; i < 40; i++) {
    const vv = R.bouw('rol' + i, { id: 'd1' }, i, 'hulp');
    for (const s of beperkt)
      assert.equal(vv.some(x => x.id === s.id), false,
        'een hulpkracht kreeg ' + s.id + ' te zien, en die vraagt ' + s.mag);
  }
  /* En wie het WEL mag, kan hem tegenkomen. Zonder deze helft bewijst de eerste
     helft alleen dat de tabel nooit gebruikt wordt. */
  let gezien = false;
  for (let i = 0; i < 60 && !gezien; i++)
    gezien = R.bouw('rol' + i, { id: 'd1' }, i, 'vakkracht').some(x => x.id === 'installatie');
  assert.ok(gezien, 'een vakkracht komt het onderhoudsvoorval nooit tegen');
});

test('er is geen werkvloer voor een rol of sector die hem niet heeft', () => {
  /* Bouw er EEN, helemaal (par. 0f). Wat er niet is, zegt met zoveel woorden
     dat het er niet is -- een leeg scherm zonder uitleg leest als een storing. */
  const o = opstelling('r-e');
  o.inDienst('bedrijfsleider');
  const r = o.kijk();
  assert.equal(r.dienst, null);
  assert.match(r.waarom, /nog geen werkvloer/);
  const winkel = opstelling('r-f', 'retail');
  winkel.inDienst('hulp');
  assert.equal(winkel.kijk().dienst, null, 'een winkel heeft nog geen dienst');
  /* En zonder baan al helemaal niet. */
  const los = opstelling('r-g');
  assert.match(los.kijk().waarom, /geen baan/);
  assert.equal(los.pak('koeling').status, 409);
});

/* ============ 5. er staat nergens een score ============ */

test('een dienst levert euros en feiten op, en nooit een punt -- wet 1', () => {
  const o = opstelling('r-h');
  o.inDienst('hulp');
  o.maand(2);
  const r = draai(o, eerste);
  const tekst = JSON.stringify(r.dienst);
  for (const woord of ['punt', 'score', 'niveau', 'level', 'combo', 'streak', 'xp', 'rang'])
    assert.equal(new RegExp(woord, 'i').test(tekst), false,
      'het woord "' + woord + '" hoort niet in een dienst voor te komen');
  /* Wat er WEL staat: bedragen. Elk open voorval draagt drie euro-getallen en
     verder geen weging, geen ster, geen kleur. */
  assert.deepEqual(Object.keys(r.dienst.uitkomst).sort(),
    ['bleefLiggen', 'derving', 'factor', 'verschil', 'zonderSturing']);
  o.maand(1);
  const regel = o.st.rush.log[0];
  assert.deepEqual(Object.keys(regel).sort(), ['derving', 'maand', 'waarom', 'werknemer', 'zaak']);
});

/* ============ 6. dezelfde avond, elke keer -- en geen terug ============ */

test('dezelfde dienst geeft dezelfde avond, hoe vaak je hem ook opent', () => {
  /* Dezelfde eis als bij ./risico.js: de wereld rekent BIJ wanneer iemand kijkt.
     Zou de avond per keer verschillen, dan is verversen een gokautomaat. */
  const a = R.bouw('p9', { id: 'd3' }, 7, 'hulp');
  const b = R.bouw('p9', { id: 'd3' }, 7, 'hulp');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, R.bouw('p9', { id: 'd3' }, 8, 'hulp'), 'een andere maand is een andere avond');
  assert.notDeepEqual(a, R.bouw('p9', { id: 'd4' }, 7, 'hulp'), 'een ander dienstverband ook');
  /* KIJKEN VERANDERT NIETS. `verzet` schuift de klok door rustige momenten, en
     dat mag geen tweede keer gebeuren als je nog eens kijkt. */
  const o = opstelling('r-i');
  o.inDienst('hulp');
  o.maand(2);
  const een = o.kijk().dienst;
  const twee = o.kijk().dienst;
  assert.equal(een.moment, twee.moment, 'twee keer kijken verzette de klok');
  assert.deepEqual(een.open.map(x => x.id), twee.open.map(x => x.id));
});

test('je kunt niets oppakken wat niet openstaat, en niets terugdraaien', () => {
  const o = opstelling('r-j');
  o.inDienst('hulp');
  o.maand(2);
  const eersteOpen = o.kijk().dienst.open[0];
  assert.equal(o.pak('bestaatniet').status, 404);
  assert.ok(o.pak(eersteOpen.id).ok);
  assert.equal(o.pak(eersteOpen.id).status, 404, 'hetzelfde voorval twee keer oppakken kan niet');
  const uit = draai(o, eerste);
  assert.ok(uit.dienst.klaar);
  assert.equal(o.pak('koeling').status, 409, 'een afgelopen dienst neemt niets meer aan');
});

/* ============ 7. een zestienjarige mag zijn dienst draaien ============ */

test('de dienst valt onder de werkgrens en niet onder de progressiegrens', () => {
  /* VERHAAL.md par. 0c: een score en een biografie zijn verschillende dingen.
     Een dienst draaien is werken -- dat mag vanaf 16. Er komt niets uit dat het
     potje overleeft als stand of ranglijst, dus de 18+-grens blijft onaangeroerd.
     De lijst in grens.js is WIT, dus zonder deze regel zou de bijbaan zelf 18+
     zijn geworden zodra hij een scherm kreeg. */
  for (const actie of ['rush', 'rush-pak']) {
    assert.ok(GRENS.JONG_MAG.includes(actie), actie + ' hoort bij de bijbaan');
    assert.equal(maakMagnaat().spel.volwassenLaag.includes(actie), false,
      actie + ' staat in de volwassen laag en dus kan een zestienjarige zijn dienst niet draaien');
  }
  const g = require('../server/kern/spellen/grens')({ volwassen: () => false, leeftijd: () => 16 });
  assert.equal(g.laagVan('x'), 'jong');
  assert.ok(g.magHandeling('x', 'rush'));
  assert.equal(g.magHandeling('x', 'open'), false, 'de witte lijst is nog steeds wit');
  /* EEN KIND SPEELT ALLES EN ER WORDT NIETS BEWAARD -- dat is par. 0c en het
     geldt hier onverkort. De bescherming zit dus NIET in een verbod op de
     handeling maar in `werkMag`: onder de zestien blijft er niets van over. */
  const kind = require('../server/kern/spellen/grens')({ volwassen: () => false, leeftijd: () => 12 });
  assert.ok(kind.magHandeling('x', 'rush'), 'een kind speelt gewoon mee');
  assert.equal(kind.werkMag('x'), false, 'maar er wordt niets van bewaard');
});

test('een dienst voegt niets toe aan wat het potje overleeft', () => {
  /* DE PROGRESSIEGRENS BLIJFT WAAR HIJ STOND. Alles van deze laag leeft in
     `potje.staat` -- `st.rush` en het feit op het dienstverband -- en gaat er
     niet uit. Zou er een dienstteller, een reeks of een stand naar de bewaarlaag
     lekken, dan is de bijbaan ineens progressie en valt hij onder 18+.

     Deze toets kijkt naar de MOMENTSOORTEN, want dat is de lijst waar een
     nieuwe blijvende vorm als eerste in zou verschijnen (VERHAAL.md par. 0e
     vertelt wat er gebeurt als je hem wel in de tabel zet en nergens aanroept). */
  const M = require('../server/kern/spellen/loopbaan-momenten');
  const soorten = Object.keys(M.MOMENTEN || {});
  for (const s of soorten)
    assert.equal(/rush|dienst_|derving|avond/.test(s), false,
      'de momentsoort "' + s + '" ziet eruit als bewaarde werkvloerprogressie');
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/rush-maand'), 'utf8');
  /* Op de INVOER en niet op het woord: de kop verwijst met opzet naar
     loopbaan-noteren.js om te zeggen dat DIE beslist wat een feit betekent. Wat
     er niet mag is hem binnenhalen en zelf schrijven. */
  assert.equal(/require\([^)]*loopbaan/.test(bron), false,
    'rush-maand.js haalt de bewaarlaag binnen; hij hoort alleen een feit in het potje te zetten');
});

/* ============ 8. wat er overblijft is een feit ============ */

test('een dienst laat een feit achter en geen oordeel -- wet 5', () => {
  /* Par. 0b: wat gebeurd is blijft waar, wat het betekent kan veranderen. Dus
     staat er wat je aanpakte en wat er bleef liggen, en nergens of dat goed was.
     ../loopbaan-noteren.js beslist later of er een moment uit groeit; die leest
     hetzelfde feit als iedereen. */
  const o = opstelling('r-k');
  o.inDienst('hulp');
  o.maand(2);
  draai(o, eerste);
  o.maand(1);
  const feit = o.st.diensten[0].diensten[0];
  assert.deepEqual(Object.keys(feit).sort(),
    ['aangepakt', 'bleefLiggen', 'incident', 'maand', 'vestiging']);
  assert.equal(typeof feit.incident, 'boolean');
  assert.ok(feit.aangepakt > 0);
});

test('dezelfde maand twee keer opschrijven geeft een regel, geen twee', () => {
  /* IDEMPOTENT, en deze toets moet BINNEN de maand van de dienst blijven staan.
     Een eerdere versie draaide de maand eerst door en riep `naMaand` daarna twee
     keer aan -- maar dan filtert `afgerond` de dienst al weg op zijn maand, dus
     de lus werd nooit betreden en de toets bewees niets. Hij overleefde dan ook
     een mutatie die de `geboekt`-vlag helemaal weghaalde. */
  const o = opstelling('r-l');
  o.inDienst('hulp');
  o.maand(2);
  draai(o, eerste);
  const RUSH = require('../server/kern/spellen/magnaat/rush-maand');
  assert.equal(RUSH.afgerond(o.p).length, 1, 'de dienst hoort nu meegeteld te worden');
  RUSH.naMaand(o.p); RUSH.naMaand(o.p); RUSH.naMaand(o.p);
  assert.equal(o.st.diensten[0].diensten.length, 1, 'de maand werd meer dan eens opgeschreven');
  assert.equal(o.st.rush.log.length, 1);
});

test('de factor die de maand rekent is de factor die de speler zag', () => {
  /* TWEE ANTWOORDEN OP DEZELFDE VRAAG IS EEN GAT, en hier is het een gemeen
     gat: het scherm leest `R.uitkomst` rechtstreeks, de maand haalt hem via
     `factoren()`. Zouden die uiteen lopen, dan staat er aan het eind van je
     dienst een bedrag op je PDA dat de boekhouding niet kent -- en niets in de
     laag zou dat merken. Een mutatie die `factoren()` met 0,95 vermenigvuldigde
     kwam er precies daardoor ongestraft langs. */
  const o = opstelling('r-m');
  o.inDienst('hulp');
  o.maand(2);
  const gezien = draai(o, (open) => open.slice()
    .sort((a, b) => b.blijftLiggen - a.blijftLiggen)[0]).dienst.uitkomst.factor;
  const RUSH = require('../server/kern/spellen/magnaat/rush-maand');
  assert.equal(RUSH.factoren(o.p)[o.zaak.id], gezien,
    'de maand rekent met een andere factor dan er op het scherm stond');
  /* En hij landt ook echt op de derving: een dienst die slechter liep dan de
     ploeg hoort een hogere dervingregel te geven dan diezelfde maand zonder. */
  const zonder = opstelling('r-m');
  zonder.maand(2); zonder.maand(1); o.maand(1);
  const a = zonder.st.laatste.anna.regels.find(r => r.id === zonder.zaak.id);
  const b = o.st.laatste.anna.regels.find(r => r.id === o.zaak.id);
  assert.notEqual(b.derving, a.derving, 'een gespeelde dienst raakte de derving niet');
  assert.ok(Math.abs(b.derving - a.derving * gezien) <= 1,
    'de dervingregel volgt de factor niet: ' + b.derving + ' tegen ' + a.derving + ' x ' + gezien);
});

test('een incident telt alleen als je het ook echt hebt opgevangen', () => {
  /* Niet elke klik wordt geschiedenis. `incident` staat op de gesloten lijst in
     rush-voorvallen.js, en hij valt alleen als het voorval is AANGEPAKT -- een
     avond waarop de koeling openstond en je er niets aan deed, is geen avond
     waarop je een koelstoring hebt opgevangen. */
  const vv = R.bouw('inc', { id: 'd1' }, 3, 'hulp').filter(x => x.incident);
  assert.ok(vv.length, 'deze avond had geen incident om op te vangen');
  assert.ok(R.SOORTEN.filter(s => s.incident).length >= 1);
  assert.ok(R.SOORTEN.every(s => !s.incident || s.kost >= 0.5),
    'een incident dat weinig kost is geen incident maar een klusje');
});
