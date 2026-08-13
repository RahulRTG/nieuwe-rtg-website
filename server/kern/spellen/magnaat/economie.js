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

   WAT ER IN DEZE FASE NOG NIET IS, en dat staat hier zodat niemand het
   misverstaat: contracten tussen spelers, aandelen, banken, verzekeringen,
   onderzoek, veilingen, AI-managers en de permanente wereld. Fase B en C in
   GAMEHALL.md paragraaf 12.9. Wat er WEL is, is een economie die je kunt
   spelen, en dat was de eis. */
const { kaart, STEDENLIJST, stadNaam, stadSleutel } = require('./kaart');
const { SECTORLIJST } = require('./sectoren');
const { waarde } = require('./stap');
const F = require('./foundation');
const H = require('./handel');

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
  const { db, save, codenaamVan, nudge } = ctx;
  const hospitality = require('./hospitality');
  const worldModel = require('../../hospitality-universe/world-model');

  /* ---------- opzetten ---------- */
  function init(potje) {
    const v = potje.variant || {};
    const stadsleutel = stadSleutel(v.stad) || STEDENLIJST[0];
    const duur = DUUR[v.duur] || DUUR.quick;
    const st = {
      stad: stadsleutel, duur, maandMs: MAAND_MS[v.duur] || MAAND_MS.quick,
      maand: 0, begonnen: Date.now(), gerekendTot: Date.now(),
      geld: {}, vestigingen: {}, kavelBezet: {}, foundation: F.nieuw(),
      contracten: [], contractTeller: 0, veilingen: [], veilingTeller: 0, kavelRecht: {},
      deelnemingen: [], deelnemingTeller: 0, leningen: [], leningTeller: 0,
      resultaatlog: {}, betaalgemist: {}, polissen: [], polisTeller: 0,
      laatste: {}, klaar: false, hospitality: hospitality.nieuw(),
      universe: { wereld: worldModel.maak({ id: 'MAGNAAT-'+potje.id, seed: 'magnaat-'+potje.id }), briefing: null, vergelijking: null, evidence: null }
    };
    for (const h of potje.spelers) { st.geld[h] = START_GELD; st.vestigingen[h] = []; st.laatste[h] = null; }
    potje.staat = st;
  }

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
  const L = require('./lagen')({ K, mijnVestiging, vrijKavel, wieHeeft, waarde, rond, codenaamVan });

  const { eenMaand } = require('./maand')({ K, wieHeeft, ROOD_RENTE,
    verdeel: L.verdeel, bank: L.bankmaand, onthoud: L.onthoud, verzekering: L.verzekering });

  /* WAT EEN SPELER ZIET en wat er aan het eind op tafel komt staat in
     ./weergave.js -- een eigen onderwerp (wie mag wat weten, en waarop wordt
     er afgerekend) dat los staat van de klok hierboven. */
  const { zicht, publiek, eindstand } = require('./weergave')(Object.assign({
    K, codenaamVan, rond, bijrekenen,
    foundationArbeid: (st) => F.arbeidBonus(st.foundation) }, L.zichtdelen));
  function beeindig(potje) {
    const st = potje.staat;
    st.klaar = true;
    potje.status = 'klaar';
    const stand = eindstand(potje);
    // waarop er wordt afgerekend en waarom, staat bij de eindstand zelf (./weergave.js)
    if (stand.length > 1 && stand[0].vermogen === stand[1].vermogen) potje.gelijk = true;
    else potje.winnaar = stand[0].codenaam;
  }

  /* WAT EEN SPELER DOET staat in ./acties.js, en dat is een echte naad: dit
     bestand gaat over de WERELD (de klok, de maand, de eindstand) en dat blijft
     hetzelfde hoeveel knoppen er ook bijkomen. De actielijst groeit juist met
     elke fase mee -- contracten, veilingen, aandelen -- en die twee horen niet
     in een bestand. De aanleiding was de 10 kB-grens die scripts/check.js
     bewaakt, en die grens is precies een rem hierop. */
  const basis = require('./acties')({ K, mijnVestiging, vrijKavel, rond });
  /* De contractacties komen uit een EIGEN bestand en worden hier bijgeschoven.
     Ze zijn alle drie VRIJ (zie GAMEHALL.md 12.3): onderhandelen mag altijd,
     en dat is de reden dat een partij van zes met 24 uur per beurt niet
     stilstaat. */
  const SIM_ACTIES=require('./simulation-actions')({db,hospitality,
    director:require('../../hospitality-universe/director'),human:require('../../hospitality-universe/human-reality')});
  const ACTIES = Object.assign({}, basis.ACTIES, L.ACTIES, SIM_ACTIES);
  const VRIJE_ACTIES = basis.VRIJE_ACTIES.concat(L.VRIJE_ACTIES,Object.keys(SIM_ACTIES));

  function zet(potje, h, z) {
    const st = potje.staat;
    if (st.klaar) return { status: 409, error: 'Deze campagne is afgelopen.' };
    bijrekenen(potje);
    if (st.klaar) return { status: 409, error: 'Deze campagne is net afgelopen.' };
    const actie = String(z.actie || '');
    if (!ACTIES[actie]) return { status: 400, error: 'Onbekende actie.' };
    const r = ACTIES[actie](potje, h, z);
    if (r.error) return r;
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

  return { init, zet, zicht, publiek, bijrekenen, eindstand, DUUR, MAAND_MS, START_GELD,
    SECTORLIJST, STEDENLIJST, stadNaam, kaartVan: (s) => kaart(s) };
};
