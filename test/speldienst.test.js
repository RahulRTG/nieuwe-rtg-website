/* MAGNAAT: LOONDIENST -- een speler die voor een andere speler werkt.

   Stap 1 uit VERHAAL.md, en met opzet zonder permanentie: alles hieronder leeft
   in het potje. Zeven beweringen, en ze zijn alle zeven stil terug te draaien:

   1. EEN SALARIS IS EEN OVERDRACHT. Aan tafel verandert het totaal niet -- dat
      is het hele verschil met de AI-manager, wiens tarief de wereld verlaat.
   2. EEN ROL GEEFT PRECIES WAT ER IN STAAT, en geen veld meer.
   3. EEN WERKNEMER HEEFT GEEN EIGEN INGANG. Hij loopt door dezelfde `beleid`.
   4. OPZEGGEN KAN ALTIJD, van beide kanten, zonder boete.
   5. EEN LOON LIGT IN EEN BAND, want daarbuiten is het geen loon maar een gift.
   6. BEIDE KANTEN ZIEN HET, en niemand ziet de boeken van een ander.
   7. DE GELDPOMPKEURING BLIJFT SCHOON met mensen in dienst.

   Draai los: node --experimental-sqlite --test test/speldienst.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const D = require('../server/kern/spellen/magnaat/dienst');
const { SECTOREN } = require('../server/kern/spellen/magnaat/sectoren');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kavelsIn = (zone) => kaart('ijmuiden').kavels.filter(k => k.zone === zone);

/* Anna heeft een zaak, Boris heeft niets. Precies hoofdstuk 1: de een staat
   achter de bar, de ander komt binnenlopen. */
function opstelling(id = 'p1') {
  const m = maakMagnaat();
  const p = { id, soort: 'magnaat', spelers: ['anna', 'boris'], teams: [0, 1], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of p.spelers) p.staat.geld[h] = 2000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelsIn('boulevard')[0].id, sector: 'horeca', omvang: 30 });
  const zaak = p.staat.vestigingen.anna[0];
  const maand = (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } };
  /* De hele weg in EEN handeling, want zes toetsen hieronder beginnen ermee en
     die weg is niet wat ze meten. */
  const inDienst = (rol = 'bedrijfsleider', loon) => {
    const r = m.eco.zet(p, 'anna', Object.assign({ actie: 'functie-openen', vestiging: zaak.id, rol },
      loon === undefined ? {} : { loon }));
    m.eco.zet(p, 'boris', { actie: 'solliciteren', id: r.id });
    return m.eco.zet(p, 'anna', { actie: 'aannemen', id: r.id, speler: 'boris' });
  };
  return { m, p, st: p.staat, zaak, maand, inDienst };
}

/* ================= 1. een salaris is een overdracht ================= */

test('wat de werkgever betaalt, ontvangt de werknemer -- tot op de euro', () => {
  const { m, p, st, maand, inDienst } = opstelling();
  const d = inDienst('bedrijfsleider');
  assert.ok(d.ok, JSON.stringify(d));
  const voorAnna = st.geld.anna, voorBoris = st.geld.boris;
  maand(1);
  const loon = st.diensten[0].loon;
  assert.equal(Math.round(st.geld.boris - voorBoris), loon,
    'boris ontvangt precies zijn loon en verder niets');
  /* Anna betaalt meer dan het loon, want haar zaak draait ook -- dus wordt de
     bewering gesteld op de REGEL en niet op het kasverschil. */
  const regel = st.laatste.anna.regels.find(r => r.soort === 'salaris');
  assert.ok(regel, 'het staat als eigen regel op haar overzicht');
  assert.equal(regel.resultaat, -loon);
  assert.ok(voorAnna > 0);
});

test('aan tafel verandert het totaal niet, en dat is het verschil met de manager', () => {
  /* DE KERN VAN DEZE LAAG. Een beheertarief verlaat de wereld (./beheer.js), een
     salaris niet. Twee identieke werelden naast elkaar: in de ene werkt boris
     voor anna, in de andere niet. Het totale vermogen aan tafel hoort na twaalf
     maanden precies gelijk te zijn -- want er is alleen geld VERSCHOVEN. */
  const totaal = (m, p) => m.eco.eindstand(p).reduce((n, x) => n + x.vermogen, 0);
  const zonder = opstelling('gelijk');
  zonder.maand(12);
  const met = opstelling('gelijk');
  met.inDienst('hulp');
  met.maand(12);
  const verschil = Math.abs(totaal(met.m, met.p) - totaal(zonder.m, zonder.p));
  assert.ok(verschil < 2, 'een salaris schept en vernietigt niets: verschil ' + Math.round(verschil));
  // en het is wel degelijk betaald
  assert.ok(met.st.diensten[0].betaaldTotaal > 0);
});

/* ================= 2 en 3. wat een rol geeft ================= */

test('een rol geeft precies de velden die erin staan', () => {
  const { m, p, st, zaak, inDienst } = opstelling();
  inDienst('vakkracht');
  assert.ok(m.eco.zet(p, 'boris', { actie: 'werk-beleid', onderhoud: 900 }).ok,
    'een vakkracht zet het onderhoud');
  assert.equal(st.vestigingen.anna[0].onderhoudBudget, 900);
  const nee = m.eco.zet(p, 'boris', { actie: 'werk-beleid', prijs: 'hoog' });
  assert.equal(nee.status, 403);
  assert.match(nee.error, /prijs/);
  assert.notEqual(st.vestigingen.anna[0].prijs, 'hoog', 'en er is ook niets veranderd');
});

test('een werknemer verandert niets rechtstreeks: hij loopt door dezelfde beleid-actie', () => {
  /* DE WET VAN DE AI-MANAGER, hier op een mens. Zou `werk-beleid` zelf het veld
     zetten, dan bestaat er een tweede weg naar dezelfde verandering en is de
     vraag "wie mag dit" op twee plekken beantwoord. De toets: een bedrijfsleider
     kan via zijn actie niets doen wat de EIGENAAR via `beleid` ook niet kan --
     dus wordt een onmogelijke waarde precies zo geweigerd. */
  const { m, p, st, inDienst } = opstelling();
  inDienst('bedrijfsleider');
  /* Hij staat sinds fase D in ./dienst-delegeren.js, naast `bestuur-zet`: daar
     staat wat een ROL mag, hier hoe een dienstverband ontstaat. */
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/dienst-delegeren'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(/ACTIES\.beleid\(/.test(bron), 'werk-beleid roept de gewone beleid-actie aan');
  assert.ok(!/v\.(prijs|onderhoudBudget|marketing)\s*=/.test(bron),
    'en zet zelf geen enkel veld op een vestiging');
  // dezelfde weigering als de eigenaar zou krijgen
  const raar = m.eco.zet(p, 'boris', { actie: 'werk-beleid', prijs: 'goud' });
  assert.ok(!raar.ok || st.vestigingen.anna[0].prijs !== 'goud');
});

test('wie nergens in dienst is, verandert niets', () => {
  const { m, p } = opstelling();
  const r = m.eco.zet(p, 'boris', { actie: 'werk-beleid', onderhoud: 500 });
  assert.equal(r.status, 403);
});

/* ================= 4. opzeggen kan altijd ================= */

test('opzeggen kan van beide kanten, zonder boete, en stopt het loon', () => {
  const { m, p, st, maand, inDienst } = opstelling();
  inDienst('bedrijfsleider');
  maand(1);
  const naEen = st.geld.boris;
  const r = m.eco.zet(p, 'boris', { actie: 'dienst-opzeggen', id: st.diensten[0].id });
  assert.ok(r.ok);
  assert.equal(r.reden, 'opgezegd');
  maand(1);
  assert.equal(Math.round(st.geld.boris), Math.round(naEen), 'na opzeggen komt er niets meer binnen');
  assert.equal(st.diensten[0].status, 'geeindigd');
  // en de werkgever kan hetzelfde, met een andere reden
  const tweede = opstelling('p2');
  tweede.inDienst('hulp');
  assert.equal(tweede.m.eco.zet(tweede.p, 'anna',
    { actie: 'dienst-opzeggen', id: tweede.st.diensten[0].id }).reden, 'ontslagen');
});

test('een derde kan andermans dienstverband niet opzeggen', () => {
  const m = maakMagnaat();
  const p = { id: 'p3', soort: 'magnaat', spelers: ['anna', 'boris', 'chris'], teams: [0, 1, 2],
    modus: 'vrij', status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of p.spelers) p.staat.geld[h] = 2000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelsIn('boulevard')[0].id, sector: 'horeca', omvang: 30 });
  const f = m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: p.staat.vestigingen.anna[0].id, rol: 'hulp' });
  m.eco.zet(p, 'boris', { actie: 'solliciteren', id: f.id });
  m.eco.zet(p, 'anna', { actie: 'aannemen', id: f.id, speler: 'boris' });
  assert.equal(m.eco.zet(p, 'chris', { actie: 'dienst-opzeggen', id: p.staat.diensten[0].id }).status, 403);
});

/* ================= 5. het loon ligt in een band ================= */

test('een loon buiten de band is geen loon maar een gift', () => {
  const { m, p, st, zaak } = opstelling();
  const band = D.loonband(SECTOREN.horeca.loon, 'bedrijfsleider');
  assert.ok(band.min > 0 && band.max > band.basis);
  const teHoog = m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: zaak.id,
    rol: 'bedrijfsleider', loon: band.max + 1 });
  assert.equal(teHoog.status, 400);
  const teLaag = m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: zaak.id,
    rol: 'bedrijfsleider', loon: band.min - 1 });
  assert.equal(teLaag.status, 400);
  assert.ok(m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: zaak.id,
    rol: 'bedrijfsleider', loon: band.max }).ok);
  assert.equal(D.functies(st).length, 1, 'alleen de geldige staat er');
});

test('een tegenbod van de kandidaat is het loon dat geldt', () => {
  /* Anders is onderhandelen een briefje dat niemand leest. */
  const { m, p, st, zaak } = opstelling();
  const band = D.loonband(SECTOREN.horeca.loon, 'vakkracht');
  const f = m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: zaak.id, rol: 'vakkracht', loon: band.basis });
  m.eco.zet(p, 'boris', { actie: 'solliciteren', id: f.id, loon: band.max });
  m.eco.zet(p, 'anna', { actie: 'aannemen', id: f.id, speler: 'boris' });
  assert.equal(st.diensten[0].loon, band.max, 'het loon uit de sollicitatie telt, niet dat uit de vacature');
});

test('een rol per zaak, en niet bij jezelf solliciteren', () => {
  const { m, p, zaak, inDienst } = opstelling();
  inDienst('bedrijfsleider');
  assert.equal(m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: zaak.id,
    rol: 'bedrijfsleider' }).status, 409);
  const f = m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: zaak.id, rol: 'hulp' });
  assert.equal(m.eco.zet(p, 'anna', { actie: 'solliciteren', id: f.id }).status, 400);
  assert.equal(m.eco.zet(p, 'boris', { actie: 'solliciteren', id: f.id }).status, 409,
    'en boris heeft al een baan');
});

/* ================= 6. beide kanten zien het ================= */

test('werkgever en werknemer zien allebei het dienstverband, en verder niets van elkaar', () => {
  const { m, p, st, maand, inDienst } = opstelling();
  inDienst('bedrijfsleider');
  maand(1);
  const vanBoris = m.eco.zicht(p, st, 'boris');
  const regel = (vanBoris.laatste.regels || []).find(r => r.soort === 'loon');
  assert.ok(regel && regel.resultaat > 0, 'boris ziet wat hij verdiende op zijn eigen overzicht');
  assert.ok(vanBoris.werk.baan && vanBoris.werk.baan.rol === 'bedrijfsleider',
    'en zijn baan staat op zijn scherm');
  assert.deepEqual(vanBoris.werk.baan.mag, D.ROLLEN.bedrijfsleider.mag, 'met wat hij mag erbij');
  const vanAnna = m.eco.zicht(p, st, 'anna');
  assert.equal(vanAnna.werk.mijnMensen.length, 1, 'anna ziet wie er voor haar werkt');
  assert.equal(vanAnna.werk.baan, null, 'en zij heeft zelf geen baan');
  const alles = JSON.stringify(vanBoris);
  assert.ok(!alles.includes('"geld":' + Math.round(st.geld.anna)),
    'en niet de kas van zijn werkgever');
});

test('een vacature is publiek, wie er solliciteerden niet', () => {
  /* VERHAAL.md wil uitdrukkelijk ook VREEMDEN die bij je komen, dus een baan die
     je alleen ziet als je iemand kent is de verkeerde wereld. Wie er reageerden
     is een ander verhaal: dat staat in de boeken van de werkgever, net als zijn
     kas. */
  const { m, p, st, zaak } = opstelling();
  const f = m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: zaak.id, rol: 'hulp' });
  const vanBoris = () => m.eco.zicht(p, st, 'boris').werk;
  assert.equal(vanBoris().vacatures.length, 1, 'boris kent anna niet en ziet de vacature toch');
  assert.equal(vanBoris().vacatures[0].gesolliciteerd, false);
  m.eco.zet(p, 'boris', { actie: 'solliciteren', id: f.id });
  /* Hij blijft staan, met een merkteken. Verdwijnen zou verkeerd zijn: de
     werkgever heeft nog niets besloten, en een sollicitatie die van je scherm
     valt voelt als een afwijzing die niemand gaf. */
  assert.equal(vanBoris().vacatures.length, 1);
  assert.equal(vanBoris().vacatures[0].gesolliciteerd, true);
  assert.equal(vanBoris().mijnFuncties.length, 0, 'hij ziet andermans sollicitatiestapel niet');
  assert.equal(m.eco.zicht(p, st, 'anna').werk.mijnFuncties[0].sollicitaties.length, 1);
});

test('een baan kost geen pas en geen cent vooraf', () => {
  /* VERHAAL.md grens 3, en het is een echte toets en geen belofte: boris begint
     met NUL en kan gewoon in dienst. Zou er ergens een drempel staan, dan is
     "je begint als afwasser met 412 euro" een verkoopgesprek. */
  const { m, p, st, zaak } = opstelling();
  st.geld.boris = 0;
  const f = m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: zaak.id, rol: 'hulp' });
  assert.ok(m.eco.zet(p, 'boris', { actie: 'solliciteren', id: f.id }).ok);
  assert.ok(m.eco.zet(p, 'anna', { actie: 'aannemen', id: f.id, speler: 'boris' }).ok);
  assert.equal(st.geld.boris, 0, 'er is niets afgeschreven');
});

test('solliciteren en aannemen mogen buiten de beurt', () => {
  /* Een sollicitatie die op je beurt moet wachten duurt in een partij van zes
     met 24 uur per beurt een week. Zelfde redenering als bij de contracten.

     De toets staat op de DESCRIPTOR en niet op een geslaagde zet: de motor leest
     `buitenBeurt` om te beslissen of hij een zet buiten de beurt toestaat, dus
     dat is de plek waar het waar of niet waar is. */
  const spel = maakMagnaat().spel;
  for (const naam of ['functie-openen', 'functie-intrekken', 'solliciteren', 'aannemen',
    'dienst-opzeggen', 'werk-beleid'])
    assert.ok(spel.buitenBeurt.includes(naam), naam + ' hoort een vrije actie te zijn');
  // en het werkt ook echt: boris is niet aan de beurt en solliciteert toch
  const { m, p, zaak } = opstelling();
  p.beurt = 0;                       // anna is aan zet
  const f = m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: zaak.id, rol: 'hulp' });
  assert.ok(m.spel.zet(p, 'boris', { actie: 'solliciteren', id: f.id }).ok);
});

/* ================= 7. de geldpompkeuring ================= */

test('de geldpompkeuring blijft schoon met mensen in dienst', () => {
  const { meet } = require('../scripts/magnaat-pomp');
  assert.equal(meet('loondienst', 12).klacht, null);
  assert.equal(meet('salariscarrousel', 12).klacht, null);
});

test('de functie verloopt op de spelmaand en niet op de klok', () => {
  const { m, p, st, zaak, maand } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: zaak.id, rol: 'hulp' });
  maand(D.FUNCTIE_MAANDEN - 1);
  assert.equal(D.functies(st)[0].status, 'open');
  maand(2);
  assert.equal(D.functies(st)[0].status, 'verlopen');
  assert.equal(m.eco.zet(p, 'boris', { actie: 'solliciteren', id: D.functies(st)[0].id }).status, 404);
});
