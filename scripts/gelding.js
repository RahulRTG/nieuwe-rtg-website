#!/usr/bin/env node
/* ============================================================================
   DE GELDING -- waar geldt een wet, waar leeft hij, en waar kan iemand hem zien?

   DE NAAM IS NIET `bereik`, EN DAT IS EEN GELEERDE LES. Dit register heette in
   zijn eerste uur BEREIK.json, en dat bestond al: het schermbereik-register dat
   scripts/check.js leest ("schermen zonder zichtbare klikroute"). Het werd er
   stilletjes door overschreven. Precies de naambotsing waar dit huis zes keer
   voor waarschuwt -- Pulse, envelop, Kanaal, capability, VERMOGENS, wallet --
   en ze werd gemaakt door de meter die over naamverwarring gaat.

   DRIE VRAGEN DIE ONDER EEN NAAM LIEPEN

   `bereik` betekende in de bewijsregisters drie dingen tegelijk (LAT.md regel
   14): wat een wachter RAAKT, waarover een oordeel GELDT, en wat een rol MAG.
   De eerste twee zijn de twee kanten van dezelfde vraag, en wie ze optelt leest
   waargenomen reik als verklaarde gelding. Dit script houdt ze uit elkaar:

     CLAIM   waar zegt de doctrine dat de regel geldt?
     DRAAG   waar wordt die regel in het PRODUCT uitgevoerd?
     WACHT   waar kan de wachter een overtreding werkelijk zien?

   DE DRIE ASSEN DELEN GEEN BRON, EN DAT IS DE HELE ONTWERPKEUZE

   Zou de DRAAG-as de woordenlijst van de wachter gebruiken, dan bewegen die twee
   bij elke wijziging samen en meet je een echo in plaats van een verschil. Het
   ijkcriterium staat daarom in test/gelding.test.js: een drager weghalen mag
   alleen de DRAAG-as verschuiven, een wachterpad weghalen alleen de WACHT-as.
   Beweegt er een tweede as mee zonder oorzaak, dan is er een verborgen gedeelde
   bron -- precies de fout die deze hele laag moet uitsluiten.

     CLAIM  komt uit de doctrine-documenten (verklaard, met citaten die bestaan)
     DRAAG  komt uit de VORMEN van bewaarde dingen (scripts/objectmodel.js)
     WACHT  komt uit de BRON van de wachter zelf (welke paden scant hij)

   EEN EERDERE DRAAG-SENSOR IS AFGEKEURD, en dat hoort hier te staan. Hij zocht
   modules die een verzameling mensen sorteren, en van drie nagekeken treffers
   waren er twee vals: `kandidaten` bleek ontmoetplekken (vonk/halfweg.js) en
   wallets (waarde/samenstellen.js) te betekenen. Een sensor met een derde
   precisie zou cellen vullen die er net zo verzorgd uitzien als de juiste. De
   vormsensor hieronder vraagt iets anders: welke BEWAARDE vorm koppelt een
   persoonssleutel aan een waarderend veld? Dat zijn er 5 van de 1391, en de
   scherpste is `{ leerling, vak, cijfer }` in server/school/klas.js.

   VIJF UITKOMSTEN, EN GEEN PERCENTAGE

     GEDRAGEN_EN_GEZIEN            claim, drager en wachter vallen samen
     GEDRAGEN_NIET_GEZIEN         er is een drager, de wachter ziet hem niet
     GECLAIMD_GEEN_DRAGER_GEVONDEN de wet claimt hier, de dragersensor vindt niets
     GEZIEN_BUITEN_CLAIM          de wachter kijkt waar de wet niets claimt
     ONBEPAALD                    geen van de sensoren kan hier iets zeggen

   TWEE VAN DIE VIJF ZIJN GEMAKKELIJK VERKEERD TE LEZEN, en daarom staat het er
   in het register zelf bij:

     GECLAIMD_GEEN_DRAGER_GEVONDEN betekent NIET dat er geen drager is. Alleen
     dat DEZE dragersensor er geen vond -- en die ziet vandaag `opslaan` en
     `tonen`, en `projecteren` en `rangschikken` niet.

     GEDRAGEN_NIET_GEZIEN betekent NIET "ongetest". Misschien bewaakt een
     centrale laag de cel alsnog op een manier die deze wachtersensor niet ziet.

   Draai:  node scripts/gelding.js            (schrijft BEREIK.json)
           node scripts/gelding.js --toon      (laat zien, schrijft niets)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'GELDING.json');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[90m', vet: '\x1b[1m', uit: '\x1b[0m' };
const TOON = process.argv.includes('--toon');

/* ------------------------------------------------- de projectieruimte */

/* EEN CEL IS objectfamilie x aspect x handeling x context x actor. De drie assen
   worden onafhankelijk gevuld en pas DAARNA vergeleken; zonder een gedeelde
   ruimte vergelijk je vier documenten met drie mappen, en dat is geen
   vergelijking maar twee aanleidingen naast elkaar. */
const GEVAL = {
  id: 'geen-cijfer-op-mens',
  objectfamilie: 'MENS',
  aspect: 'PRESTATIEWAARDERING',
  handelingen: ['opslaan', 'projecteren', 'rangschikken', 'tonen'],
  contexten: ['foundation', 'school', 'work', 'living'],
  actoren: ['systeem', 'medewerker', 'partner', 'externeLezer'],

  /* TWEE ACTOREN DIE ALLEEN IN SCHOOL BESTAAN, en dat is geen verfijning maar
     de voorwaarde om het besluit van 14 september uberhaupt te kunnen opschrijven.

     De vier actoren hierboven zijn allemaal DERDEN: het systeem, een medewerker
     van RTG, een partner, een externe lezer. De leerling zelf en zijn docent
     komen er niet in voor, en juist over die twee gaat de uitzondering. Zonder
     hen is "alleen aan de leerling en zijn docent" niet uit te drukken en valt
     de keuze terug op alles of niets -- en dat was hem ook: de uitzondering gold
     voor `opslaan` in de hele context, voor elke actor.

     Ze bestaan ALLEEN in school. Een `leerling` in de context `work` is een cel
     zonder betekenis, en 24 betekenisloze cellen erbij zouden de telling
     oppoetsen met lucht. */
  actorenPer: { school: ['leerling', 'docent'] },

  /* DE CLAIM-AS: uit de doctrine en nergens anders vandaan. Dit is een VERKLAARDE
     lezing van een mens; wat de machine ervan controleert is dat elk citaat nog
     bestaat in het document dat het noemt (dezelfde vorm als de ankers in
     WETTEN.json). De strekking zelf is geen berekening. */
  claim: {
    soort: 'verklaard',
    strekking: 'platformbreed: geen cijfer op een mens, in geen enkele context en door geen enkele actor, ' +
      'ook niet intern als sorteersleutel',
    citaten: [
      { bestand: 'ONTMOETEN.md', anker: 'Geen cijfer op een mens' },
      { bestand: 'HDI.md', anker: 'De meeteenheid is nooit de mens' },
      { bestand: 'LEVEN.md', anker: 'De bijdrage-spiegel is nooit vergelijkend' },
      { bestand: 'FOUNDATION.md', anker: 'Geen capaciteitscijfer op een mens' },
    ],
    /* Waar de doctrine zelf een uitzondering maakt. Zonder deze zou elke cel in
       School als overtreding lezen, terwijl een cijfer op een toets juist het
       product is (SCHOOL.md par. 11 verbiedt een risicoscore, een uitvalkans en
       een blijvend niveau-label -- niet het cijferboek).

       DE UITZONDERING KENT SINDS 14 SEPTEMBER EEN ACTOR, en dat is het besluit
       van de eigenaar op de bevinding die dit register zelf opleverde. Hij stond
       op de HANDELING `opslaan` en op niets anders, en daardoor viel `tonen`
       volledig buiten de uitzondering -- ook aan de leerling zelf. Dat is niet
       vol te houden: een cijfer LATEN ZIEN aan de leerling van wie het is, is
       dezelfde leerstof als het bewaren ervan. Andersom is een cijfer tonen aan
       een partner of een externe lezer precies wat par. 11.1 tegenhoudt.

       Vandaar twee regels in plaats van een, en de tweede noemt de twee actoren
       bij naam. Wat er NIET in staat is even belangrijk: `systeem`, `medewerker`,
       `partner` en `externeLezer` blijven bij `tonen` onder de grens vallen. */
    uitzonderingen: [
      { context: 'school', handeling: 'opslaan',
        waarom: 'SCHOOL.md par. 11.1 verbiedt een score BUITEN het potje (risicoscore, uitvalkans, ranglijst, ' +
          'blijvend niveau-label); een cijfer op een toets is de leerstof zelf en valt daar niet onder' },
      { context: 'school', handeling: 'tonen', actoren: ['leerling', 'docent'],
        waarom: 'een cijfer tonen aan de leerling van wie het is, of aan zijn docent, is dezelfde leerstof ' +
          'als het bewaren ervan. Tonen aan een partner of een externe lezer is dat niet en blijft onder ' +
          'de grens -- dat is precies het onderscheid dat SCHOOL.md par. 11.1 maakt' },
    ],
  },

  /* DE WACHT-AS leest de bron van de wachter: welke paden scant hij werkelijk? */
  wachter: { bestand: 'test/cijferopmens.test.js', lijst: 'MAPPEN' },
};

/* Van modulepad naar context. Een BESLUIT en geen afleiding: welke map bij welke
   wereld hoort, staat nergens in de code (WERELDLIJST.md zegt dat met zoveel
   woorden over de laag tussen wereld en onderdeel). */
const CONTEXT_VAN = [
  [/^server\/school\//, 'school'],
  [/^server\/kern\/(rtfos|leven|levensgraaf|gezin|foundation)/, 'foundation'],
  [/^server\/kern\/(onderneming|concern|payroll|vakwerk|werk|kantoor|vertegenwoordiging|carriereledger|rugdekking)/, 'work'],
  [/^server\/bedrijf\//, 'work'],
  [/^server\/kern\//, 'living'],
];
const contextVan = (p) => (CONTEXT_VAN.find(([re]) => re.test(p)) || [null, null])[1];

/* Welke actoren bestaan er in deze context? De vier derden overal, plus wat
   alleen daar bestaat. Een actor die in een context niets betekent, levert geen
   cel op -- de celruimte hoort te beschrijven wat er is, niet wat er past. */
function actorenVan(context) {
  return GEVAL.actoren.concat((GEVAL.actorenPer || {})[context] || []);
}

/* ------------------------------------------------------------ de drie assen */

/* CLAIM. Geeft per cel of de doctrine daar iets claimt. De strekking is
   platformbreed, dus elke cel telt -- behalve waar de doctrine zelf een
   uitzondering maakt. */
function asClaim() {
  const cellen = new Map();
  for (const handeling of GEVAL.handelingen) {
    for (const context of GEVAL.contexten) {
      for (const actor of actorenVan(context)) {
        const uitz = GEVAL.claim.uitzonderingen.find(u =>
          (!u.context || u.context === context) && (!u.handeling || u.handeling === handeling) &&
          (!u.actoren || u.actoren.includes(actor)));
        cellen.set(sleutel(handeling, context, actor),
          uitz ? { claimt: false, uitgezonderd: true, waarom: uitz.waarom } : { claimt: true });
      }
    }
  }
  /* De citaten moeten bestaan; een claim die naar een verdwenen zin wijst, is
     een claim die niemand meer kan nalezen. */
  const kapot = GEVAL.claim.citaten.filter(c => {
    try { return !fs.readFileSync(path.join(WORTEL, c.bestand), 'utf8').includes(c.anker); }
    catch (e) { return true; }
  });
  return { cellen, kapot };
}

/* DRAAG. Uit de VORMEN van bewaarde dingen -- welke koppelt een persoonssleutel
   aan een waarderend veld? -- plus ROUTEBRON.json voor de vraag of diezelfde
   module een API-route afhandelt. Die twee bronnen geven twee handelingen:
   `opslaan` en `tonen`. Voor `projecteren` en `rangschikken` geeft de as niets,
   en dat is een tekort van de SENSOR en geen uitspraak over het product. */
const MENSVELD = /^(handle|codenaam|lid|lidSleutel|staffId|persoon|persoonId|member|memberKey|leerling|medewerker|deelnemer|speler)$/i;
const WAARDEVELD = /^(score|punten|rang|ranking|niveau|positie|gemiddelde|percentiel|beoordeling|cijfer|waardering|sterren|rapport)$/i;

function asDraag(vormen, routesPerBestand) {
  const cellen = new Map();
  const dragers = [];
  for (const v of vormen) {
    const mens = v.velden.filter(x => MENSVELD.test(x));
    const waarde = v.velden.filter(x => WAARDEVELD.test(x));
    if (!mens.length || !waarde.length) continue;
    const context = contextVan(v.module);
    if (!context) continue;

    /* HANDELING 2, `tonen`: handelt deze dragermodule ook een API-route af? Dan
       verlaat het bewaarde oordeel het systeem. Dat komt uit ROUTEBRON.json --
       een derde bron, onafhankelijk van zowel de vormen als de wachter.

       WAAROM `projecteren` EN `rangschikken` HIER NIET STAAN, en dat is gemeten
       en niet aangenomen: een module die ergens een persoonssleutel noemt en
       ergens `.map(` of `.sort(` gebruikt, levert 410 respectievelijk 155
       treffers. Dat is dezelfde precisie als de woordsensor die hierboven al is
       afgekeurd. Zolang er geen vorm- of graafsignaal voor is, blijven die twee
       handelingen onbepaald -- met de reden in het register. */
    const routes = (routesPerBestand && routesPerBestand.get(v.module)) || [];
    dragers.push({ module: v.module, context, mens, waarde, routes: routes.length,
      handelingen: routes.length ? ['opslaan', 'tonen'] : ['opslaan'] });

    /* Wie de bewaarde vorm leest is niet uit de vorm af te leiden, dus de actor
       blijft onbepaald: de cel wordt gezet voor elke actor en die onzekerheid
       staat in de uitslag. */
    for (const actor of actorenVan(context)) {
      cellen.set(sleutel('opslaan', context, actor), true);
      if (routes.length) cellen.set(sleutel('tonen', context, actor), true);
    }
  }
  return { cellen, dragers };
}

/* Welke bestanden handelen een API-route af? Uit ROUTEBRON.json, dat uit de
   ROUTER komt en niet uit de bronboom. Ontbreekt het register, dan geeft deze
   lezer een lege kaart en meldt de DRAAG-as dat hij `tonen` niet kon zien --
   een sensor die niet kon kijken is iets anders dan een sensor die niets zag. */
function routesPerBestand() {
  try {
    const rb = JSON.parse(fs.readFileSync(path.join(WORTEL, 'ROUTEBRON.json'), 'utf8'));
    const rijen = Array.isArray(rb.perRoute) ? rb.perRoute : [];
    const kaart = new Map();
    for (const r of rijen) {
      if (!r || !r.bestand) continue;
      if (!kaart.has(r.bestand)) kaart.set(r.bestand, []);
      kaart.get(r.bestand).push(r.route);
    }
    return { kaart, stand: 'gemeten' };
  } catch (e) { return { kaart: new Map(), stand: 'geenBron' }; }
}

/* WACHT. Uit de BRON van de wachter: welke paden scant hij?

   DE NAMEN WORDEN TEGEN DE BOOM GEHOUDEN EN NIET VAN EEN VOORVOEGSEL VOORZIEN,
   en dat is op 14 september gerepareerd nadat deze as zichzelf had betrapt.

   De oude lezer deed twee aannames tegelijk: hij pakte met `\[([^\]]*)\]` het
   EERSTE vierkante haakjespaar, en hij plakte voor elke naam `server/kern/`. In
   MAPPEN staat de kernlijst inderdaad eerst, maar eronder staat nog een losse
   regel -- `path.join(__dirname, '..', 'server', 'school')` -- en die viel
   buiten het eerste haakjespaar EN buiten het voorvoegsel. Gevolg: de wachter
   scande School aantoonbaar (toets 3 zakt zonder), terwijl deze as meldde dat
   School door niemand werd bekeken. Elke schoolcel las daardoor als ongezien.

   Dat is precies de faalvorm waar dit hele geval over gaat: een sensor die niet
   kon kijken, gaf een uitslag alsof hij had gekeken. Nu leest hij ALLE tekens
   tussen de buitenste haken, en resolveert elke naam tegen de echte boom --
   `server/<naam>` of `server/kern/<naam>`, en alleen als de gevonden map ook
   echt zo heet. Wat niet resolveert, staat als `nietOpgelost` in de uitslag en
   verdwijnt niet stil: een naam die de as niet thuisbrengt, is een gat in de
   meting en geen nul. */
function asWacht(bronTekst) {
  /* De bron is een PARAMETER zodat test/gelding.test.js hem kan verhangen zonder
     een bestand aan te raken -- en zodat deze as aantoonbaar niets anders leest
     dan deze tekst. */
  let bron = bronTekst;
  if (bron === undefined) {
    try { bron = fs.readFileSync(path.join(WORTEL, GEVAL.wachter.bestand), 'utf8'); }
    catch (e) { return { cellen: new Map(), paden: [], nietOpgelost: [], bron: 'geenBron' }; }
  }

  const start = bron.search(new RegExp('const\\s+' + GEVAL.wachter.lijst + '\\s*=\\s*\\['));
  if (start < 0) return { cellen: new Map(), paden: [], nietOpgelost: [], bron: 'lijstNietGevonden' };
  /* De BUITENSTE haken, gebalanceerd geteld. Het eerste `]` is dat van de
     binnenste lijst met kernnamen, en daar hield de oude lezer op. */
  const open = bron.indexOf('[', start);
  let diep = 0, eind = -1;
  for (let i = open; i < bron.length; i++) {
    if (bron[i] === '[') diep++;
    else if (bron[i] === ']' && --diep === 0) { eind = i; break; }
  }
  if (eind < 0) return { cellen: new Map(), paden: [], nietOpgelost: [], bron: 'lijstNietGesloten' };

  const namen = [...bron.slice(open, eind).matchAll(/'([^']+)'/g)].map(x => x[1]);

  /* EERST RESOLVEREN, DAN DE PADFRAGMENTEN ERUIT. De lijst bevat naast de
     bewaakte namen ook de brokken van de `path.join`-aanroepen eromheen ('..',
     'server', 'kern'), en sommige daarvan resolveren gewoon: `server/..` is de
     wortel en `server/kern` is een echte map. Een hardgecodeerd rijtje woorden
     zou dat oplossen en meteen de volgende lijst zijn die uit de pas loopt.

     Het signaal zit in de boom zelf: een bewaakte map is een BLAD van deze
     verzameling. Wat een strikte voorouder is van een andere kandidaat, is een
     brok van het pad ernaartoe en geen doel op zich. Dat staat als `padfragment`
     in de uitslag en niet weggemoffeld -- zou iemand ooit echt een map EN een
     submap ervan bewaken, dan ziet hij hier waarom de bovenste wegviel. */
  const opgelost = [];
  const nietOpgelost = [];
  for (const naam of namen) {
    const kandidaat = ['server/' + naam, 'server/kern/' + naam]
      .map(p => path.normalize(p).split(path.sep).join('/'))
      /* NORMALISEREN VOOR HET RESOLVEREN, want '..' maakt van 'server/..' de
         WORTEL -- en de wortel is geen bewaakte map maar het huis zelf. */
      .filter(p => p !== '.' && !p.startsWith('..'))
      .find(p => { try { return fs.statSync(path.join(WORTEL, p)).isDirectory(); }
                   catch (e) { return false; } });
    if (kandidaat) { if (!opgelost.some(o => o.pad === kandidaat)) opgelost.push({ naam, pad: kandidaat }); }
    else nietOpgelost.push(naam);
  }
  const isVoorouder = (a, b) => a !== b && (b + '/').startsWith(a + '/');
  const paden = opgelost.filter(o => !opgelost.some(x => isVoorouder(o.pad, x.pad))).map(o => o.pad);
  const padfragment = opgelost.filter(o => opgelost.some(x => isVoorouder(o.pad, x.pad))).map(o => o.naam);

  /* Wat niet resolveert EN als naamdeel in een bewaakt pad voorkomt, is
     eveneens een brok van de join ('server' in `server/school`). Wat overblijft
     is een naam die deze as werkelijk niet thuisbrengt, en dat is een gat in de
     meting en geen nul. */
  const delen = new Set(paden.flatMap(p => p.split('/')));
  const onbekend = nietOpgelost.filter(n => !delen.has(n) && !padfragment.includes(n));

  const cellen = new Map();
  const contexten = new Set();
  for (const p of paden) {
    const context = contextVan(p + '/');
    if (!context) continue;
    contexten.add(context);
    /* De scan leest broncode; wat hij daarmee ziet is de OPSLAG-kant. Over
       projecteren, rangschikken en tonen doet hij geen uitspraak. */
    for (const actor of actorenVan(context)) cellen.set(sleutel('opslaan', context, actor), true);
  }
  return { cellen, paden, padfragment, nietOpgelost: onbekend, contexten: [...contexten], bron: 'gemeten' };
}

const sleutel = (h, c, a) => h + ' | ' + c + ' | ' + a;

/* --------------------------------------------------------------- de uitslag */

/* DE VIJF UITKOMSTEN, en `UITGEZONDERD_IN_DOCTRINE` is er op 14 september bij
   gekomen omdat `ONBEPAALD` twee dingen betekende die niets met elkaar te maken
   hebben.

   `ONBEPAALD` hoort te zeggen: hier claimt de doctrine niets EN niemand weet
   waarom. Een cel waar de doctrine ZELF een uitzondering maakt, met een
   uitgeschreven reden erbij, is het tegenovergestelde daarvan -- daar is juist
   over nagedacht. Toch vielen die vier schoolcellen in dezelfde bak, en dan
   leest een register vier doordachte besluiten als vier open vragen.

   Zelfde regel als elders in dit huis: `ONBEKEND` is geen `WEIGEREN`, en
   `geen-effect-gemeten` is geen `onbekend`. Wie twee uitslagen samenvoegt omdat
   ze allebei "niet van toepassing" voelen, verliest precies het verschil waar
   een mens naar op zoek is. */
function oordeel(claimt, draagt, wacht, uitgezonderd) {
  if (uitgezonderd) return 'UITGEZONDERD_IN_DOCTRINE';
  if (!claimt && wacht) return 'GEZIEN_BUITEN_CLAIM';
  if (!claimt) return 'ONBEPAALD';
  if (draagt && wacht) return 'GEDRAGEN_EN_GEZIEN';
  if (draagt) return 'GEDRAGEN_NIET_GEZIEN';
  return 'GECLAIMD_GEEN_DRAGER_GEVONDEN';
}
function meet(vormen) {
  const claim = asClaim();
  const routes = routesPerBestand();
  const draag = asDraag(vormen, routes.kaart);
  draag.routeStand = routes.stand;
  const wacht = asWacht();

  const cellen = [];
  for (const handeling of GEVAL.handelingen) {
    for (const context of GEVAL.contexten) {
      for (const actor of actorenVan(context)) {
        const s = sleutel(handeling, context, actor);
        const c = claim.cellen.get(s) || { claimt: false };
        cellen.push({
          handeling, context, actor,
          claim: c.claimt, draag: !!draag.cellen.get(s), wacht: !!wacht.cellen.get(s),
          uitslag: oordeel(c.claimt, !!draag.cellen.get(s), !!wacht.cellen.get(s), !!c.uitgezonderd),
          ...(c.waarom ? { claimWaarom: c.waarom } : {}),
        });
      }
    }
  }
  return { claim, draag, wacht, cellen };
}

function stempel() {
  const git = (...a) => { try { return execFileSync('git', a, { cwd: WORTEL, encoding: 'utf8' }).trim(); } catch (e) { return null; } };
  const vuil = git('status', '--porcelain');
  return { op: new Date().toISOString(), commit: git('rev-parse', '--short', 'HEAD'),
    boomVuil: vuil === null ? null : vuil.length > 0, instrument: 'scripts/gelding.js', node: process.version };
}

function draai() {
  const O = require('./objectmodel.js');
  const vormen = O.lees().vormen;
  const m = meet(vormen);

  const telling = {};
  for (const c of m.cellen) telling[c.uitslag] = (telling[c.uitslag] || 0) + 1;

  const uit = {
    stempel: stempel(),
    uitleg: 'Waar geldt een wet (CLAIM), waar leeft hij (DRAAG), en waar kan een wachter hem zien (WACHT)? ' +
      'De drie assen worden onafhankelijk gevuld en pas daarna vergeleken; zij delen geen bron, en ' +
      'test/gelding.test.js houdt dat vast.',
    graad: 'vermoed',
    grens: 'GEEN PERCENTAGE, en dat is een ontwerpkeuze: voor een verhouding moet eerst vaststaan wat een ' +
      'telbare eenheid is, en bij een centrale architectuur kan een objectfamilie zwaarder wegen dan twintig ' +
      'mappen. DRIE UITSLAGEN ZIJN GEMAKKELIJK VERKEERD TE LEZEN: GECLAIMD_GEEN_DRAGER_GEVONDEN betekent ' +
      'NIET dat er geen drager is, alleen dat DEZE sensor er geen vond -- en die ziet vandaag `opslaan` ' +
      'en `tonen`, en `projecteren` en `rangschikken` niet. GEDRAGEN_NIET_GEZIEN betekent NIET "ongetest": ' +
      'misschien bewaakt een centrale laag de cel op een manier die deze wachtersensor niet ziet. En ' +
      'UITGEZONDERD_IN_DOCTRINE betekent NIET "hier mag alles": het zegt dat de doctrine op deze cel zelf een ' +
      'uitzondering maakt, met een uitgeschreven reden die in `claimWaarom` staat -- wie die reden niet leest, ' +
      'leest de uitslag verkeerd. Hij is met opzet gescheiden van ONBEPAALD, want dat betekent het ' +
      'tegenovergestelde: daar weet niemand waarom er niets wordt geclaimd.',
    geval: { id: GEVAL.id, objectfamilie: GEVAL.objectfamilie, aspect: GEVAL.aspect,
      handelingen: GEVAL.handelingen, contexten: GEVAL.contexten, actoren: GEVAL.actoren },
    assen: {
      claim: { soort: GEVAL.claim.soort, strekking: GEVAL.claim.strekking,
        citaten: GEVAL.claim.citaten, citaatKapot: m.claim.kapot.map(c => c.bestand + ': ' + c.anker),
        uitzonderingen: GEVAL.claim.uitzonderingen },
      draag: { bron: 'scripts/objectmodel.js (vormen van bewaarde dingen) + ROUTEBRON.json (routebereik)',
        ziet: ['opslaan', 'tonen'], zietNiet: ['projecteren', 'rangschikken'],
        zietNietWaarom: 'GEMETEN en niet aangenomen: een module die ergens een persoonssleutel noemt en ergens ' +
          '`.map(` of `.sort(` gebruikt levert 410 respectievelijk 155 treffers -- dezelfde precisie als de ' +
          'woordsensor die al is afgekeurd. Zonder vorm- of graafsignaal blijven die twee handelingen onbepaald.',
        tonenBron: 'ROUTEBRON.json (welke module handelt een API-route af)',
        tonenStand: m.draag.routeStand,
        /* LAT.md regel 13: een meter kent zijn eigen grens, en deze tak heeft er
           een die je moet kennen voordat je de cel leest. */
        tonenGrens: 'WAT HIER GEMETEN IS, is dat de dragermodule een API-route afhandelt -- niet dat die ' +
          'route het oordeel TOONT. Alle veertien routes van de twee schooldragers zijn POST, en dit huis ' +
          'gebruikt POST ook om te lezen (/api/foundation/school/toets/lijst), dus de methode scheidt ' +
          'schrijven en tonen niet. `tonen` betekent hier dus: het bewaarde oordeel is van buiten de module ' +
          'bereikbaar. Dat is een ONDERgrens voor bereikbaarheid en een BOVENgrens voor tonen in enge zin.',
        dragers: m.draag.dragers },
      wacht: { bron: GEVAL.wachter.bestand + ' :: ' + GEVAL.wachter.lijst, stand: m.wacht.bron,
        paden: m.wacht.paden, contexten: m.wacht.contexten || [] },
    },
    telling,
    /* EEN VONDST UIT HET VERBREDEN ZELF, en hij wordt hier OPGESCHREVEN in plaats
       van weggewerkt. Dat is de vorm van `openBekend` in scripts/tikken.js en van
       `sluitMetBevinding` in scripts/ritproef.js: een proef die iets echts vindt
       en maar twee uitgangen heeft -- zakken of de bevinding wegpoetsen -- levert
       op den duur alleen nog wegpoetsen op. */
    bevinding: 'De vraag die dit register zelf stelde, is op 14 september door de eigenaar beantwoord, en ' +
      'de uitslag is daardoor op drie punten verschoven. (1) DE UITZONDERING VOOR SCHOOL KENT NU EEN ACTOR. ' +
      'Hij stond op de handeling `opslaan` en op niets anders, dus `tonen` viel er volledig buiten -- ook aan ' +
      'de leerling zelf, en dat is niet vol te houden. Hij geldt nu ook voor `tonen`, maar uitsluitend richting ' +
      '`leerling` en `docent`; tonen aan systeem, medewerker, partner of externe lezer blijft onder de grens. ' +
      'Die vier cellen staan dus nog steeds op GEDRAGEN_NIET_GEZIEN, en dat is nu een SCHERPE bevinding in ' +
      'plaats van een vage: het is geen open vraag meer maar een deel van de grens waar de wachter niet bij kan. ' +
      '(2) DE ACTOR-AS KENT TWEE ACTOREN DIE ALLEEN IN SCHOOL BESTAAN. Zonder `leerling` en `docent` was het ' +
      'besluit niet op te schrijven: de vier oorspronkelijke actoren zijn allemaal DERDEN. (3) DE WACHT-AS ZAG ' +
      'SCHOOL HELEMAAL NIET, en dat was een defect van de sensor. Hij las het eerste vierkante haakjespaar van ' +
      'MAPPEN en plakte er `server/kern/` voor; `server/school` staat op een losse regel eronder en viel dus ' +
      'buiten allebei. De wachter scant School aantoonbaar (toets 3 van test/cijferopmens.test.js zakt zonder), ' +
      'terwijl deze as meldde dat niemand daar keek. Een sensor die niet kon kijken, gaf een uitslag alsof hij ' +
      'had gekeken -- exact de faalvorm waar dit hele geval over gaat. ONBEPAALD staat hierdoor op nul: de vier ' +
      'cellen die daar stonden waren de doctrine-uitzondering zelf, en die heet nu UITGEZONDERD_IN_DOCTRINE.',
    cellen: m.cellen,
  };

  if (TOON) { toon(uit); return; }
  fs.writeFileSync(DOEL, JSON.stringify(uit, null, 2) + '\n');
  toon(uit);
  console.log(K.grijs + 'GELDING.json geschreven.' + K.uit);
}

function toon(uit) {
  console.log('');
  console.log(K.vet + '  HET BEREIK -- ' + uit.geval.objectfamilie + ' x ' + uit.geval.aspect + K.uit);
  console.log(K.grijs + '  (graad: vermoed -- drie assen, geen gedeelde bron, geen percentage)' + K.uit);
  console.log('');
  const kleur = { GEDRAGEN_EN_GEZIEN: K.groen, GEDRAGEN_NIET_GEZIEN: K.geel,
    GECLAIMD_GEEN_DRAGER_GEVONDEN: K.grijs, GEZIEN_BUITEN_CLAIM: K.geel, ONBEPAALD: K.grijs };
  for (const [naam, n] of Object.entries(uit.telling).sort((a, b) => b[1] - a[1])) {
    console.log('    ' + (kleur[naam] || '') + String(n).padStart(4) + '  ' + naam + K.uit);
  }
  console.log('');
  console.log(K.vet + '  DE DRAGERS DIE DE VORMSENSOR VOND' + K.uit);
  for (const d of uit.assen.draag.dragers) {
    console.log('    ' + d.context.padEnd(11) + d.module.padEnd(42) + K.grijs + d.mens.join(',') + ' + ' + d.waarde.join(',') + K.uit);
  }
  if (!uit.assen.draag.dragers.length) console.log(K.grijs + '    (geen)' + K.uit);
  console.log('');
  console.log(K.vet + '  WAT DE WACHTER WERKELIJK SCANT' + K.uit);
  console.log('    ' + (uit.assen.wacht.paden.join(', ') || '(niets)') +
    K.grijs + '  -> context: ' + (uit.assen.wacht.contexten.join(', ') || 'geen') + K.uit);
  console.log('');
  const cel = uit.cellen.filter(c => c.uitslag === 'GEDRAGEN_NIET_GEZIEN');
  if (cel.length) {
    console.log(K.vet + '  GEDRAGEN, NIET GEZIEN' + K.uit + K.grijs + '  (een drager gevonden, deze wachter ziet hem niet)' + K.uit);
    for (const c of cel.slice(0, 8)) console.log('    ' + c.handeling + ' | ' + c.context + ' | ' + c.actor);
    console.log('');
  }
}

if (require.main === module) draai();
module.exports = { meet, asClaim, asDraag, asWacht, oordeel, contextVan, GEVAL, sleutel, DOEL };
