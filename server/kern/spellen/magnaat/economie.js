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
const { SECTOREN, SECTORLIJST, PRIJSSTANDEN, prijsVan } = require('./sectoren');
const { maand: rekenMaand, capaciteit, waarde } = require('./stap');
const F = require('./foundation');

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
  const { save, codenaamVan, nudge } = ctx;

  /* ---------- opzetten ---------- */
  function init(potje) {
    const v = potje.variant || {};
    const stadsleutel = stadSleutel(v.stad) || STEDENLIJST[0];
    const duur = DUUR[v.duur] || DUUR.quick;
    const st = {
      stad: stadsleutel, duur, maandMs: MAAND_MS[v.duur] || MAAND_MS.quick,
      maand: 0, begonnen: Date.now(), gerekendTot: Date.now(),
      geld: {}, vestigingen: {}, kavelBezet: {}, foundation: F.nieuw(),
      laatste: {}, klaar: false
    };
    for (const h of potje.spelers) { st.geld[h] = START_GELD; st.vestigingen[h] = []; st.laatste[h] = null; }
    potje.staat = st;
  }

  const K = (st) => kaart(st.stad);
  const vrijKavel = (st, id) => K(st).kavel.has(id) && !st.kavelBezet[id];
  const mijnVestiging = (st, h, id) => (st.vestigingen[h] || []).find(x => x.id === id);

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
    for (let i = 0; i < stappen && st.maand < st.duur; i++) verslagen.push(eenMaand(potje));
    st.gerekendTot += stappen * st.maandMs;
    if (st.maand >= st.duur && !st.klaar) beeindig(potje);
    return verslagen;
  }

  /* EEN spelmaand voor de hele wereld. De volgorde telt: eerst rekent iedere
     vestiging zijn maand (allemaal op DEZELFDE begintoestand, want anders
     bepaalt de volgorde van de spelers wie de klanten krijgt), dan gaat het
     geld rond, dan bouwt de Foundation. */
  function eenMaand(potje) {
    const st = potje.staat, k = K(st);
    const druk = {};
    for (const [h, rij] of Object.entries(st.vestigingen))
      for (const v of rij) {
        const zone = k.kavel.get(v.kavel).zone;
        druk[zone + ':' + v.sector] = (druk[zone + ':' + v.sector] || 0) + 1;
      }
    let wereldOmzet = 0;
    const perSpeler = {};
    // wat de Foundation aan opleiding heeft bijgedragen; werkt door in hoeveel
    // een medewerker aankan
    const arbeid = F.arbeidBonus(st.foundation);
    for (const [h, rij] of Object.entries(st.vestigingen)) {
      const regels = [];
      for (const v of rij) {
        const kavel = k.kavel.get(v.kavel);
        /* De Foundation-projecten verschuiven de eigenschappen van het kavel.
           Dat gebeurt HIER en niet in de kaart zelf: de kaart is gedeeld tussen
           partijen, en een project in de ene partij hoort de andere niet te
           raken. */
        const effect = F.effectOp(st.foundation, kavel);
        const opgeschoven = Object.assign({}, kavel, {
          eigenschappen: Object.fromEntries(Object.entries(kavel.eigenschappen)
            .map(([veld, w]) => [veld, w + (effect[veld] || 0)]))
        });
        const kOp = Object.assign({}, k, { kavel: new Map(k.kavel).set(kavel.id, opgeschoven) });
        const r = rekenMaand(kOp, v, { maand: st.maand, zoneDruk: druk[kavel.zone + ':' + v.sector] || 1, wereldFactor: 1, arbeid });
        regels.push(Object.assign({ id: v.id, naam: v.naam, sector: v.sector, kavel: kavel.naam }, r));
        st.geld[h] += r.resultaat;
        wereldOmzet += r.omzet;
      }
      /* ROOD STAAN KOST GELD. Zonder dit is overinvesteren gratis: je kas gaat
         onder nul en er gebeurt niets. Echte financiering (leningen met een
         looptijd en een risico-opslag) hoort bij fase B; dit is de rekening-
         courant eronder, zodat de keuze om door te bouwen nu al een prijs
         heeft. */
      if (st.geld[h] < 0) {
        const rente = -st.geld[h] * ROOD_RENTE;
        st.geld[h] -= rente;
        regels.push({ id: 'rood', naam: 'Rood staan', rente: rond(rente), resultaat: -rond(rente) });
      }
      perSpeler[h] = regels;
    }
    /* De afdracht rust op de HELE stad en niet alleen op de spelers: anders
       bouwt de Foundation in een partij met twee mensen nooit iets. Zie de
       reden bij `stadsomzet` in de stadsdata. */
    const afdracht = F.draagAf(st.foundation, wereldOmzet + (k.stadsomzet || 0));
    /* Waar de bedrijvigheid zit, zodat de Foundation daar bouwt. Uit dezelfde
       telling die de concurrentiedruk gebruikt: een tweede telling zou een
       tweede antwoord op dezelfde vraag zijn. */
    const perZone = {};
    for (const sleutel of Object.keys(druk)) {
      const zone = sleutel.split(':')[0];
      perZone[zone] = (perZone[zone] || 0) + druk[sleutel];
    }
    const projecten = F.bouw(st.foundation, k, perZone);
    st.maand++;
    const verslag = { maand: st.maand, perSpeler, afdracht, projecten, wereldOmzet: rond(wereldOmzet) };
    for (const h of potje.spelers) st.laatste[h] = { maand: st.maand, regels: perSpeler[h] || [], projecten };
    return verslag;
  }

  /* WAT EEN SPELER ZIET en wat er aan het eind op tafel komt staat in
     ./weergave.js -- een eigen onderwerp (wie mag wat weten, en waarop wordt
     er afgerekend) dat los staat van de klok hierboven. */
  const { zicht, publiek, eindstand } = require('./weergave')({
    K, codenaamVan, rond, bijrekenen, foundationArbeid: (st) => F.arbeidBonus(st.foundation) });
  function beeindig(potje) {
    const st = potje.staat;
    st.klaar = true;
    potje.status = 'klaar';
    const stand = eindstand(potje);
    /* De winnaar is het hoogste VERMOGEN (geld plus wat je gebouwd hebt), en
       niet het meeste geld op de rekening: wie alles in zijn zaken heeft zitten
       hoort niet te verliezen van wie niets deed. De andere dimensies staan op
       de eindstand en tellen niet mee voor de winst -- ze zijn er om te zien wat
       voor ondernemer je was, en dat is iets anders dan een tweede ranglijst. */
    if (stand.length > 1 && stand[0].vermogen === stand[1].vermogen) potje.gelijk = true;
    else potje.winnaar = stand[0].codenaam;
  }

  /* WAT EEN SPELER DOET staat in ./acties.js, en dat is een echte naad: dit
     bestand gaat over de WERELD (de klok, de maand, de eindstand) en dat blijft
     hetzelfde hoeveel knoppen er ook bijkomen. De actielijst groeit juist met
     elke fase mee -- contracten, veilingen, aandelen -- en die twee horen niet
     in een bestand. De aanleiding was de 10 kB-grens die scripts/check.js
     bewaakt, en die grens is precies een rem hierop. */
  const { ACTIES, VRIJE_ACTIES } = require('./acties')({ K, mijnVestiging, vrijKavel, rond });

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
    return r;
  }

  return { init, zet, zicht, publiek, bijrekenen, eindstand, DUUR, MAAND_MS, START_GELD,
    SECTORLIJST, STEDENLIJST, stadNaam, kaartVan: (s) => kaart(s) };
};
