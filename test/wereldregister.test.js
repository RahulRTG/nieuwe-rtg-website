/* HET WERELDREGISTER IS FAIL-CLOSED: een item dat niet oplost, laat de bouw
   zakken in plaats van stil te verdwijnen.

   WAAROM DEZE TOETS BESTAAT, en het is een echt gevonden gat. In `MAPPEN` -- de
   enige lijst werelden (WERELD.md) -- stond `link:bank`. Er is geen regel `bank`
   in `LINKS`. Wat er dan gebeurt is dit:

       itemDef('link:bank')      -> undefined
       itemZichtbaar('link:bank') -> false
       de tegel                   -> verschijnt nooit

   Geen foutmelding, geen rood, geen lege plek: de wereld tekent zichzelf gewoon
   één tegel kleiner. Dat is de ergste soort fout, want hij ziet er af uit. En
   omdat `itemZichtbaar` ook de legitieme reden is dat een tegel wegvalt (een pas
   die hem niet heeft, een gast), is er met het blote oog geen verschil tussen
   "deze tegel hoort hier niet voor jou" en "deze tegel is kapot".

   Deze toets haalt dat verschil terug: wat in het register staat, MOET ergens
   heen gaan. Wat er niet hoort te staan, hoort uit het register te worden
   gehaald -- niet stil te blijven liggen tot niemand meer weet of het opzet was.

   Wat hier NIET wordt gemeten: of een item in de JUISTE wereld staat. Dat is een
   ontwerpvraag en staat in PLATFORM.md. Hier gaat het er alleen om dat elk item
   bestaat waar het beweert te bestaan.

   Bij elke toets staat de mutatie die hem hoort te laten zakken (LAT.md regel 2). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/* DE LEZER STAAT ERNAAST EN NIET HIER. Hij stond hier wel -- het uitpakken van
   de app-main-bundel, het uitvoeren van LINKS/OSAPPS/MAPPEN -- tot
   scripts/wereldlijst.js diezelfde lijst ook moest lezen om WERELDLIJST.md te
   schrijven. Twee lezers van een lijst lopen uiteen zodra de bundel verschuift,
   en dan is niet meer te zien welke van de twee gelijk heeft (LAT.md regel 4).
   Wat er in die lezer gebeurt en waarom, staat daar. */
const reg = require('../scripts/lib/wereldregister');
const { LINKS, OSAPPS, MAPPEN, WERELDEN, APP_HTML, BRON, kaal, bestaat } = reg;

const WORTEL = path.join(__dirname, '..');
const PUB = path.join(WORTEL, 'public');

/* Elk item van elke wereld, met zijn herkomst erbij, zodat een bevinding zegt
   WAAR hij staat en niet alleen DAT er iets mis is. */
const ITEMS = [];
for (const w of WERELDEN) for (const item of w.items) ITEMS.push({ wereld: w.naam, item });

test('er is een register, en het is niet leeg', () => {
  /* DE MUTATIE: laat blok() een lege string teruggeven. Alle toetsen hieronder
     zouden dan groen worden op nul items -- een toets die niets meet is erger
     dan geen toets, want hij stelt gerust (LAT.md regel 3). */
  assert.ok(WERELDEN.length >= 1, 'er hoort minstens één wereld te zijn');
  assert.ok(ITEMS.length >= 20, 'er horen items in te staan; gevonden: ' + ITEMS.length);
  assert.ok(Object.keys(LINKS).length >= 20, 'LINKS hoort gevuld te zijn');
});

test('elk link-item in een wereld heeft een regel in LINKS', () => {
  /* DIT IS DE TOETS DIE link:bank HAD MOETEN VANGEN.

     DE MUTATIE: zet `'link:ditbestaatniet'` bij in de items van RTG. Deze toets
     hoort dat item bij naam te noemen, met de wereld erbij. */
  const zoek = ITEMS.filter((x) => x.item.startsWith('link:'))
    .filter((x) => !LINKS[x.item.slice(5)])
    .map((x) => x.wereld + ' -> ' + x.item);
  assert.deepEqual(zoek, [], 'deze items wijzen naar een LINKS-regel die niet bestaat');
});

test('elk os-item in een wereld heeft een regel in OSAPPS', () => {
  /* DE MUTATIE: zet `'os:onbekend'` bij in de items van RTFoundation. */
  const zoek = ITEMS.filter((x) => x.item.startsWith('os:'))
    .filter((x) => !OSAPPS[x.item.slice(3)])
    .map((x) => x.wereld + ' -> ' + x.item);
  assert.deepEqual(zoek, [], 'deze items wijzen naar een OSAPPS-regel die niet bestaat');
});

test('elk tab-item in een wereld heeft een knop in de tabbalk', () => {
  /* Een tab is geen pagina maar een knop in app.html; verdwijnt die knop, dan
     valt het item stil weg -- precies dezelfde stilte als bij link:bank.

     DE MUTATIE: hernoem in apps/app.html data-tab="salon" naar data-tab="salons". */
  const zoek = ITEMS.filter((x) => x.item.startsWith('tab:'))
    .filter((x) => !APP_HTML.includes('data-tab="' + x.item.slice(4) + '"'))
    .map((x) => x.wereld + ' -> ' + x.item);
  assert.deepEqual(zoek, [], 'deze tab-items hebben geen knop in apps/app.html');
});

test('elke bestemming in het register bestaat als bestand', () => {
  /* Een LINKS-regel kan bestaan en toch nergens heen gaan. Vraag- en
     hekje-deel gaan er eerst af: `/apps/geld.html#wbw` is een stand binnen een
     scherm, en het scherm is wat moet bestaan.

     DE MUTATIE: zet in LINKS de url van `juridisch` op '/apps/juridisch-oud.html'. */
  const zoek = [];
  for (const x of ITEMS) {
    if (!x.item.startsWith('link:')) continue;
    const l = LINKS[x.item.slice(5)];
    if (!l || !l.url) continue;
    const u = kaal(l.url);
    if (!u.startsWith('/')) continue;                 // een extern adres toetsen we hier niet
    if (!bestaat(u)) zoek.push(x.wereld + ' -> ' + x.item + ' -> ' + u);
  }
  assert.deepEqual(zoek, [], 'deze bestemmingen bestaan niet als bestand');
});

test('elke wereld heeft een huis, en dat huis bestaat', () => {
  /* DE MUTATIE: zet de `wereld` van RTG Kantoor op '/apps/kantoor-oud.html'. */
  const zoek = WERELDEN.filter((w) => !bestaat(kaal(w.wereld)))
    .map((w) => w.naam + ' -> ' + w.wereld);
  assert.deepEqual(zoek, [], 'deze werelden wijzen naar een huis dat niet bestaat');
});

test('geen enkel item staat in twee werelden', () => {
  /* De regel staat als zin in MAPPEN zelf ("Een app staat in precies EEN map:
     twee plekken voor hetzelfde is precies waarom je hem nergens meer vindt") en
     scripts/check.js regel 44 bewaakt hem voor apps. Hier geldt hij voor het hele
     register, inclusief tabs en os-apps.

     DE MUTATIE: zet 'link:office' bij in de items van RTG. */
  const waar = new Map();
  for (const x of ITEMS) {
    if (!waar.has(x.item)) waar.set(x.item, new Set());
    waar.get(x.item).add(x.wereld);
  }
  const dubbel = [...waar.entries()].filter(([, w]) => w.size > 1)
    .map(([i, w]) => i + ' staat in ' + [...w].join(' + '));
  assert.deepEqual(dubbel, [], 'deze items staan in meer dan één wereld');
});

test('geen wereld draagt de naam van een pas', () => {
  /* PAS EN WERELD ZIJN TWEE LOODRECHTE ASSEN (WERELDEN.md). De pas zegt wie je
     bent -- `rtg`, `lifestyle`, `business`, en `?pas=` herbouwt daarop de hele
     ledenapp. De wereld zegt waar je bent.

     Vallen die woorden samen, dan leest een lid een PLEK als een PRIJS. Een
     RTG-Pass-houder met een horecazaak hoort thuis in de wereld waar je een zaak
     bestuurt, maar zou "Business" lezen als "dat is die dure pas, niet voor mij".
     Daarom heet die wereld Concern.

     De vergelijking is op het KALE woord: "RTG Business" botst net zo hard als
     "Business", want het lid leest het tweede woord.

     EN OP DE STAM, en dat is de tweede versie van deze toets. De eerste keek
     alleen of een woord GELIJK was aan een pasnaam. Daar kwam `LifeOS`
     doorheen: `lifeos` is niet `lifestyle`, dus groen -- terwijl een lid wel
     degelijk "Life" naast een pas ziet staan die "Lifestyle" heet. Dat is de
     regel op de letter volgen en niet op de bedoeling, en een toets die dat
     toelaat is precies zo veel waard als geen toets.

     Vier tekens gedeelde kop is de grens, en die is niet willekeurig gekozen:
     `life`/`lifestyle` deelt er vier en botst, `livi`/`life` deelt er twee en
     botst niet. Onder de vier zou elke wereld die met een r begint tegen `rtg`
     aanlopen.

     DE MUTATIE (exact woord): hernoem WorkOS naar 'RTG Business'.
     DE MUTATIE (stam): hernoem LivingOS naar 'LifeOS'. */
  const PASSEN = ['rtg', 'lifestyle', 'business'];
  const KOP = 4;                                  // gedeelde kop vanaf hier botst
  const gedeeldeKop = (a, b) => {
    let n = 0;
    while (n < a.length && n < b.length && a[n] === b[n]) n++;
    return n;
  };
  const zoek = [];
  for (const w of WERELDEN) {
    const woorden = String(w.naam).toLowerCase().split(/[\s·-]+/).filter(Boolean);
    /* Het merk zelf mag vooraan staan ("RTG Kantoor"): dat is de afzender en niet
       de pas. Wat niet mag is dat de rest van de naam een pas is. */
    const rest = woorden[0] === 'rtg' ? woorden.slice(1) : woorden;
    for (const woord of rest) {
      if (PASSEN.includes(woord)) {
        zoek.push(w.naam + ' draagt de pasnaam "' + woord + '"');
        continue;
      }
      for (const pas of PASSEN) {
        if (gedeeldeKop(woord, pas) >= KOP) {
          zoek.push(w.naam + ' deelt de stam "' + woord.slice(0, gedeeldeKop(woord, pas)) +
            '" met de pas "' + pas + '"');
        }
      }
    }
    if (!rest.length && woorden[0] === 'rtg') {
      zoek.push(w.naam + ' is precies de naam van de instappas');
    }
  }
  assert.deepEqual(zoek, [], 'deze werelden dragen de naam van een pas');
});

test('geen wereld draagt de naam van een app uit de softwarecatalogus', () => {
  /* DIT GAT IS MET EEN BROWSER GEVONDEN EN NIET MET EEN GREP, en dat hoort hier
     te staan. De bank van de werktafel heeft twee kopjes -- Werelden en Software
     -- en na de hernoeming stond er `LivingOS` onder het eerste en vier regels
     lager `Living OS` onder het tweede. Dezelfde woorden, dezelfde lijst, een
     half scherm uit elkaar.

     Waarom niets dat ving: de pasnamen staan in een lijst van drie en worden
     hierboven getoetst, maar de softwarecatalogus (shared/command/catalog.js)
     staat naast MAPPEN en niemand hield ze tegen elkaar. Twee lijsten die elkaar
     niet kennen is precies waar LAT.md regel 4 over gaat.

     De vergelijking is op het KALE woord: spaties, koppeltekens en hoofdletters
     gaan eraf, want een lid leest "Living OS" en "LivingOS" als hetzelfde.
     Alleen de NAAM wordt vergeleken en niet het adres: een app die in een wereld
     hangt EN in de catalogus staat is geen fout maar het huispatroon -- de
     catalogus is ook Rahuls routeertabel (appUit), dus wie hem daaruit haalt
     sloopt "open het gastdossier". Reizen & Veilig en Gastdossier staan om die
     reden in allebei.

     DE MUTATIE: zet de catalogusnaam van /apps/living-os.html terug op
     'Living OS'. */
  const CAT = fs.readFileSync(path.join(PUB, 'shared/command/catalog.js'), 'utf8');
  /* DE LEZER STOPT BIJ HET EINDE VAN DE LIJST EN NIET BIJ `openTeller`, en dat
     is op 22 augustus 2026 gerepareerd. Het oude patroon liep door tot vlak voor
     `,openTeller` -- prima zolang daar niets tussen stond, maar de catalogus
     leidt er nu twee namen uit af (`HOOFDAPPS=APPS.slice(0,3),INSTELLINGEN=
     APPS[3]`). Het vangnet slikte die mee, en `Function` kreeg een uitdrukking
     die APPS aanriep terwijl APPS nog niet bestond: ReferenceError. De toets
     zakte dus op zijn eigen lezer en niet op een bevinding -- het ergste soort
     rood, want het zegt niets over het huis. Nu wordt de LIJST gelezen: van `[[`
     tot en met de bijbehorende `]]`. */
  const m = /var APPS=(\[\[[\s\S]*?\]\])\s*,/.exec(CAT);
  assert.ok(m, 'de APPS-lijst in shared/command/catalog.js is niet meer te lezen');
  assert.ok(!/[A-Za-z_$]\w*\s*\(/.test(m[1].replace(/'[^']*'/g, '')),
    'de gelezen APPS-lijst bevat een aanroep en is dus geen kale lijst meer');
  const APPS = Function('return (' + m[1] + ');')();
  assert.ok(APPS.length >= 4, 'de softwarecatalogus telt minder dan de vier producten die catalog.js verklaart; deze toets meet dan niets');

  const kaal = (x) => String(x).toLowerCase().replace(/[\s·-]+/g, '');
  const catNamen = new Map(APPS.map((a) => [kaal(a[0]), a[0]]));
  const zoek = WERELDEN.filter((w) => catNamen.has(kaal(w.naam)))
    .map((w) => 'de wereld ' + w.naam + ' heet hetzelfde als de app "' + catNamen.get(kaal(w.naam)) + '"');
  assert.deepEqual(zoek, [], 'deze werelden delen hun naam met een app in de bank');
});

test('elke app uit de softwarecatalogus hangt in een wereld', () => {
  /* DIT IS DE TOETS DIE DE SOFTWARE-RIJ VERVANGT.

     De bank had onder de werelden een tweede kopje, "Software", met twaalf apps
     uit shared/command/catalog.js. Negen daarvan hingen in geen enkele wereld:
     ze bestonden alleen in die rij. Zolang de rij er stond viel dat niemand op
     -- ze waren immers te zien. Nu de rij weg is, is precies dat het gevaar:
     een app die in de catalogus staat en nergens in een wereld hangt, is
     nergens meer te vinden en niemand merkt het. Dezelfde stilte als link:bank
     bovenaan dit bestand, alleen een niveau hoger.

     De catalogus mag NIET leeg: hij is ook Rahuls routeertabel (appUit) en de
     bron van werkbladtitels (titelVan). Wat hij niet meer mag zijn, is een
     tweede plek waar software woont.

     Vergelijken gaat op ADRES en niet op naam: de catalogus noemt
     /apps/reisboek.html "Gastdossier" en LINKS noemt hem "Reisboek". Het hekje
     gaat eraf, want een stand woont in hetzelfde scherm.

     DE MUTATIE: haal 'link:horeca' uit de items van WorkOS. Deze toets hoort
     dan Horeca bij naam te noemen. */
  const CAT = fs.readFileSync(path.join(PUB, 'shared/command/catalog.js'), 'utf8');
  /* DE LEZER STOPT BIJ HET EINDE VAN DE LIJST EN NIET BIJ `openTeller`, en dat
     is op 22 augustus 2026 gerepareerd. Het oude patroon liep door tot vlak voor
     `,openTeller` -- prima zolang daar niets tussen stond, maar de catalogus
     leidt er nu twee namen uit af (`HOOFDAPPS=APPS.slice(0,3),INSTELLINGEN=
     APPS[3]`). Het vangnet slikte die mee, en `Function` kreeg een uitdrukking
     die APPS aanriep terwijl APPS nog niet bestond: ReferenceError. De toets
     zakte dus op zijn eigen lezer en niet op een bevinding -- het ergste soort
     rood, want het zegt niets over het huis. Nu wordt de LIJST gelezen: van `[[`
     tot en met de bijbehorende `]]`. */
  const m = /var APPS=(\[\[[\s\S]*?\]\])\s*,/.exec(CAT);
  assert.ok(m, 'de APPS-lijst in shared/command/catalog.js is niet meer te lezen');
  assert.ok(!/[A-Za-z_$]\w*\s*\(/.test(m[1].replace(/'[^']*'/g, '')),
    'de gelezen APPS-lijst bevat een aanroep en is dus geen kale lijst meer');
  const APPS = Function('return (' + m[1] + ');')();
  assert.ok(APPS.length >= 4, 'de softwarecatalogus telt minder dan de vier producten die catalog.js verklaart; deze toets meet dan niets');

  /* Elk adres dat te BEREIKEN is, en dat is meer dan de items van een wereld.
     Deze toets telde alleen die items, en veroordeelde daarmee drie apps die
     gewoon te vinden zijn:

       - het HUIS van een wereld (`w.wereld`) stond er niet bij. WorkOS woont op
         /apps/kantoor.html; dat is geen item IN de wereld maar de wereld zelf.
       - de mappen ZONDER wereld stonden er niet bij. MAPPEN draagt naast de vier
         werelden ook Instellingen, met opzet zonder `wereld` (zie app-main.js):
         dat is RTG Core, en Core heeft in de bank een gezicht -- het
         bedieningspaneel in de voet. /apps/ik.html hangt daar gewoon in.

     De vraag die deze toets stelt is "is dit nog te vinden", en niet "staat dit
     in een wereldtegel". Een adres dat via het bedieningspaneel opengaat is
     gevonden. Wat de toets onverkort blijft vangen is het geval waarvoor hij is
     geschreven: een app die in de catalogus staat en in MAPPEN nergens voorkomt.

     DE MUTATIE: haal 'link:ik' uit de items van map-instellingen in app-main.js.
     Deze toets hoort dan INSTELLINGEN bij naam te noemen. */
  const bereikbaar = new Set();
  const uitItem = (item) => {
    if (item.startsWith('link:')) return (LINKS[item.slice(5)] || {}).url;
    if (item.startsWith('os:')) return (OSAPPS[item.slice(3)] || {}).url;
    return null;
  };
  for (const map of MAPPEN) {
    if (map.wereld) bereikbaar.add(kaal(map.wereld));
    for (const item of (map.items || [])) {
      const u = uitItem(item);
      if (u) bereikbaar.add(kaal(u));
    }
  }
  const zoek = APPS.filter((a) => !bereikbaar.has(kaal(a[1])))
    .map((a) => a[0] + ' (' + a[1] + ') staat in de catalogus maar nergens in MAPPEN');
  assert.deepEqual(zoek, [], 'deze apps zijn nergens meer te vinden');
});

test('de PREMIUM-set van de client is dezelfde suite als het register kent', () => {
  /* TWEE LIJSTEN OVER HETZELFDE, en ze kenden elkaar niet.

     De server weigert /api/member/rechterhand aan wie geen Lifestyle of
     Business heeft (routes/member/rechterhand.js). De client houdt daarnaast
     een eigen `PREMIUM`-set met veertien app-sleutels, om diezelfde apps bij
     een RTG-pas uit de mappen en uit Spotlight te houden. Zolang die twee niets
     van elkaar wisten, kon er een app bijkomen die de server weigert en de
     client toont -- een tegel die 403 geeft -- of andersom: een app die de
     client verbergt terwijl iedereen erbij mag.

     Dat is geen theorie. De register-regel bestond tot vandaag helemaal niet;
     de suite viel onder de generieke functie `member`, die rtg en gast draagt.
     Het bord zei dus dat een RTG-pas dit heeft terwijl de route 403 gaf.

     De lijst woont nu in het register (`apps` op de functie `rechterhand`) en
     deze toets legt hem naast de client. Wie er een vijftiende bij zet, zet hem
     op beide plekken of de bouw zakt.

     DE MUTATIE: haal 'cellier' uit de PREMIUM-set in app-main-24a3.js. */
  const R = require(path.join(WORTEL, 'server/functies/register'));
  const f = R.OP_ID.rechterhand;
  assert.ok(f, 'de functie `rechterhand` staat niet meer in het register');
  assert.ok(Array.isArray(f.apps) && f.apps.length >= 5,
    'de functie `rechterhand` draagt geen `apps`-lijst; deze toets meet dan niets');

  const m = /const PREMIUM = new Set\(\[([\s\S]*?)\]\)/.exec(BRON);
  assert.ok(m, 'de PREMIUM-set is niet meer te lezen uit de app-main-bundel');
  const client = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);

  assert.deepEqual([...client].sort(), [...f.apps].sort(),
    'de client en het register zijn het oneens over wat de Lifestyle-suite is\n' +
    '  client:   ' + [...client].sort().join(', ') + '\n' +
    '  register: ' + [...f.apps].sort().join(', '));

  /* En elke sleutel moet ook echt een app zijn: een naam die nergens op slaat
     verbergt niets en weigert niets, hij staat er alleen. */
  const onbekend = f.apps.filter((k) => !LINKS[k] && !OSAPPS[k]);
  assert.deepEqual(onbekend, [], 'deze premium-sleutels wijzen naar geen enkele app');
});

test('de werelden in MAPPEN zijn exact de werelden die WERELDEN.md verklaart', () => {
  /* DE KAART EN DE CODE LOPEN UIT ELKAAR ZONDER DAT IEMAND IETS MERKT, en dat is
     hier al een keer gebeurd: WERELDEN.md beschreef ROS, Concern en Fundament
     terwijl MAPPEN ROS, RTG Kantoor en RTFoundation droeg. Twee van de drie
     namen stonden alleen in het document. Een kaart die niet klopt is erger dan
     geen kaart, want er wordt naar verwezen alsof hij de waarheid is.

     De tabel in WERELDEN.md is daarom machinaal leesbaar gemaakt: naam, huis en
     het aantal onderdelen. Alle drie worden hier vergeleken met de bron. Het
     AANTAL staat er bewust bij -- een kaart die zegt dat TravelOS elf
     onderdelen heeft terwijl er nog twee bij zijn gezet, is precies zo stil
     verkeerd als een naam die niet meer bestaat.

     DE MUTATIE: verander in WERELDEN.md de regel van TravelOS naar
     `| **TravelOS** | /apps/reizen.html | ... | 12 |`. */
  const KAART = fs.readFileSync(path.join(WORTEL, 'WERELDEN.md'), 'utf8');
  const RIJ = /^\|\s*\*\*([^*|]+)\*\*\s*\|\s*`([^`|]+)`\s*\|[^|]*\|\s*(\d+)\s*\|\s*$/gm;
  const verklaard = [];
  let m;
  while ((m = RIJ.exec(KAART))) verklaard.push({ naam: m[1].trim(), huis: m[2].trim(), n: Number(m[3]) });

  assert.ok(verklaard.length >= 2,
    'de werelden-tabel in WERELDEN.md is niet meer te lezen; deze toets meet dan niets');

  const uitCode = WERELDEN.map((w) => w.naam + ' -> ' + w.wereld + ' (' + w.items.length + ')').sort();
  const uitKaart = verklaard.map((w) => w.naam + ' -> ' + w.huis + ' (' + w.n + ')').sort();
  assert.deepEqual(uitCode, uitKaart,
    'WERELDEN.md en MAPPEN zijn uit de pas gelopen\n' +
    '  code:  ' + uitCode.join('\n         ') + '\n' +
    '  kaart: ' + uitKaart.join('\n         '));
});

test('twee LINKS-regels wijzen niet naar precies hetzelfde adres', () => {
  /* Twee sleutels voor één bestemming is hetzelfde soort fout als één sleutel in
     twee werelden: welke van de twee de echte is, blijkt pas als er iets aan
     verandert en de helft meegaat.

     HET HEKJE TELT MEE, EN DAT WAS DE EERSTE VERSIE VAN DEZE TOETS FOUT. Hij
     vergeleek op het kale scherm, en meldde toen acht "duplicaten" naar
     /apps/geld.html -- terwijl dat juist het samenvoegpatroon van PLATFORM.md
     is: tien pagina's werden tien STANDEN van één scherm, elk op zijn eigen
     hash. Een toets die het huispatroon aanziet voor een fout, kost meer dan hij
     oplevert: hij leert je zijn meldingen negeren.

     DE MUTATIE: zet een tweede sleutel in LINKS met exact dezelfde url als
     `camera`, en hang hem in een wereld. */
  const inWereld = new Set(ITEMS.filter((x) => x.item.startsWith('link:')).map((x) => x.item.slice(5)));
  const perUrl = new Map();
  for (const sleutel of inWereld) {
    const l = LINKS[sleutel];
    if (!l || !l.url) continue;
    const u = String(l.url).split('?')[0];       // de hash blijft staan: die is de stand
    if (!perUrl.has(u)) perUrl.set(u, []);
    perUrl.get(u).push(sleutel);
  }
  const dubbel = [...perUrl.entries()].filter(([, s]) => s.length > 1)
    .map(([u, s]) => u + ' <- ' + s.join(', '));
  assert.deepEqual(dubbel, [], 'deze adressen hangen onder meer dan één sleutel in een wereld');
});
