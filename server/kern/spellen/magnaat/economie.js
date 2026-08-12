/* Magnaat: DE ECONOMISCHE PARTIJ -- de wereld, de klok en wat je erin doet.

   Dit is `vorm: 'economie'`: geen bord met velden maar een stad met kavels,
   bedrijven, personeel en een klok die doorloopt. Het bordspel staat er nog
   gewoon naast (./bordspel.js) en deelt niets met deze motor behalve de
   descriptor -- twee vormen, een spel.

   DE KLOK REKENT BIJ, HIJ TIKT NIET. Zie GAMEHALL.md paragraaf 12.4: bij elke
   aanraking van een partij wordt uitgerekend hoeveel spelmaanden er sinds de
   vorige stand verstreken zijn, en die worden een voor een gerekend. Dat
   overleeft een herstart, schrijft niets terwijl niemand speelt, en is
   deterministisch -- tien stappen achter elkaar geven hetzelfde als tien
   stappen verspreid over een dag. Zonder die eigenschap zou "sinds je weg was"
   van je pollgedrag afhangen.

   ALTIJD IETS TE DOEN. De acties vallen in twee soorten (paragraaf 12.3):
   GROTE acties (een kavel nemen, een vestiging openen, uitbreiden) horen bij je
   beurt; VRIJE acties (prijs, personeel, marketing, onderhoud) mogen altijd.
   De descriptor draagt dat via `buitenBeurt`, en de motor houdt zich eraan door
   niets anders te doen dan wat de speler vraagt.

   HIER STOND WAT ER NOG NIET WAS: contracten, aandelen, banken, onderzoek,
   veilingen, de permanente wereld. Ze zijn er allemaal (fase B en C), en een
   lijst die niet klopt is erger dan geen lijst -- wat er is staat in
   ./lagen.js en ./tabel.js. */
const { kaart, STEDENLIJST, stadNaam, stadSleutel } = require('./kaart');
const { SECTORLIJST } = require('./sectoren');
const { waarde } = require('./stap');
const F = require('./foundation');
const H = require('./handel');
const G = require('./governance');

/* De speelduur in SPELMAANDEN, per variant. Een Quick is drie jaar economie in
   een klein uur: lang genoeg dat een investering zich terugbetaalt, kort genoeg
   dat je hem uitspeelt. */
const DUUR = { quick: 36, avond: 96, weekend: 240 };
// hoeveel echte milliseconden een spelmaand duurt
const MAAND_MS = { quick: 100000, avond: 150000, weekend: 720000 };
const START_GELD = 250000;
const ROOD_RENTE = 0.014;          // maandrente op een negatieve kas; zie de reden bij het gebruik
const MAX_MAANDEN_PER_KEER = 60;   // een vangnet: een partij die maanden lag hoort niet in een keer door te rekenen

const rond = (n) => Math.round(n);

module.exports = (ctx) => {
  const { save, codenaamVan, nudge, herkomst } = ctx;

  /* ---------- opzetten ---------- */
  /* DE OPZET VAN EEN PARTIJ staat in ./opzet.js -- de lege wereld voordat er
     iets gebeurd is. Die lijst groeit met elke laag mee; de klok hieronder niet. */
  const init = require('./opzet')({ DUUR, MAAND_MS, START_GELD });

  /* HOE JE IETS TERUGVINDT IN DE STAAT staat in ./vinden.js: welk kavel, welke
     vestiging, van wie. Vier vragen die overal in deze map worden gesteld en
     die met de lagen zijn meegegroeid -- ze horen bij elkaar en niet tussen de
     klok. */
  const { K, vrijKavel, mijnVestiging, wieHeeft } = require('./vinden')({ kaart });

  /* ---------- de klok ---------- */
  /* Hoeveel spelmaanden zijn er verstreken? Uit de KLOK van de server en niet
     uit een teller die bij elke aanraking oploopt: anders bepaalt hoe vaak je
     ververst hoe snel de tijd gaat. */
  function bijrekenen(potje) {
    const st = potje.staat;
    if (st.klaar) return [];
    const nu = Date.now();
    let stappen = Math.floor((nu - st.gerekendTot) / st.maandMs);
    if (stappen <= 0) return [];
    if (stappen > MAX_MAANDEN_PER_KEER) stappen = MAX_MAANDEN_PER_KEER;
    const verslagen = [];
    for (let i = 0; i < stappen && st.maand < st.duur; i++) {
      /* DE HAMER VALT AAN HET EIND VAN DE MAAND WAARIN DE VEILING SLUIT: een
         veiling van twee maanden sluit na twee maanden, niet na drie. Hij valt
         HIER, in de bijrekenlus, zodat hij deterministisch sluit -- tien maanden
         in een keer geeft dezelfde winnaar als tien maanden los, en dat is de
         eis onder GAMEHALL.md 12.4. De koper draait de zaak vanaf de volgende
         maand; de opbrengst van de laatste maand is nog van de verkoper, en dat
         is de eerlijke kant van "je neemt hem over aan het eind van de maand". */
      /* DE AI-SPELERS ZETTEN VOOR DE MAAND GEREKEND WORDT, want zo doet een mens
         het ook: je verzet je beleid en dan draait de maand. Ze spelen door
         dezelfde acties en op hetzelfde scherm (`zicht`) als iedereen -- zie
         ./concurrent.js. */
      for (const [h, ai] of Object.entries(st.ai || {})) {
        if (!ai || !potje.spelers.includes(h)) continue;
        aiZet.maandVoorAI(potje, h, ai, zichtRuw(potje, st, h));
      }
      const verslag = eenMaand(potje);
      const geveild = L.hameren(potje);
      if (geveild.length) verslag.veilingen = geveild;
      verslagen.push(verslag);
    }
    st.gerekendTot += stappen * st.maandMs;
    if (st.maand >= st.duur && !st.klaar) beeindig(potje);
    return verslagen;
  }

  /* WAT ER IN EEN MAAND GEBEURT staat in ./maand.js, en dat is een echte naad:
     dit bestand gaat over WANNEER er een maand gerekend wordt en dat is af. Wat
     er IN een maand gebeurt groeit met elke fase mee -- fase B zette er de
     contractafwikkeling in. */
  /* De deelnemingen staan HIER en niet bij de andere lagen hieronder, omdat de
     maandloop ze nodig heeft: het resultaat van een vestiging wordt verdeeld
     voordat het op een rekening komt. */
  /* DE LAGEN VAN FASE B (contracten, veilingen, belangen, bank, verzekering)
     worden in ./lagen.js samengesteld. Dit bestand gaat over de KLOK en de
     levensloop van een partij, en dat is af; die lijst groeit met elke fase mee.
     Twee dingen met zo'n verschillend tempo horen niet in een bestand. */
  const L = require('./lagen')({ K, mijnVestiging, vrijKavel, wieHeeft, waarde, rond, codenaamVan, herkomst });

  /* WAT EEN SPELER DOET wordt in ./tabel.js samengesteld -- de basisacties, de
     acties van elke laag, en de twee AI's die de complete tabel nodig hebben.
     Dat is een bouwstap die met elke fase meegroeit; dit bestand gaat over de
     klok en die verandert niet meer. */
  const { ACTIES, VRIJE_ACTIES, beheer, dienen, aiZet, promotie, rush } =
    require('./tabel')({ K, mijnVestiging, vrijKavel, rond, L });

  // wat de tafel koos voor de Foundation; "wie doet er nog mee" is een vraag
  // over de PARTIJ, en die woont hier -- zie ./governance.js en ./verloop.js
  const kiesProject = (p) => G.uitslag(p, L.uitstap.speeltNog);
  const { eenMaand } = require('./maand')({ K, wieHeeft, ROOD_RENTE,
    verdeel: L.verdeel, bank: L.bankmaand, onthoud: L.onthoud, verzekering: L.verzekering,
    rnd: L.rnd, beheer, kiesProject });

  /* WAT EEN SPELER ZIET en wat er aan het eind op tafel komt staat in
     ./weergave.js -- een eigen onderwerp (wie mag wat weten, en waarop wordt
     er afgerekend) dat los staat van de klok hierboven. */
  const { zicht, zichtRuw, publiek, eindstand, tijdlijn } = require('./weergave')(Object.assign({
    K, codenaamVan, rond, bijrekenen,
    // promotie en DIENST reizen mee met het werkbeeld: geen tweede onderwerp
    // maar hetzelfde -- wat er met je baan gebeurt. Zie ./promotie.js, ./rush.js
    dienstbeeld: (potje, st, h) => Object.assign(dienen.beeld(st, h, codenaamVan),
      { promoties: promotie.beeld(st, h, codenaamVan) }, rush.vloer(potje, h)),
    // waar een speler vandaan komt (../loopbaan-profiel.js): meereizend met het
    // ZICHT en niet met de staat, want een profiel is een lezing en geen voorraad
    herkomst,
    foundationArbeid: (st) => F.arbeidBonus(st.foundation) }, L.zichtdelen));
  /* WIE ER AAN ZET IS EN WANNEER HET AF IS staat in ./verloop.js -- een echte
     naad: dit bestand gaat over de KLOK en die is af. Lees daar ook waarom de
     beurt in deze vorm NOOIT doorging. */
  const V = require('./verloop')({ eindstand, speeltNog: L.uitstap.speeltNog });
  const beeindig = V.beeindig;

  function zet(potje, h, z) {
    const st = potje.staat;
    if (st.klaar) return { status: 409, error: 'Deze campagne is afgelopen.' };
    bijrekenen(potje);
    if (st.klaar) return { status: 409, error: 'Deze campagne is net afgelopen.' };
    const actie = String(z.actie || '');
    if (!ACTIES[actie]) return { status: 400, error: 'Onbekende actie.' };
    const r = ACTIES[actie](potje, h, z);
    if (r.error) return r;
    /* DE BEURT GAAT DOOR NA EEN GROTE ZET, en niet na een vrije. Dat is precies
       het onderscheid dat ./acties.js maakt en dat de descriptor draagt: bouwen
       is een zet, je prijs verzetten is je huishouding. Het staat HIER en niet
       in elke actie apart, want dan is elke nieuwe grote actie een kans om het
       te vergeten. Zie ./verloop.js -- dit ontbrak, en daardoor kon in een
       campagne alleen speler EEN ooit een vestiging openen.
       En wie zojuist zelf uitstapte, laat de beurt niet op zich wachten. */
    if (!VRIJE_ACTIES.includes(actie)) V.volgende(potje);
    else V.herstel(potje);
    save();
    // een grote zet is nieuws voor de tafel; aan een prijswijziging heeft
    // niemand anders een duwtje
    if (!VRIJE_ACTIES.includes(actie)) potje.spelers.filter(sp => sp !== h).forEach(sp => nudge(sp, potje));
    /* Een voorstel is WEL nieuws, maar alleen voor de wederpartij -- die staat
       aan zet en weet het anders niet. De rest van de tafel gaat het niet aan:
       wie een contract sluit met wie is van die twee, en een duwtje naar
       iedereen zou verklappen DAT er onderhandeld wordt. */
    if (r.wek && r.wek !== h && potje.spelers.includes(r.wek)) nudge(r.wek, potje);
    return r;
  }

  /* De actietabel naar buiten, zodat een toets kan natellen dat de AI-manager
     elke actie die hij noemt ook werkelijk kan aanroepen. Niet om hem van
     buitenaf te gebruiken -- daar is  voor, met zijn poort en zijn duwtjes. */
  const acties = () => ACTIES;

  /* TWEE VRAGEN EN GEEN ZETTEN: wat uitstappen kost, en hoe de stemming staat.
     Ze veranderen niets en mogen dus ook door iemand die nog nadenkt. */
  const uitstapvoorstel = (potje, h, naar) => L.uitstap.voorstel(potje.staat, h, naar || null);
  const stembeeld = (potje, h) => G.beeld(potje, h, L.uitstap.speeltNog);

  return { init, zet, acties, zicht, publiek, bijrekenen, eindstand, uitstapvoorstel, stembeeld, tijdlijn,
    DUUR, MAAND_MS, START_GELD,
    SECTORLIJST, STEDENLIJST, stadNaam, kaartVan: (s) => kaart(s) };
};
