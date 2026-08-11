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
const { VORMEN, VORMLIJST } = require('./bankvormen');

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

/* DE CONVENANTEN staan in ./convenant.js -- de normen, de trappen en wat een
   breuk betekent. Een eigen onderwerp: die tabel gaat over wat een bank van je
   VERWACHT, en de tabel hierboven over wat hij je VERKOOPT. */
const { NORMEN, TRAP, BREUK_OPSLAG, breuken, trapVan } = require('./convenant');

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
function ruimte(vorm, { vermogen, onderpandwaarde, schuld, achtergesteldeSchuld, onderpandSchuld }) {
  const v = VORMEN[vorm];
  if (v.onderpand) {
    /* WAT ER AL OP DIT PAND RUST GAAT ERAF, en die regel ontbrak. Zonder hem kon
       een speler telkens opnieuw zeventig procent van dezelfde waarde lenen: het
       pand was elke ronde weer "onbelast". Dat is de onderpandspiraal in zijn
       zuiverste vorm -- geen waardering die meestijgt, maar een zekerheid die
       oneindig vaak vergeven wordt. Gevonden door de pomptoets die twee keer de
       helft tegen hetzelfde pand probeerde. */
    return Math.max(0, rond((onderpandwaarde || 0) * v.dekking - (onderpandSchuld || 0)));
  }
  return Math.max(0, rond(Math.max(0, vermogen + (achtergesteldeSchuld || 0)) * v.dekking - (schuld || 0)));
}

module.exports = { VORMEN, VORMLIJST, NORMEN, TRAP, BREUK_OPSLAG,
  renteVoor, sectorrisico, breuken, trapVan, maandVoor, ruimte };
