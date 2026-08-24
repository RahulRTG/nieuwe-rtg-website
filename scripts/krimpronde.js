#!/usr/bin/env node
/* ============================================================================
   DE KRIMPRONDE -- welke collecties krimpen hier LEGITIEM, en hoeveel?

   WAAROM DIT ER IS. server/opzet/begroting.js kan een massaverwijdering
   tegenhouden, en staat standaard op MELDEN. Dat is geen halfheid maar een
   volgorde: weigeren aanzetten over 3706 routes zonder te weten welke grote
   krimpen legitiem zijn, breekt dingen die niemand terugvindt. TAKEN.md 4.62
   zegt dat de tand er pas in kan als die catalogus bestaat.

   Dit script bouwt hem. Het draait de suite met de grens op 1 -- dan meldt de
   begroting ELKE hervulling die meer dan een rij wegneemt -- en zet per
   collectie en per route bij elkaar wat er gebeurde.

   WAT DIT WEL IS: een lijst van de krimpen die de TOETSEN uitlokken, met de
   route erbij. Dat is genoeg om te zien welke collecties structureel groot
   krimpen en welke nooit.

   WAT DIT NIET IS, en dat hoort er hard bij:

   - GEEN PRODUCTIEVERKEER. De suite doet wat de toetsen doen, niet wat
     gebruikers doen. Een legitieme grote krimp die geen toets uitlokt, staat
     hier niet in. De catalogus is dus een ONDERGRENS: wat erin staat is echt,
     wat er niet in staat is niet bewezen afwezig.
   - GEEN OORDEEL. Dit script zegt niet of een krimp goed of fout is. Het zet
     neer wat er gebeurde; welke grens erbij hoort is een besluit van een mens.
   - ALLEEN HERVULLINGEN. Een splice of een wijziging binnen een rij komt hier
     niet voorbij, want de begroting ziet die ook niet (zie haar kop).

   DAAROM STAAT ER GEEN "VEILIG OM AAN TE ZETTEN" ONDER. Er staat: dit is wat de
   suite laat zien. Wie daarna weigeren aanzet, doet dat met dit getal in de hand
   en met de wetenschap wat het niet dekt.

   Draai:  node scripts/krimpronde.js              (draait de suite -- lang)
           node scripts/krimpronde.js --lees x.log (leest een bestaand log)
           node scripts/krimpronde.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'KRIMP.json');
const argv = process.argv.slice(2);
const VASTLEGGEN = argv.includes('--vastleggen');
const LEES = (argv.find(a => a.startsWith('--lees')) || '').split('=')[1] ||
  (argv.includes('--lees') ? argv[argv.indexOf('--lees') + 1] : null);

/* DE PROEF OP DE SOM: STOND DE VAL EIGENLIJK AAN?

   Dit is de tweede keer dat dit script op dezelfde steen viel, en de tweede keer
   was de ergste. Nul meldingen betekent twee dingen die niets met elkaar te
   maken hebben: er kromp niets, of de val stond niet aan. Hier stond, om die
   twee te scheiden:

       const zag = /begroting:/.test(tekst);

   en dat matchte in de eerste echte ronde op twee TOETSNAMEN:

       ok 5596 - begroting: een project kent zijn nulmeting, zijn uitgaven ...

   Een toets over een PROJECTbegroting. Dit script zou dus hebben gemeld "de
   begroting was aan het woord, maar geen enkele collectie kromp" over een ronde
   waarin server/opzet/begroting.js geen letter had geschreven -- de gevaarlijkste
   uitslag die hij kan geven, want hij leest als geruststelling (LAT.md regel 3:
   een meter zakt als zijn invoer ontbreekt, hij verzint hem niet).

   De oorzaak zat niet hier maar daar: er was niets dat alleen die module kon
   schrijven. Dus schrijft de wikkel nu bij zijn eerste installatie zelf een
   regel, met de grens waarop hij staat. Die regel is het bewijs, en de grens
   erin is het bewijs dat de ronde op de BEDOELDE grens draaide -- want een ronde
   met de standaardgrens van 1000 zegt niets over wat er boven de 1 gebeurt.

   DE MELDREGEL IN BEIDE VORMEN, en dat was de eerste steen.

   server/log.js schrijft JSON als RTG_LOG_JSON aanstaat en anders platte tekst:

     {"bericht":"begroting: zou zijn geweigerd","collectie":"leden","rijen":42}
     2026-.. WARN  begroting: zou zijn geweigerd {"collectie":"leden","rijen":42}

   De eerste versie hiervan eiste `"bericht":"..."` en zag dus ALLEEN de
   JSON-vorm. In de testmodus -- precies waar deze ronde draait -- schrijft het
   log platte tekst, dus dit script was daar blind. Een lege catalogus zou dan
   voor "er krimpt niets" zijn doorgegaan, en dat is de gevaarlijkste uitslag
   die hij kan geven (LAT.md regel 10).

   Nu wordt er op het BERICHT gezocht, dat in allebei de vormen letterlijk zo in
   de regel staat, en worden de velden er daarna uit gehaald. */
const REGEL = /begroting: (zou zijn geweigerd|handeling geweigerd)/;
const REGEL_C = /"collectie":"([^"]+)"/;
const REGEL_R = /"rijen":(\d+)/;
const REGEL_P = /"p":"([^"]*)"/;
/* Het levensteken. Alleen server/opzet/begroting.js schrijft deze woorden, en
   hij schrijft de grens erbij. */
/* HOE DE SUITE ZELF ERVOOR STOND. Deze ronde draait de hele suite, en tot nu
   toe gooide hij die uitvoer weg op de begrotingsregels na. Dat is dezelfde
   blinde vlek als hierboven, een niveau hoger: een ronde waarin driehonderd
   toetsen omvielen levert een catalogus die eruitziet als elke andere. De
   gebeurtenissen die erin staan zijn dan nog steeds echt, maar de catalogus is
   INCOMPLEET -- en dat hoort op het scherm en in het register te staan, niet in
   het hoofd van wie hem draaide. */
const WAAKT = /begroting: waakt/;
/* MET DE PUNT EROP. Dit stond op \d+ en las "grens":0.5 dus als 0 -- de ronde
   legde zichzelf vast onder "grens-0" en meldde een grens die niet bestond.
   Een halve rij is precies de stand waarin je de enkele krimpen ziet. */
const WAAKT_G = /"grens":([0-9.]+)/;

/* WORDT DEZE COLLECTIE OOK GEKAPT? En waarom dat de vraag is die de catalogus
   nog miste.

   De ronde zegt WAT er krimpt en via welke route. Wat hij niet zei, is of een
   grens op die collectie veilig te handhaven is -- en daar hangt een concreet
   gevaar aan. Ruim zestig plekken in dit huis doen "push, dan afkappen":

       db.data.gemeenteMeldingen = db.data.gemeenteMeldingen.slice(0, 20000);

   In rust haalt zo'n kap een rij per verzoek weg en valt hij onder elke grens.
   Maar staat de collectie ooit ver boven zijn kap -- na een bulkimport, of
   omdat iemand het getal verlaagt -- dan wil hij er in EEN keer duizenden
   wegnemen. Wordt dat geweigerd, dan blijft de collectie te groot en wordt het
   VOLGENDE verzoek op dezelfde plek opnieuw geweigerd. Dat is geen weigering
   maar een storing die zichzelf in stand houdt.

   Daarom staat er per collectie bij of er een kap op zit. Dat is geen oordeel:
   het is de eerste van de twee vragen die een mens moet beantwoorden voordat
   een grens gehandhaafd kan worden. De tweede -- begrenst de VORM van de route
   hoeveel er weg kan? -- staat niet in de code en kan hier dus niet gemeten
   worden; die hoort met de hand in TAKEN.md 4.62.

   Gescand op de bron en niet op de meting, want een kap die geen enkele toets
   uitlokt is precies de kap die je later verrast. */
const KAP = /db\.data\.([A-Za-z0-9_]+)\s*=\s*[^;\n]*\.slice\(/g;

function kappen() {
  const wortel = path.join(WORTEL, 'server');
  const uit = new Map();
  (function loop(d) {
    let namen;
    try { namen = fs.readdirSync(d); } catch (e) { return; }
    for (const n of namen) {
      if (n === 'node_modules' || n === 'data') continue;
      const p = path.join(d, n);
      let st; try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.isDirectory()) { loop(p); continue; }
      if (!n.endsWith('.js')) continue;
      const bron = fs.readFileSync(p, 'utf8');
      for (const m of bron.matchAll(KAP)) {
        const waar = path.relative(WORTEL, p).replace(/\\/g, '/');
        if (!uit.has(m[1])) uit.set(m[1], []);
        const lijst = uit.get(m[1]);
        if (!lijst.includes(waar)) lijst.push(waar);
      }
    }
  })(wortel);
  return uit;
}

function suiteStand(tekst) {
  const t = String(tekst);
  const som = (re) => {
    const m = t.match(re);
    return m ? m.reduce((n, r) => n + Number(String(r).replace(/\D+/g, '')), 0) : null;
  };
  return {
    toetsen: som(/^# tests \d+$/gm),
    gezakt: som(/^# fail \d+$/gm),
    /* Los geteld, want de twee kunnen uiteenlopen: een deelproces dat omvalt
       voordat het zijn totaal schrijft, laat wel "not ok" achter en geen "# fail". */
    rood: (t.match(/^not ok /gm) || []).length
  };
}

function ontleed(tekst) {
  const perCollectie = new Map();
  const grenzen = new Map();
  let regels = 0, gewaakt = 0;
  for (const regel of String(tekst).split('\n')) {
    if (WAAKT.test(regel)) {
      gewaakt++;
      const gm = WAAKT_G.exec(regel);
      const g = gm ? Number(gm[1]) : -1;
      grenzen.set(g, (grenzen.get(g) || 0) + 1);
      continue;
    }
    if (!REGEL.test(regel)) continue;
    const cm = REGEL_C.exec(regel);
    const rm = REGEL_R.exec(regel);
    if (!cm || !rm) continue;   // een melding zonder velden zegt niets
    regels++;
    const collectie = cm[1];
    const rijen = Number(rm[1]);
    const pm = REGEL_P.exec(regel);
    const pad = pm ? pm[1] : '(onbekend)';
    const c = perCollectie.get(collectie) ||
      { collectie, keer: 0, grootste: 0, totaal: 0, paden: new Map() };
    c.keer++;
    c.totaal += rijen;
    if (rijen > c.grootste) c.grootste = rijen;
    c.paden.set(pad, Math.max(c.paden.get(pad) || 0, rijen));
    perCollectie.set(collectie, c);
  }
  const kap = kappen();
  const uit = [...perCollectie.values()]
    .map(c => ({ collectie: c.collectie, keer: c.keer, grootste: c.grootste,
      gemiddeld: Math.round(c.totaal / c.keer),
      /* De eerste van de twee vragen die een grens per collectie mogelijk maken;
         zie de kop bij kappen(). Leeg betekent: geen kap gevonden. */
      kap: kap.get(c.collectie) || [],
      paden: [...c.paden.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([pad, rijen]) => ({ pad, rijen })) }))
    .sort((a, b) => b.grootste - a.grootste);
  return { regels, gewaakt, grenzen: [...grenzen.entries()].sort((a, b) => a[0] - b[0]),
    collecties: uit };
}

function draaiSuite() {
  console.log('  de suite draait met RTG_BEGROTING_KRIMP=1 -- dit duurt lang.\n');
  const r = spawnSync(process.execPath, [path.join(WORTEL, 'scripts', 'test-runner.js')], {
    cwd: WORTEL, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024,
    env: { ...process.env, RTG_BEGROTING_KRIMP: '1', RTG_BEGROTING: 'melden' }
  });
  if (r.error) { console.error('  de ronde kon niet draaien: ' + r.error.message); process.exit(2); }
  return (r.stdout || '') + (r.stderr || '');
}

const tekst = LEES ? fs.readFileSync(LEES, 'utf8') : draaiSuite();
const uit = ontleed(tekst);

console.log('\n=== DE KRIMPRONDE ===\n');

/* GEEN LEVENSTEKEN IS GEEN UITSLAG. Zonder die regel is dit log geen bewijs dat
   er niets kromp, maar bewijs van niets. Zie de kop. */
if (!uit.gewaakt) {
  console.log('  GEEN ENKEL LEVENSTEKEN in dit log.\n');
  console.log('  Dat is GEEN uitslag "er krimpt niets" maar GEEN UITSLAG. De val stond niet');
  console.log('  aan, of geen enkel proces zette db.data (draai met RTG_BEGROTING_KRIMP=1),');
  console.log('  of het patroon in dit script loopt uit de pas met server/opzet/begroting.js.');
  process.exit(2);
}

const suite = suiteStand(tekst);
console.log('  de suite zelf               : ' +
  (suite.toetsen == null ? 'onbekend (geen TAP-totalen in dit log)'
    : suite.toetsen + ' toetsen, ' + (suite.gezakt == null ? suite.rood : suite.gezakt) + ' rood'));
console.log('  processen met de val aan    : ' + uit.gewaakt);
console.log('  grenzen die zij meldden     : ' +
  uit.grenzen.map(([g, n]) => g + ' (' + n + 'x)').join(', '));
console.log('  hervullingen boven de grens : ' + uit.regels);
console.log('  collecties die krimpen      : ' + uit.collecties.length + '\n');

/* EEN RONDE OP DE STANDAARDGRENS MEET NIETS. Draait de suite met 1000, dan zegt
   "nul meldingen" alleen dat er niets van meer dan duizend rijen wegging -- niet
   waar de catalogus om vraagt. Die vergissing is stil en lijkt op een uitslag. */
const laagste = uit.grenzen.length ? uit.grenzen[0][0] : -1;
if (laagste >= 1000) {
  console.log('  De val stond aan, maar op de STANDAARDGRENS (' + laagste + '). Deze ronde zegt dus');
  console.log('  niets over wat er tussen 1 en ' + laagste + ' rijen gebeurt, en dat is precies wat');
  console.log('  de catalogus nodig heeft. Draai met RTG_BEGROTING_KRIMP=1.\n');
  process.exit(2);
}

if (!uit.collecties.length) {
  console.log('  De begroting was aan het woord, maar GEEN ENKELE collectie kromp met meer');
  console.log('  dan een rij. Dat is een echte uitslag: op de paden die de toetsen raken,');
  console.log('  bestaat er geen massaverwijdering.\n');
} else {
  console.log('    rijen  keer  collectie');
  for (const c of uit.collecties) {
    console.log('  ' + String(c.grootste).padStart(7) + String(c.keer).padStart(6) + '  ' + c.collectie);
    for (const p of c.paden) console.log('                 ' + String(p.rijen).padStart(6) + '  ' + p.pad);
    if (c.kap && c.kap.length) console.log('                    KAP  ' + c.kap.slice(0, 2).join(', '));
  }
  console.log();
}

/* TWEE RONDES ZIJN TWEE VRAGEN, en ze horen niet over elkaar heen geschreven.

   Op grens 1 staat er "welke collecties krimpen met meer dan een rij" -- de
   grote krimpen, waar de tand op komt. Op 0,5 staat er "welke collecties
   krimpen uberhaupt, en via welke route" -- de invoer om per collectie een
   grens te KIEZEN. Een uitslag die de andere overschrijft, maakt van dit
   register een momentopname in plaats van een catalogus.

   Dus per gemeten grens een eigen sleutel, en de rest blijft staan. */
const bestaand = (() => {
  try { return JSON.parse(fs.readFileSync(UITSLAG, 'utf8')); } catch (e) { return null; }
})();
const rondes = (bestaand && bestaand.rondes && typeof bestaand.rondes === 'object')
  ? bestaand.rondes : {};
/* De oude, platte vorm (een enkele ronde in `gemeten` + `collecties`) komt hier
   binnen als een gewone ronde in plaats van te verdwijnen. Een register dat bij
   een vormwijziging stilletjes zijn geschiedenis weggooit, is geen register. */
if (bestaand && bestaand.gemeten && !bestaand.rondes) {
  rondes['grens-' + bestaand.gemeten.gemetenGrens] =
    { gemeten: bestaand.gemeten, collecties: bestaand.collecties || [] };
}
rondes['grens-' + laagste] = {
  suite: suite,
  gemeten: { hervullingen: uit.regels, collecties: uit.collecties.length,
    grootste: uit.collecties.length ? uit.collecties[0].grootste : 0,
    processenGewaakt: uit.gewaakt, gemetenGrens: laagste },
  collecties: uit.collecties
};

const stand = {
  uitleg: 'Welke collecties krimpen tijdens de TOETSEN, en via welke route. Bouwt de catalogus die ' +
    'TAKEN.md 4.62 nodig heeft voordat RTG_BEGROTING=weigeren aan kan. ' +
    'PER GEMETEN GRENS EEN RONDE, want dat zijn twee vragen: op 1 staat er welke collecties GROOT ' +
    'krimpen (de begroting vergelijkt met krimp <= grens, dus een verwijdering van EEN rij komt er ' +
    'ongemeld doorheen), op 0,5 staat er welke er uberhaupt krimpen en waar. De tweede omvat de eerste. ' +
    'ZES DINGEN DIE ERBIJ HOREN. ' +
    '(1) DE EERSTE RONDE TELDE NIETS, EN DAT WAS EEN DEFECT. Hij gaf nul over 6806 toetsen, en dat leek ' +
    'een uitslag. Het was er geen: de handelingscontext van server/opzet/handeling.js overleeft het ' +
    'LEZEN VAN DE BODY niet (server/web/body.js leest met req.on(end), en die luisteraar hangt aan een ' +
    'async-bron van voor context.run), dus stapte de begroting op elke POST met een body meteen uit -- ' +
    'en dat is elke mutatie. hervat() zet de keten na de lijfpoort terug; test/begrotingroute.test.js ' +
    'vond het en houdt het tegen. Alles hieronder komt uit een ronde NA die reparatie. ' +
    '(2) ONDERGRENS: de suite doet wat de toetsen doen, niet wat gebruikers doen -- een legitieme grote ' +
    'krimp die geen toets uitlokt, staat hier niet in. ' +
    '(3) DE SUITE-STAND STAAT ERBIJ, per ronde, onder "suite". Een ronde waarin toetsen omvielen levert ' +
    'een catalogus die er precies zo uitziet als elke andere: wat erin staat is echt, maar wat een ' +
    'omgevallen toets niet meer deed kon ook niet krimpen. Zo een ronde is ONVOLLEDIG en de ronde ' +
    'eindigt dan met uitgang 3. ' +
    '(4) PER COLLECTIE STAAT ER OF ER EEN KAP OP ZIT ("kap"), gescand op de bron. Ruim zestig plekken ' +
    'doen push-dan-afkappen (db.data.X = X.slice(0, N)). In rust is dat een rij per verzoek, maar staat ' +
    'de collectie ooit ver boven zijn kap, dan wil hij er duizenden weghalen -- en een weigering daarop ' +
    'houdt zichzelf in stand: de collectie blijft te groot, dus het volgende verzoek wordt opnieuw ' +
    'geweigerd. Dat is de eerste van de twee vragen die een grens per collectie mogelijk maken; de ' +
    'tweede (begrenst de VORM van de route hoeveel er weg kan?) staat niet in de code en hoort met de ' +
    'hand in TAKEN.md 4.62. ' +
    '(5) WAT DE VAL SOWIESO NIET ZIET: een splice, een wijziging binnen een rij, en routes die de body ' +
    'zelf rauw lezen (de twee betaal-webhooks en de theater-upload). ' +
    '(6) GEEN OORDEEL: welke grens bij een collectie hoort, is een besluit van een mens.',
  hoe: 'node scripts/krimpronde.js  (RTG_BEGROTING_KRIMP zet de grens)',
  rondes: rondes
};

if (VASTLEGGEN) {
  fs.writeFileSync(UITSLAG, JSON.stringify(stand, null, 2) + '\n');
  console.log('  vastgelegd in KRIMP.json onder "grens-' + laagste + '" (' +
    Object.keys(rondes).length + ' ronde(s) bewaard)\n');
}
/* EEN RODE SUITE MAAKT DE CATALOGUS NIET FOUT, MAAR WEL ONVOLLEDIG: wat er
   staat is echt gebeurd, wat er niet staat kan best door een omgevallen toets
   zijn gemist. Hij wordt dus WEL vastgelegd (met de suite-stand erbij) en de
   uitgang is niet nul, zodat niemand hem voor een schone ronde aanziet. */
if (suite.rood > 0 || (suite.gezakt != null && suite.gezakt > 0)) {
  console.log('  LET OP: de suite was ROOD tijdens deze ronde (' +
    (suite.gezakt != null ? suite.gezakt : suite.rood) + ' toets(en)).');
  console.log('  De catalogus hierboven is echt maar ONVOLLEDIG: wat een omgevallen toets niet');
  console.log('  meer deed, kon ook niet krimpen. Repareer de suite en draai opnieuw.\n');
  process.exit(3);
}
process.exit(0);
