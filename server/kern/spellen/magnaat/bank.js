/* Magnaat: DE BANK -- wat geld kost, en waarom het niet voor iedereen hetzelfde kost.

   De eerste laag in dit spel waar geld de WERELD verlaat. Alles tot nu toe
   verplaatste: een contract betaalt de een en verrijkt de ander, een veiling
   verschuift een zaak, een deelneming splitst een resultaat. Rente doet dat
   niet -- die gaat naar een bank die geen speler is en komt nooit terug. Dat
   maakt deze laag anders om te toetsen (zie de derde categorie in
   scripts/magnaat-pomp.js) en het maakt hem gevaarlijk: een fout hier lekt
   stilletjes vermogen weg of drukt het bij.

   VIJF VORMEN, EN ELKE VORM MAAKT EEN ANDERE MANIER VAN SPELEN MOGELIJK. Dat is
   de toets die ze moesten doorstaan; een vorm die alleen een ander getal is,
   staat er niet in.

     rekeningcourant  je kas mag onder nul, tot een limiet. Duur, direct, geen
                      aanvraag. Dit IS de oude ROOD_RENTE, nu met een dak erop.
                      Maakt mogelijk: doorbouwen op het randje.
     werkkapitaal     kort en aflossingsvrij, voor een seizoen. Je betaalt alleen
                      rente en aan het eind alles ineens.
                      Maakt mogelijk: een piek voorfinancieren.
     investering      lang, lineair aflossend, ongedekt. De gewone manier om
                      sneller te groeien dan je winst toelaat.
                      Maakt mogelijk: schaal kopen met andermans geld.
     vastgoed         lang en goedkoop, met een KAVEL als onderpand. Betaal je
                      niet, dan raak je die zaak kwijt -- niet je hele bedrijf.
                      Maakt mogelijk: veilig zwaar lenen, met een scherpe rand.
     achtergesteld    duur en ongedekt, maar telt bij de convenanten als EIGEN
                      vermogen. Zo koop je ruimte om elders te lenen.
                      Maakt mogelijk: een hefboom op een hefboom.

   WAT ER BEWUST NIET IN ZIT: obligaties en durfkapitaal. Allebei vragen een
   MARKT met andere partijen dan de bank -- een obligatie zonder kopers is een
   dure lening met een ander woord erop, en durfkapitaal zonder een echte
   investeerder is een subsidie. Ze horen bij de aandelenmarkt en niet hier.

   DE PRIJS VAN GELD IS EEN OPTELSOM, en elke term komt uit een spelvariabele
   die de speler ZELF beweegt. Dat is de hele bedoeling: wie zijn zaken op orde
   houdt, leent goedkoper, en dat is te zien voordat hij tekent.

   DE KREDIETSCORE IS ZICHTBAAR, en dat is een besluit. Een verborgen cijfer dat
   je rente bepaalt is een dobbelsteen met een verhaaltje; een zichtbaar profiel
   is een doel om naartoe te werken. Zie ./bankprofiel.js. */
const { SECTOREN } = require('./sectoren');

const rond = (n) => Math.round(n);
const klem = (n, a, b) => Math.max(a, Math.min(b, n));

/* De vormen. `basis` is de maandrente voor een vlekkeloos profiel; de opslagen
   komen erbovenop. `dekking` zegt hoeveel je maximaal mag lenen ten opzichte
   van waar het om gaat -- bij vastgoed de waarde van de zaak, bij de rest je
   eigen vermogen. */
const VORMEN = {
  rekeningcourant: {
    naam: 'Rekening-courant', basis: 0.014, aflossend: false, looptijd: null,
    dekking: 0.35, onderpand: false, achtergesteld: false,
    /* Geen aanvraag en geen covenant: dit is de kredietlijn die er altijd is.
       De prijs ervoor is dat hij het duurst is en het kleinst. */
    automatisch: true, covenanten: []
  },
  werkkapitaal: {
    naam: 'Werkkapitaalkrediet', basis: 0.009, aflossend: false, looptijd: [3, 12],
    dekking: 0.60, onderpand: false, achtergesteld: false,
    covenanten: ['liquiditeit']
  },
  investering: {
    naam: 'Investeringslening', basis: 0.007, aflossend: true, looptijd: [12, 96],
    dekking: 1.20, onderpand: false, achtergesteld: false,
    covenanten: ['liquiditeit', 'schuldlast']
  },
  vastgoed: {
    naam: 'Vastgoedfinanciering', basis: 0.0045, aflossend: true, looptijd: [24, 180],
    dekking: 0.70, onderpand: true, achtergesteld: false,
    covenanten: ['schuldlast']
  },
  achtergesteld: {
    naam: 'Achtergestelde lening', basis: 0.018, aflossend: false, looptijd: [24, 120],
    dekking: 0.50, onderpand: false, achtergesteld: true,
    covenanten: []
  }
};
const VORMLIJST = Object.keys(VORMEN);

/* HOEVEEL RISICO DRAAGT EEN SECTOR? Niet verzonnen maar afgeleid uit hoe de
   sector werkt: wie zwaar van het seizoen afhangt heeft grillige inkomsten, en
   wie hoge vaste lasten per eenheid heeft, valt sneller om als het tegenzit.
   Twee getallen die al in ./sectoren.js staan; een derde tabel zou een derde
   waarheid worden. */
function sectorrisico(sector) {
  const s = SECTOREN[sector];
  if (!s) return 0.5;
  const hefboom = klem(s.vast * s.perMaand / (s.prijs[1] * 12), 0, 1);
  return klem(s.seizoen * 0.6 + hefboom * 0.4, 0, 1);
}

/* De rente-opslagen. Elke term staat apart zodat het scherm hem kan uitleggen
   EN Rahul hem kan navertellen zonder iets te verzinnen -- dezelfde reden als
   bij de vraagstappen in ./vraag.js. */
function renteVoor(vorm, profiel, { sector, looptijd, cyclus }) {
  const v = VORMEN[vorm];
  const stap = {
    basis: v.basis,
    // een zwakke balans is duurder, en dit is de zwaarste term
    schuld: (1 - profiel.schuldpositie) * 0.010,
    // wie geen buffer heeft, betaalt voor het risico dat hij die nodig heeft
    liquiditeit: (1 - profiel.liquiditeit) * 0.006,
    // wie zijn verplichtingen nakomt, leent goedkoper
    discipline: (1 - profiel.betalingsdiscipline) * 0.008,
    // vaste inkomsten uit contracten maken een bank rustiger
    zekerheid: (1 - profiel.contractzekerheid) * 0.004,
    // een grillige winst is duurder dan een saaie
    stabiliteit: (1 - profiel.winststabiliteit) * 0.005,
    sector: sectorrisico(sector || 'horeca') * 0.004,
    // langer vastzetten kost meer, maar niet lineair
    looptijd: v.looptijd ? Math.sqrt(klem(looptijd || v.looptijd[0], 1, 240)) * 0.00035 : 0,
    // de conjunctuur schuift alles op; komt later uit de gebeurtenislaag
    cyclus: (cyclus || 0) * 0.004
  };
  /* ONDERPAND HAALT ER TWEE DINGEN AF: een vast stuk, want zekerheid is altijd
     iets waard, en de HELFT van de opslagen die over jouw balans gaan -- een
     pand in handen vervangt precies dat deel van je kredietwaardigheid. Zonder
     dat vaste stuk krijgt een speler met een vlekkeloze balans nul korting, en
     dan lijkt de term te bestaan terwijl hij niets doet. */
  if (v.onderpand) stap.onderpand = -(0.0015 + (stap.schuld + stap.liquiditeit) * 0.5);
  const totaal = Object.values(stap).reduce((n, x) => n + x, 0);
  return { rente: klem(totaal, 0.002, 0.05), stap };
}

/* ---------- de convenanten ----------
   DRIE TRAPPEN EN GEEN BESLAG, en dat is het besluit dat financiering
   strategisch maakt in plaats van eng. Een bank die bij de eerste misstap je
   zaak inneemt, is een bank waar niemand ooit heenloopt -- en dan is de hele
   laag decoratie. In het echt gaat het ook zo: eerst een brief, dan een prijs,
   dan pas de deur.

     1. GESIGNALEERD  je krijgt het te horen en verder niets.
     2. OPSLAG        de rente gaat omhoog zolang je eroverheen zit, en je mag
                      niet bijlenen.
     3. OPEISBAAR     na een half jaar aanhoudende breuk wordt de lening
                      opgeeist: het restant moet uit de kas, en lukt dat niet,
                      dan gaat het onderpand eraan. Heeft de lening geen
                      onderpand, dan blijft de schuld staan tegen de hoogste
                      opslag -- een ongedekte lening kan niemand afpakken. */
const NORMEN = {
  liquiditeit: { naam: 'liquiditeitsbuffer', grens: 0.15,
    uitleg: 'ten minste 15% van je jaarlasten in kas' },
  schuldlast: { naam: 'schuld ten opzichte van winst', grens: 4,
    uitleg: 'schuld onder vier keer de jaarwinst' }
};
const TRAP = { signaal: 1, opslag: 2, opeisbaar: 6 };   // in maanden aanhoudende breuk
const BREUK_OPSLAG = 0.006;

/* Welke normen breekt deze speler NU? Uit het profiel en niet uit een teller:
   een norm die je vandaag haalt, is vandaag gehaald. */
function breuken(lening, cijfers) {
  const v = VORMEN[lening.soort];
  const uit = [];
  for (const norm of v.covenanten) {
    if (norm === 'liquiditeit' && cijfers.buffer < NORMEN.liquiditeit.grens) uit.push('liquiditeit');
    if (norm === 'schuldlast' && cijfers.schuldlast > NORMEN.schuldlast.grens) uit.push('schuldlast');
  }
  return uit;
}

const trapVan = (maanden) => (maanden >= TRAP.opeisbaar ? 'opeisbaar'
  : maanden >= TRAP.opslag ? 'opslag' : maanden >= TRAP.signaal ? 'signaal' : null);

/* ---------- de maand ----------
   Rente over het restant, dan de aflossing, dan de convenanten. In die
   volgorde, want een aflossing verlaagt het restant en zou anders de rente van
   diezelfde maand drukken -- en dan hangt je rentelast af van het moment waarop
   de motor toevallig aflost. */
function maandVoor(lening, cijfers) {
  const v = VORMEN[lening.soort];
  const rente = lening.restant * (lening.rente + (lening.opslag || 0));
  let aflossing = 0;
  if (v.aflossend && lening.looptijd > 0) aflossing = Math.min(lening.restant, lening.hoofdsom / lening.looptijd);
  const stuk = breuken(lening, cijfers);
  return { rente, aflossing, breuken: stuk };
}

/* Wat een speler MAG lenen bij deze vorm, gegeven wat hij heeft. `ruimte` is
   het plafond; wat er al staat gaat eraf. Achtergestelde leningen tellen bij
   de andere vormen als eigen vermogen mee -- dat is precies waar ze voor zijn. */
function ruimte(vorm, { vermogen, onderpandwaarde, schuld, achtergesteldeSchuld }) {
  const v = VORMEN[vorm];
  const basis = v.onderpand ? (onderpandwaarde || 0) : Math.max(0, vermogen + (achtergesteldeSchuld || 0));
  return Math.max(0, rond(basis * v.dekking - (v.onderpand ? 0 : schuld || 0)));
}

module.exports = { VORMEN, VORMLIJST, NORMEN, TRAP, BREUK_OPSLAG,
  renteVoor, sectorrisico, breuken, trapVan, maandVoor, ruimte };
