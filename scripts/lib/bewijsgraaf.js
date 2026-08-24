/* DE BEWIJSGRAAF -- welk bewijs hoort bij welke code?

   Dit is fase D van de verificatie-runtime, en het is de voorwaarde voor alles
   wat erna komt. De opdracht luidde: "RTG moet de kleinste aantoonbaar
   voldoende verificatie kunnen uitvoeren voor iedere verandering -- terwijl de
   volledige bewijsruimte permanent bekend blijft." Dat vraagt twee dingen die
   er geen van beide waren: weten WELK bewijs bij welke code hoort, en op grond
   daarvan een deelverzameling durven kiezen.

   Deze module doet het eerste. Hij zegt per toetsbestand welke bronbestanden
   het aanraakt, en -- minstens zo belangrijk -- van welke toetsen dat NIET te
   bepalen is.

   DRIE SOORTEN AFHANKELIJKHEID, en ze zijn niet gelijkwaardig:

     statisch   de toets doet require('../server/kern/x') en volgt daarmee een
                keten die tot het einde te volgen is. Dit is het scherpste wat
                er is: verandert er niets in die keten, dan kan deze toets niet
                van mening veranderen.
     serverboot de toets start server.js als apart proces (rechtstreeks of via
                test/helper.js). Dan hangt hij aan ALLES wat die server laadt.
                Dat is een enorme verzameling, en dat is geen tekortkoming van
                deze graaf maar een eigenschap van zulke toetsen: wie een hele
                server start, toetst tegen een hele server.
     onbekend   de toets laadt met een berekend pad, leest bestanden op naam, of
                doet iets anders wat statisch niet te volgen is.

   WAT ER MET "ONBEKEND" GEBEURT, EN WAAROM DAT DE HELE VEILIGHEID IS. Een toets
   waarvan de afhankelijkheden niet vaststaan, wordt ALTIJD gedraaid. Nooit
   overgeslagen, nooit "waarschijnlijk niet nodig". Een planner die gokt is
   erger dan geen planner: hij maakt een groene ronde die niets betekent, en dat
   merk je pas als er iets in productie stukgaat. Onbekend is hier dus geen gat
   maar een veilige stand, en het getal eromheen (hoeveel toetsen onbekend zijn)
   is de meter die omlaag moet.

   Handhaver: test/bewijsgraaf.test.js. */
'use strict';
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./bron');

const WORTEL = path.join(__dirname, '..', '..');
const MAPPEN = ['server', 'scripts', 'public'];
/* Waar een toets van kan afhangen. `test` hoort erbij: helper.js is de
   afhankelijkheid van 681 toetsen. */
const AFHANKELIJK = ['server', 'scripts', 'public', 'test'];

/* DE BEREKENDE REQUIRES, MET DE HAND EN MET EEN POORT ERONDER.

   `require(path.join(...))` is statisch niet te volgen, en zulke regels maken de
   sluiting stil onvolledig -- precies de vorm waarin een planner te weinig gaat
   draaien zonder dat iemand het merkt. In de hele serversluiting van 1858
   bestanden zijn er PRECIES TWEE, en allebei zijn ze bij inspectie eenduidig:

     magnaat-capabilities-bronnen.js  laadt twee bestanden bij naam
     spellen/register.js              laadt elk .js-bestand uit zijn eigen map

   Dus staan ze hier, met wat ze kunnen bereiken. Dat is een BEWERING over de
   code, dus er ligt een poort onder: test/bewijsgraaf.test.js loopt de sluiting
   af en eist dat elk bestand met een berekende require hier genoemd wordt. Komt
   er een derde bij, dan zakt die toets -- in plaats van dat de graaf stilletjes
   een gat krijgt en de planner te weinig kiest. */
const BEREKEND_BEREIK = {
  'server/kern/magnaat-capabilities-bronnen.js': {
    bestanden: ['server/kern/afdelingen/register.js', 'server/kern/afdelingen/register2.js']
  },
  'server/kern/spellen/register.js': { map: 'server/kern/spellen' },
  /* require('../routes/' + naam) over de negen domeinen. De lijst staat daar als
     ALLE_DOMEINEN; hem hier herhalen zou twee plekken met dezelfde waarheid
     maken (LAT-regel 4), dus test/bewijsgraaf.test.js leest hem uit die bron en
     vergelijkt. */
  'server/opzet/routes.js': {
    bestanden: ['auth', 'member', 'supplier', 'office', 'staff', 'social', 'techniek', 'zakelijk', 'wereld']
      .map(n => 'server/routes/' + n + '.js')
  },
  /* Drie laders die een hele map inlezen. Net als bij spellen/register geldt:
     alles wat daar staat kan geladen worden, dus alles telt mee. */
  'server/kern/fiscaal/wereld.js': { map: 'server/kern/fiscaal/wereld' },
  'server/kern/reis.js': { map: 'server/kern/reis' },
  /* payroll laadt .json-jaargangen, geen code. Die kunnen het gedrag wel
     veranderen (tarieven), dus ze horen in de graaf -- vandaar `ook` naast de
     gewone .js-regel. */
  'server/kern/payroll/index.js': { map: 'server/kern/payroll/jaargangen', ook: '.json' }
};

/* Wat kan een berekende require in dit bestand bereiken? Onbekend -> null, en
   dat betekent voor de aanroeper: deze sluiting is onvolledig. */
function berekendBereik(relPad, wortel) {
  const regel = BEREKEND_BEREIK[relPad];
  if (!regel) return null;
  const uit = [];
  for (const b of regel.bestanden || []) uit.push(path.join(wortel, b));
  if (regel.map) {
    const dir = path.join(wortel, regel.map);
    try {
      for (const n of fs.readdirSync(dir)) {
        if (n.endsWith('.js') || (regel.ook && n.endsWith(regel.ook))) uit.push(path.join(dir, n));
      }
    } catch (e) { return null; }
  }
  return uit;
}

/* Een require-pad oplossen naar een echt bestand in deze boom. Geeft null voor
   alles wat er niet in staat (node-ingebouwd, npm, of een pad dat niet bestaat):
   die kunnen niet veranderen door een commit in deze repository. */
function losOpNaarBestand(vanaf, spec) {
  if (!spec.startsWith('.')) return null;
  const basis = path.dirname(vanaf);
  const kandidaten = [spec, spec + '.js', path.join(spec, 'index.js')];
  for (const k of kandidaten) {
    const vol = path.resolve(basis, k);
    try { if (fs.statSync(vol).isFile()) return vol; } catch (e) { /* volgende */ }
  }
  return null;
}

/* De statische requires van een bestand. Commentaar gaat er eerst af, want een
   uitleg die een require CITEERT is geen afhankelijkheid -- diezelfde val zat
   in keuring 7 en kostte daar een valse melding. */
function requiresVan(bestand) {
  let bron;
  try { bron = zonderCommentaar(fs.readFileSync(bestand, 'utf8')); } catch (e) { return { paden: [], leesbaar: false }; }
  const paden = [];
  for (const m of bron.matchAll(/require\((["'])([^"']+)\1\)/g)) paden.push(m[2]);
  /* WAT TELT ALS "NIET TE VOLGEN", EN WAAROM DE EERSTE VERSIE HIERVAN GEVAARLIJK WAS.

     Hier stond `/require\(\s*(?!["'])/` -- "een require waarvan het argument niet
     met een quote begint". Dat mist de gevaarlijkste vorm die er is:

         require('../routes/' + naam)          server/opzet/routes.js:62

     Die BEGINT met een quote, dus hij gold als gewoon, en de regex hierboven
     pakte hem niet op omdat er `+ naam` achter staat. Gevolg: negen
     routedomeinen -- auth, member, supplier, office, staff, social, techniek,
     zakelijk, wereld -- en alles daaronder viel buiten de sluiting, terwijl die
     sluiting `onvolledig: false` meldde. Compleet zeggen te zijn terwijl je een
     gat hebt, is precies waar een planner te weinig van gaat draaien.

     Nu is de regel omgekeerd en dus veilig: een require telt alleen als GEVOLGD
     als hij een kale, direct gesloten tekenreeks is. Al het andere -- een som,
     een variabele, een path.join -- is per definitie niet te volgen, tenzij hij
     met de hand in BEREKEND_BEREIK staat. */
  let berekend = false;
  for (const m of bron.matchAll(/require\(([^)]*)\)/g)) {
    if (!/^\s*(["'])[^"']*\1\s*$/.test(m[1])) { berekend = true; break; }
  }
  return { paden, berekend, leesbaar: true };
}

/* De transitieve sluiting: alles wat dit bestand direct of indirect binnenhaalt,
   binnen deze boom. Met een memo, want server.js sleept honderden bestanden mee
   en dat pad wordt door bijna elke toets gedeeld. */
function sluiting(start, memo) {
  memo = memo || new Map();
  if (memo.has(start)) return memo.get(start);
  const gezien = new Set();
  const rand = [start];
  let berekendGezien = false;
  memo.set(start, gezien);                       // alvast, tegen kringlopen
  while (rand.length) {
    const nu = rand.pop();
    if (gezien.has(nu)) continue;
    gezien.add(nu);
    const { paden, berekend } = requiresVan(nu);
    if (berekend) {
      const rel = path.relative(WORTEL, nu).split(path.sep).join('/');
      const bereik = berekendBereik(rel, WORTEL);
      if (bereik) { for (const b of bereik) if (!gezien.has(b)) rand.push(b); }
      else berekendGezien = true;              // niet te volgen: sluiting onvolledig
    }
    for (const spec of paden) {
      const vol = losOpNaarBestand(nu, spec);
      if (vol && !gezien.has(vol)) rand.push(vol);
    }
  }
  gezien.delete(start);
  const uit = { bestanden: gezien, berekend: berekendGezien };
  memo.set(start, uit);
  return uit;
}

/* START DEZE TOETS EEN ECHTE SERVER?

   Dan hangt hij aan alles wat die server laadt -- 1879 bestanden. Dat is geen
   tekortkoming van deze graaf maar een eigenschap van zulke toetsen: wie een
   hele server start, toetst tegen een hele server. Het zichtbaar maken is juist
   het nut: het laat zien waarom de suite zo breed reageert op elke wijziging.

   Twee wegen ernaartoe: rechtstreeks server.js starten, of via test/helper.js,
   dat het voor 681 toetsen doet. */
/* Het pad naar server.js staat lang niet altijd voluit in de bron. golive.test.js
   bouwt het op met path.join(__dirname, '..', 'server', 'server.js') en spawnt
   dat -- en die toets werd daardoor NIET als serverstarter herkend, waardoor de
   planner hem oversloeg bij een wijziging in server/routes/auth/account.js. De
   mutatiemotor had allang bewezen dat hij daar gevoelig voor is; de kruisproef
   in test/bewijsgraaf.test.js ving het. Vandaar ook de losse vorm. */
const BOOTSPOREN = [/startServer\s*\(/, /server\/server\.js/, /server\/trio\.js/,
  /['"]server\.js['"]/, /['"]trio\.js['"]/];
function startEenServer(bestand) {
  let bron;
  try { bron = zonderCommentaar(fs.readFileSync(bestand, 'utf8')); } catch (e) { return false; }
  return BOOTSPOREN.some(r => r.test(bron));
}

/* De graaf over alle toetsbestanden.

   Elk toetsbestand krijgt een verzameling bronbestanden en een soort:

     statisch    volledig te volgen keten; verandert daar niets, dan kan deze
                 toets niet van mening veranderen
     serverboot  hangt bovendien aan de volledige serversluiting
     onbekend    geen enkele te volgen afhankelijkheid gevonden

   ONBEKEND IS DE VEILIGE STAND, niet een gat. Zo'n toets wordt door de planner
   ALTIJD gedraaid; nooit overgeslagen, nooit "waarschijnlijk niet nodig". Een
   planner die gokt is erger dan geen planner: die maakt een groene ronde die
   niets betekent, en dat merk je pas in productie. */
/* HET LEESSPOOR: KANTEN DIE GEEN REQUIRE ACHTERLAAT.

   Deze graaf leidt afhankelijkheden af uit requires. Dat is exact voor code die
   wordt GEIMPORTEERD en blind voor code die wordt GELEZEN. test/ast-grens.test.js
   is het duidelijkste geval: vier afhankelijkheden volgens de requires, terwijl
   die toets gemeten 505 bestanden inleest -- 495 onder server/routes/, precies
   waar de beveiligingsregel over gaat. Een wijziging in zo'n route selecteerde
   die toets dus niet, en er zijn vijfenvijftig toetsen die een map aflopen.

   LEESSPOOR.json bevat wat er tijdens echte rondes is gelezen en niet uit een
   require volgde (scripts/lib/leesspoor.js meet het, scripts/leesspoor.js voegt
   samen). Die kanten komen er hier bij.

   DRIE DINGEN DIE HIER NIET GEBEUREN, alle drie met opzet:

   - er wordt nooit een kant WEGGEHAALD. Een waarneming is een ondergrens: wat
     deze ronde niet werd gelezen kan volgende ronde alsnog worden gelezen. Door
     alleen toe te voegen kiest de planner er meer en nooit minder.
   - een toets wordt hier niet `volledig` van, en verlaat de bak `altijd` niet.
     Zie de volgorde hieronder: dat oordeel valt op de STATISCHE sluiting, voor
     het spoor erbij komt.
   - het register is geen VOORWAARDE. Zonder LEESSPOOR.json doet deze graaf
     precies wat hij deed -- met de oude blinde vlek, maar zonder te breken. */
function leesspoorKanten(wortel) {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(wortel, 'LEESSPOOR.json'), 'utf8'));
    return (r && r.toetsen && typeof r.toetsen === 'object') ? r.toetsen : null;
  } catch (e) { return null; }
}

function graaf(opties) {
  const wortel = (opties && opties.wortel) || WORTEL;
  /* `zonderSpoor` is er voor scripts/leesspoor.js zelf: die moet het VERSCHIL
     bepalen tussen wat waargenomen is en wat de graaf zonder spoor al wist. Met
     spoor zou het register zichzelf voeden en na een ronde niets meer toevoegen
     -- een lus die stil op nul uitkomt. En voor test/leesspoor.test.js, die
     precies dat verschil moet kunnen stellen. */
  const spoor = (opties && opties.zonderSpoor) ? null : ((opties && opties.spoor) || leesspoorKanten(wortel));
  const testmap = path.join(wortel, 'test');
  const memo = new Map();
  const serverSluiting = sluiting(path.join(wortel, 'server', 'server.js'), memo);
  const perToets = new Map();
  let namen = [];
  try { namen = fs.readdirSync(testmap).filter(n => /\.(test|e2e)\.js$/.test(n)).sort(); } catch (e) { return null; }

  for (const naam of namen) {
    const vol = path.join(testmap, naam);
    const eigen = sluiting(vol, memo);
    const bestanden = new Set(eigen.bestanden);
    const boot = startEenServer(vol) || [...eigen.bestanden].some(f => startEenServer(f));
    if (boot) for (const f of serverSluiting.bestanden) bestanden.add(f);
    /* OOK test/ TELT ALS AFHANKELIJKHEID, en dat stond hier eerst niet.

       681 toetsen hangen aan test/helper.js. Door hier alleen server/, scripts/
       en public/ mee te nemen, viel die helper buiten elke afhankelijkheid --
       en dan zou een wijziging IN de helper geen enkele toets selecteren. De
       kruisproef tegen de mutatiemotor wees het meteen aan: strenge-poort.test.js
       is bewezen gevoelig voor test/helper.js en werd overgeslagen. */
    /* EERST HET OORDEEL, DAN PAS DE WAARNEMING -- en die volgorde is het punt.

       soort en volledig bepalen of een toets in `altijd` belandt: de veilige bak
       die de planner nooit overslaat. Die twee worden UITSLUITEND uit de
       statische sluiting gerekend. Zou het leesspoor meetellen, dan zou een
       toets met nul requires maar wel waargenomen lezingen uit `altijd`
       KLIMMEN -- van "draait altijd" naar "draait soms", op grond van een
       ondergrens. Dan haalt de waarneming een garantie weg in plaats van er een
       toe te voegen, en precies dat mag ze niet.

       Ik heb dat zelf eerst fout gehad: de kanten stonden erbij voordat het
       oordeel viel. test/leesspoor.test.js stelt het nu als bewering. */
    const statisch = [...bestanden].filter(f => AFHANKELIJK.some(m => f.startsWith(path.join(wortel, m) + path.sep)));
    const volledig = !eigen.berekend && (!boot || !serverSluiting.berekend);
    const soort = statisch.length === 0 ? 'onbekend' : (boot ? 'serverboot' : 'statisch');
    if (spoor && Array.isArray(spoor[naam])) {
      for (const rel of spoor[naam]) bestanden.add(path.join(wortel, rel));
    }
    const bron = [...bestanden].filter(f => AFHANKELIJK.some(m => f.startsWith(path.join(wortel, m) + path.sep)));
    perToets.set(naam, { bestanden: bron, soort, volledig });
  }

  /* DE OMGEKEERDE INDEX, en die is niet optioneel.

     Zonder hem beantwoordt de planner "welke toetsen raakt dit bestand?" door
     voor ELKE toets zijn hele lijst af te lopen: 2148 afhankelijkheden maal 1040
     toetsen. Dat is honderden miljoenen vergelijkingen per vraag, en de eerste
     versie hiervan deed er meer dan tien minuten over -- een planner die langer
     nadenkt dan de toetsen duren, bespaart niets.

     Een keer omkeren kost een fractie, en daarna is elke vraag een opzoeking. */
  const perBestand = new Map();
  const altijd = [];
  for (const [naam, d] of perToets) {
    if (d.soort === 'onbekend' || !d.volledig) { altijd.push(naam); continue; }
    for (const f of d.bestanden) {
      const rel = path.relative(wortel, f).split(path.sep).join('/');
      if (!perBestand.has(rel)) perBestand.set(rel, []);
      perBestand.get(rel).push(naam);
    }
  }
  return { perToets, perBestand, altijd, serverSluiting: serverSluiting.bestanden.size };
}

/* Hoeveel toetsen kunnen we NIET plaatsen? Dat is de meter die omlaag moet:
   elke onbekende of onvolledige toets is er een die de planner nooit mag
   overslaan, en dus een die de kleinste voldoende verificatie groter maakt. */
function onbekendeAfhankelijkheden(g) {
  if (!g) return null;
  let n = 0;
  for (const [, d] of g.perToets) if (d.soort === 'onbekend' || !d.volledig) n++;
  return n;
}

module.exports = { losOpNaarBestand, requiresVan, sluiting, berekendBereik, BEREKEND_BEREIK, leesspoorKanten,
  graaf, onbekendeAfhankelijkheden, startEenServer, WORTEL, MAPPEN, AFHANKELIJK };
