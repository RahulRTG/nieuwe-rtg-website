/* Spel "sudoku" (kern/spellen): het cijferraadsel, in je eentje -- en het
   eerste arcadespel waarvan de score NIET uit de client komt.

   Anders dan bij Sneek en Tetris staat de motor hier WEL naast de descriptor,
   in hetzelfde bestand. Dat is het punt van dit spel: de regels zijn
   narekenbaar, dus horen ze op de server.

   WAT ER MIS WAS. De client maakte zelf een puzzel, rekende zelf de punten uit
   en stuurde een getal op. De server nam dat aan. Een score van 999999 was dus
   een regel JavaScript, en dat is te dragen voor een vriendenbord maar niet
   zodra er een competitie of een prijs aan hangt.

   WAT ER NU GEBEURT. De server maakt de puzzel, houdt de oplossing voor
   zichzelf, klokt de tijd op zijn eigen klok en rekent de punten. De client
   krijgt alleen de puzzel en stuurt alleen een ingevulde rooster terug. Er is
   niets meer te beweren: een score bestaat alleen als er een puzzel is
   uitgegeven die bij deze speler hoort en die correct is opgelost.

   WAT DIT NIET IS, en dat hoort er net zo hard bij. Dit bewijst dat IEMAND
   een puzzel van ons correct heeft opgelost in de tijd die wij hebben gemeten.
   Het bewijst niet dat een MENS hem heeft opgelost -- een oplosser draait in
   een seconde. Dat is met geen enkele maatregel te weerleggen zonder de speler
   lastig te vallen, en doen alsof van wel zou een belofte zijn die de code
   niet waarmaakt. Wat het wel doet: het onmogelijk maken om een score te
   verzinnen zonder ook maar iets op te lossen.

   DE LOPENDE PUZZELS staan onder `db.data.spellen.sudoku`, bij de potjes en de
   wachtrij: het is tijdelijke toestand met een eigen opruiming (zie
   `opschonen` in kern/spellen.js) en geen tak die een bewaartermijn nodig
   heeft. Een puzzel die je open laat staan verdwijnt vanzelf. */
module.exports = (ctx) => {
  const { crypto } = ctx;

  /* Niveau: hoeveel cijfers weg, en de basis waarvan de tijd afgaat. Meer
     gaten is niet automatisch moeilijker, maar het is de maat die de client
     altijd al gebruikte en die blijft nu gewoon kloppen. */
  const NIVEAUS = { makkelijk: { weg: 40, basis: 150 }, normaal: { weg: 50, basis: 300 }, moeilijk: { weg: 56, basis: 500 } };
  const MIN_PUNTEN = 25;
  const OUD_MS = 6 * 3600000;      // een puzzel die je open laat staan verdwijnt

  const rnd = (n) => crypto.randomInt(0, n);
  function schudLos(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function mag(g, i, v) {
    const r = Math.floor(i / 9), k = i % 9;
    for (let j = 0; j < 9; j++) if (g[r * 9 + j] === v || g[j * 9 + k] === v) return false;
    const br = r - r % 3, bk = k - k % 3;
    for (let rr = 0; rr < 3; rr++) for (let kk = 0; kk < 3; kk++) if (g[(br + rr) * 9 + bk + kk] === v) return false;
    return true;
  }
  // een volledig gevuld rooster, met echte willekeur (crypto, net als het schudden elders)
  function volRooster() {
    const g = Array(81).fill(0);
    const vul = (i) => {
      if (i === 81) return true;
      for (const v of schudLos([1, 2, 3, 4, 5, 6, 7, 8, 9]))
        if (mag(g, i, v)) { g[i] = v; if (vul(i + 1)) return true; g[i] = 0; }
      return false;
    };
    vul(0);
    return g;
  }
  /* Hoeveel oplossingen heeft dit rooster? Telt tot hoogstens twee: meer hoeven
     we niet te weten, en doortellen kost onnodig veel. */
  function aantalOplossingen(g, stop = 2) {
    const w = g.slice();
    let gevonden = 0;
    const zoek = () => {
      const i = w.indexOf(0);
      if (i === -1) { gevonden++; return gevonden >= stop; }
      for (let v = 1; v <= 9; v++)
        if (mag(w, i, v)) { w[i] = v; if (zoek()) { w[i] = 0; return true; } w[i] = 0; }
      return false;
    };
    zoek();
    return gevonden;
  }
  /* Gaten maken die MAAR EEN oplossing overlaten. Zonder die controle kan een
     puzzel meerdere goede antwoorden hebben, en dan keurt de server een juist
     ingevuld rooster af omdat het niet het zijne is -- de speler krijgt dan
     ongelijk terwijl hij gelijk heeft. */
  function maakPuzzel(niveau) {
    const op = volRooster();
    const puzzel = op.slice();
    let weg = 0;
    for (const i of schudLos(Array.from({ length: 81 }, (_, x) => x))) {
      if (weg >= NIVEAUS[niveau].weg) break;
      const bewaard = puzzel[i];
      puzzel[i] = 0;
      if (aantalOplossingen(puzzel) === 1) weg++;
      else puzzel[i] = bewaard;
    }
    return { op, puzzel, weg };
  }

  const isRooster = (v) => Array.isArray(v) && v.length === 81 && v.every(x => Number.isInteger(x) && x >= 0 && x <= 9);

  /* De punten. Op de klok van de SERVER, want de client heeft geen tijd meer
     om te melden. Onder de ondergrens komt niemand, ook niet wie er een uur
     over doet -- opgelost is opgelost. */
  function punten(niveau, seconden) {
    return Math.max(MIN_PUNTEN, NIVEAUS[niveau].basis - Math.round(seconden));
  }

  /* DE KEURING VAN EEN INGEVULD ROOSTER, op EEN plek. Er zijn twee ingangen die
     hem nodig hebben -- de losse puzzel (kern/spellen/arcade.js) en de dagopgave
     (kern/spellen/dag.js) -- en een tweede exemplaar van deze volgorde zou de
     fout terugbrengen die er hieronder juist uit gehaald is.

     Eerst de GEGEVEN cijfers, helemaal rond, en pas daarna vergelijken. Die
     volgorde is niet vrijblijvend: wie een gegeven cijfer wegveegt levert een
     ander rooster in dan de puzzel die hij kreeg, en dat is een andere fout dan
     "niet goed opgelost". Door elkaar heen lopend zou de eerste afwijkende cel
     bepalen welke van de twee je te horen krijgt. */
  function keurRooster(op, puzzel, rooster) {
    if (!isRooster(rooster)) return { status: 400, error: 'Stuur een volledig rooster van 81 cijfers mee.' };
    for (let i = 0; i < 81; i++)
      if (puzzel[i] && rooster[i] !== puzzel[i])
        return { status: 400, error: 'De gegeven cijfers van de puzzel horen te blijven staan.' };
    for (let i = 0; i < 81; i++) if (rooster[i] !== op[i]) return { goed: false };
    return { goed: true };
  }

  /* ---------- DE DAGOPGAVE ----------
     Een puzzel per dag, dezelfde voor iedereen. Het spel levert twee haken en
     verder niets: de server geeft de opgave uit (`dagOpgave`) en keurt de
     inzending (`dagKeur`). Wie er meedoet, wanneer de klok begint, wat er wel
     en niet bewaard wordt en hoe het bord eruitziet staat in kern/spellen/dag.js
     -- dat is boekhouding en geen sudoku.

     Waarom Sudoku de eerste is die dit mag: het register weigert `dagelijks`
     zonder `serverScore` (zie ./keur.js). Een dagopgave is een bord waarop
     vreemden elkaar verslaan; een score die de client zelf rekent hoort daar
     niet in. Bij Sneek en Tetris rekent de browser, dus die kunnen dit pas als
     hun verloop narekenbaar is.

     Het niveau ligt vast op 'normaal'. Een keuze zou betekenen dat het niet
     dezelfde opgave is, en dan valt er ook niets te vergelijken. */
  const DAG_NIVEAU = 'normaal';
  function dagOpgave() {
    const { op, puzzel } = maakPuzzel(DAG_NIVEAU);
    return { geheim: op, opgave: { niveau: DAG_NIVEAU, puzzel } };
  }
  function dagKeur({ geheim, opgave, inzending, seconden }) {
    const k = keurRooster(geheim, opgave.puzzel, inzending);
    return k.goed ? { goed: true, punten: punten(DAG_NIVEAU, seconden) } : k;
  }

  /* De descriptor. `serverScore: true` is de vlag die het verschil maakt: de
     algemene arcade-ingang (`arcade-score`) WEIGERT een score voor dit spel,
     want die komt hier vandaan en niet uit de client. Zolang die vlag er staat
     is er geen tweede pad naar het scorebord. */
  /* WERELDEN: allebei, en dat is met deze omzetting veranderd. Sudoku stond
     alleen in de RTF-app, en daar bestaat geen enkele speler die de
     progressiegrens haalt: gezinsprofielen hebben geen geverifieerde leeftijd.
     Het scorebord van dit spel kon dus per definitie nooit iemand tonen -- en
     dan is een narekenbare score een maatregel zonder onderwerp. Nu staat hij
     naast Sneek en Tetris in beide apps: in De RTFoundation speel je hem zonder
     bord (net als de rest daar), in de leden-app telt hij mee. */
  const spel = {
    sleutel: 'sudoku', naam: 'Sudoku', vorm: 'arcade',
    werelden: ['rtg', 'rtf'],
    maxPunten: Math.max(...Object.values(NIVEAUS).map(n => n.basis)),
    serverScore: true,
    // de dagopgave; het register weigert deze vlag zonder serverScore hierboven
    dagelijks: true, dagOpgave, dagKeur
  };

  return { spel, NIVEAUS, MIN_PUNTEN, OUD_MS, DAG_NIVEAU, maakPuzzel, aantalOplossingen,
    isRooster, punten, keurRooster };
};
