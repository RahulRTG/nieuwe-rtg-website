/* Elke route die de server aanbiedt -- uit de ROUTER, niet uit de bron.

   WAT HIER STOND, EN WAAROM HET WEG IS

   De kop van dit bestand begon met: "uit de BRON gelezen. Waarom uit de bron en
   niet uit een draaiende server: express geeft zijn routetabel niet betrouwbaar
   prijs zodra er routers en mounts in het spel zijn." Dat was waar voor express,
   en het is niet waar voor deze server: web/routing.js loopt zijn eigen mounts na
   en scripts/routekaart.js drukt de volledige kaart af (app._routes()).

   Die ene achterhaalde zin heeft veel gekost. Een regex over server/**.js ziet
   niet wat via `app.use('/api/foundation', router)` of een voorvoegsel-hulpje
   hangt, en de bewakers achter zo'n route al helemaal niet. Gemeten: deze functie
   gaf 2934 routes waar de router er 4191 heeft. De vier bewijsproeven (rol,
   idempotentie, invoer, staat) leunen alle vier op deze lijst en misten daardoor
   alle vier EXACT dezelfde 1257 routes -- waaronder alle 281 van de RTFoundation.
   Vier gaten, een oorzaak, en die oorzaak was deze scanner.

   DE NIEUWE VERDELING VAN TAKEN

     de ROUTER bepaalt WAT er bestaat        (pad, methode, bewakers)
     de BRON voegt toe WAAR het staat        (bestand, regel)

   En dat tweede kan MISLUKKEN zonder dat er iets verdwijnt. Een route waarvan de
   bron niet te vinden is, krijgt `bestand: null` en blijft gewoon in de lijst.
   Precies dat was de fout: de vindbaarheid van een route in de brontekst besliste
   over zijn BESTAAN, en wat niet bestaat wordt ook niet beproefd.

   BEWAKERS KOMEN NU UIT DE ROUTER. Een route is daar een laag per middleware;
   de laatste is de handler, de rest zijn bewakers (de afleiding staat in
   server/kern/routedekking.js). `bewakersBekend: false` betekent dat de router er
   niets over kon zeggen -- niet dat er geen bewaker is. 578 routes van dit huis
   hebben werkelijk geen bewakerslaag omdat ze in de handler een capability-token
   controleren (foundation/onderwijs); die krijgen een leeg lijstje EN
   bewakersBekend: true, want dat is een meting en geen leemte.

   Afnemers, en die horen dezelfde lijst te zien: scripts/onbetreden.js,
   scripts/kaart.js, scripts/bewijsmatrix.js, de vier *proef-route.js-scripts en
   de trede "de dwaler" in scripts/ladder/beveiliging.js. Zou elk zijn eigen
   scanner hebben, dan lopen ze uiteen -- de dubbele-waarheid-fout die in deze
   codebase al vaker duur was (LAT.md regel 4). Dat er ondanks deze module nog
   drie privé-scanners bestaan (beproeving.js, tot-crash.js, schakelbaar.js) is
   bekende schuld; keuringsregel 49 houdt bij dat er geen vierde bij komt. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
/* Wat voor SOORT deur elke bewaker is. Eén kaart voor het hele huis; zie de kop
   van dat bestand voor waarom dat er zeven soorten zijn en niet één. */
const bewakerskaart = require('./bewakers.js');

const WORTEL = path.join(__dirname, '..', '..');

function loopMap(map, filter, doe) {
  for (const naam of fs.readdirSync(map)) {
    const p = path.join(map, naam);
    let st; try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) {
      if (/^(node_modules|\.git|data|dist)$/.test(naam)) continue;
      loopMap(p, filter, doe);
    } else if (filter.test(naam)) doe(p);
  }
}

/* ---- WAT ER BESTAAT: de routekaart uit de levende router ----
   In een kindproces, want het start de app. Eenmaal per proces bewaard: twee
   afnemers vragen hem twee keer (bewijsmatrix.js) en dat hoeft niet twee keer
   een server te kosten. */
let _kaart = null;
function routekaart() {
  if (_kaart) return _kaart;
  let uit;
  try {
    uit = execFileSync(process.execPath,
      ['--experimental-sqlite', path.join(WORTEL, 'scripts', 'routekaart.js'), '--json'],
      { cwd: WORTEL, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: '', RTG_DATA_DIR: '' } });
  } catch (e) {
    /* DE REDEN MEE NAAR BOVEN. Hier stond stderr op 'ignore', en toen dit
       kindproces een keer omviel tijdens de volle suite las de toets alleen
       "Command failed: node ... routekaart.js --json". Dat is geen bevinding
       maar een raadsel: je weet niet of de app niet startte, of de poort bezet
       was, of het geheugen op was. Een meter die zakt hoort te zeggen waarom
       (LAT.md regel 3), en dat kost hier een pipe en vier regels. */
    const fout = new Error('de routekaart kon niet worden opgehaald: ' + e.message +
      (e.status != null ? ' (afsluitcode ' + e.status + ')' : '') +
      (e.signal ? ' (signaal ' + e.signal + ')' : '') +
      '\n--- stderr van het kindproces ---\n' +
      (String(e.stderr || '').trim().slice(-4000) || '(leeg -- het kind heeft niets gezegd)'));
    fout.oorzaak = e;
    throw fout;
  }
  _kaart = JSON.parse(uit);
  if (!Array.isArray(_kaart.routes) || _kaart.routes.length < 100) {
    /* Een halve kaart is erger dan geen kaart: dan meten vier proeven een
       deelverzameling en noemen dat een ronde (LAT.md regel 3). */
    throw new Error('de routekaart gaf maar ' + ((_kaart.routes || []).length) +
      ' paden terug; dat is geen kaart. Draai `node --experimental-sqlite scripts/routekaart.js` met de hand.');
  }
  return _kaart;
}

/* ---- WAAR HET STAAT: de bron, als verrijking ----
   Dezelfde uitdrukking als voorheen, maar hij beslist niets meer over bestaan.
   Twee ingangen: op het volle pad (een route die letterlijk zo in de bron staat)
   en op de STAART (een route op een sub-router staat daar met zijn pad binnen de
   mount: `/les/maak` voor `/api/foundation/les/maak`). Die tweede accepteren we
   alleen bij precies EEN treffer -- een verkeerd toegewezen bronbestand is erger
   dan geen bronbestand, want dan wijst een melding je naar het verkeerde bestand. */
const ROUTE_RE = /\b(app|router)\.(post|get|put|delete|patch)\(\s*(['"`])([^'"`]+)\3([^\n]*)/g;

let _bron = null;
function bronIndex() {
  if (_bron) return _bron;
  const exact = new Map();
  const perStaart = new Map();
  loopMap(path.join(WORTEL, 'server'), /\.js$/, f => {
    const tekst = fs.readFileSync(f, 'utf8');
    let m;
    ROUTE_RE.lastIndex = 0;
    while ((m = ROUTE_RE.exec(tekst))) {
      const pad = m[4];
      if (!pad.startsWith('/')) continue;
      const plek = {
        bestand: path.relative(WORTEL, f).replace(/\\/g, '/'),
        regel: tekst.slice(0, m.index).split('\n').length,
        viaRouter: m[1] === 'router',
        rauw: (m[5] || '').trim().slice(0, 160)
      };
      const sleutel = m[2].toUpperCase() + ' ' + pad;
      if (!exact.has(sleutel)) exact.set(sleutel, plek);
      const lijst = perStaart.get(sleutel) || [];
      lijst.push(plek);
      perStaart.set(sleutel, lijst);
    }
  });
  _bron = { exact, perStaart };
  return _bron;
}

function plekVan(methode, pad) {
  const { exact, perStaart } = bronIndex();
  const heel = exact.get(methode + ' ' + pad);
  if (heel) return heel;
  /* De staart: loop de padgrenzen af van lang naar kort, en neem de eerste
     lengte die precies EEN kandidaat heeft. */
  const delen = pad.split('/');
  for (let i = 1; i < delen.length; i++) {
    const staart = '/' + delen.slice(i).join('/');
    const kandidaten = perStaart.get(methode + ' ' + staart);
    if (kandidaten && kandidaten.length === 1) return kandidaten[0];
  }
  return null;
}

function alleRoutes() {
  const kaart = routekaart();
  const uit = [];
  for (const r of kaart.routes) {
    for (const methode of (r.methoden || [])) {
      const bew = r.bewakers ? r.bewakers[methode] : null;
      const plek = plekVan(methode, r.pad);
      uit.push({
        methode,
        pad: r.pad,
        bewakers: Array.isArray(bew) ? bew : [],
        // onbekend is geen leeg lijstje: zie de kop
        bewakersBekend: Array.isArray(bew),
        viaRouter: plek ? plek.viaRouter : null,
        bestand: plek ? plek.bestand : null,
        regel: plek ? plek.regel : null,
        rauw: plek ? plek.rauw : ''
      });
    }
  }
  return uit.sort((a, b) => a.pad === b.pad ? a.methode.localeCompare(b.methode) : a.pad.localeCompare(b.pad));
}

/* ---- DE ROL VAN EEN ROUTE, en wat er gebeurt als die niet te bepalen is ----

   Deze functie stond WOORDELIJK VIER KEER: in rolproef-route.js,
   idemproef-route.js, invoerproef-route.js en staatproef-route.js. Vier kopieen
   van "welke rol hoort bij deze route" lopen uiteen zodra er een bewaker bij komt,
   en dan meten vier proeven verschillende verzamelingen zonder dat iets klaagt
   (LAT.md regel 4).

   Hij geeft null als hij het niet weet, en dat is met opzet: met de JUISTE rol
   aankloppen bewijst niets over scheiding, dus gokken is erger dan niet meten.
   Maar het STIL overslaan was de andere fout -- alle vier de proeven deden
   `.filter(r => r.rol)` en daarmee verdwenen 937 routes uit het zicht zonder dat
   er ergens een getal omhoog ging. Een meter zonder invoer hoort te zakken, niet
   te zwijgen (LAT.md regel 3). Daarom hoort bij null altijd een REDEN, en
   verdeelOpRol() hieronder geeft die redenen geteld terug zodat elke proef ze in
   zijn register kan zetten.

   HIJ BESLIST HIER NIET MEER ZELF. De regexjes die hier stonden kenden drie
   namen en zetten 359 routes weg onder "bewaker zonder bekende rol". Die zin
   belooft het verkeerde -- hij leest als "er ontbreekt een token" -- terwijl er
   in werkelijkheid VIJF groepen achter zaten die om vijf verschillende
   reparaties vragen. Bij één ervan (138 routes) was er niets te repareren: die
   waren al te kruisen en werden alleen niet herkend. Bij de andere vier is
   rollen kruisen simpelweg de verkeerde vraag, en ze toch kruisen zou groen
   opleveren dat niets bewijst. Welke soort een deur is, staat nu uitputtend in
   scripts/lib/bewakers.js en wordt daar bewaakt door een toets. Hier alleen nog
   de doorgeefluiken, want vier proeven en twee toetsen roepen deze namen aan. */
function rolVan(bewakers) {
  return bewakerskaart.beoordeel({ bewakersBekend: true, bewakers: bewakers || [] }).rol;
}

/* De reden waarom een rol niet te bepalen valt. Zie bewakers.js: de reden bepaalt
   de reparatie, en "ongemeten" op een hoop is precies hoe 1257 routes jarenlang
   onzichtbaar bleven. */
function redenZonderRol(r) {
  return bewakerskaart.beoordeel(r).reden ||
    'geen reden -- deze route heeft wel degelijk een rol (' + rolVan(r.bewakers) + ')';
}

/* Splitst een routelijst in wat beproefbaar is en wat niet, met de redenen
   geteld. De proeven printen dat en zetten het in hun uitslagbestand; zo staat er
   naast "2934 beproefd" altijd "en 937 niet, en hierom". */
function verdeelOpRol(routes, beschikbareRollen) {
  const metRol = [];
  const zonderRol = [];
  const redenen = new Map();
  /* WELKE ROLLEN HEEFT DIT INSTRUMENT WERKELIJK EEN TOKEN VOOR?

     Zonder deze grens ging het mis, en stil. Sinds de bewakerskaart ook
     EIGENROLLEN kent (boardroom, techniek, scim, werkplekbaas) kwamen 123 routes
     als "met rol" uit deze functie -- terwijl de proeven alleen een token hebben
     voor member, office en supplier. tokenVoor('boardroom') gaf undefined, de
     route werd zonder token aangeroepen, kreeg 401, en dat telde als "geweigerd
     en er bleef niets staan": ROLLBACK bewezen. Natuurlijk bleef er niets staan
     -- er was geen sleutel. Een meting zonder invoer die toch een cijfer geeft
     (LAT.md regel 3).

     Wie geen lijst meegeeft krijgt het oude gedrag, want twee van de vier
     proeven kruisen rollen en hebben deze grens niet nodig: daar is een rol
     waarvoor je GEEN token hebt geen probleem maar juist het geval dat je wilt
     beproeven. */
  const beschikbaar = Array.isArray(beschikbareRollen) ? new Set(beschikbareRollen) : null;
  for (const r of routes) {
    const rol = rolVan(r.bewakers);
    if (rol && (!beschikbaar || beschikbaar.has(rol))) {
      /* `methode` EN NIET `method`. Hier stond de enige plek in dit huis waar een
         route halverwege de pijplijn van veldnaam wisselde: alleRoutes() geeft
         `methode`, verdeelOpRol() gaf `method`, en vijf instrumenten vertaalden
         hem bij het wegschrijven weer terug. Een nieuw instrument dat r.methode
         las kreeg `undefined` in zijn register, en dat viel pas op omdat de
         sleutels "undefined /api/bank/advies" gingen heten (LAT.md regel 4). */
      metRol.push({ methode: r.methode, pad: r.pad, rol });
      continue;
    }
    if (rol) {
      const reden = 'rol "' + rol + '", maar dit instrument heeft daar geen token voor; ' +
        'zonder sleutel aankloppen meet niets over deze route';
      zonderRol.push({ methode: r.methode, pad: r.pad, reden });
      redenen.set(reden, (redenen.get(reden) || 0) + 1);
      continue;
    }
    const reden = redenZonderRol(r);
    zonderRol.push({ methode: r.methode, pad: r.pad, reden });
    redenen.set(reden, (redenen.get(reden) || 0) + 1);
  }
  return { metRol, zonderRol,
    redenen: [...redenen].sort((a, b) => b[1] - a[1]).map(([reden, aantal]) => ({ reden, aantal })) };
}

/* Wat elke proef op het scherm zet over de routes die hij NIET kon beproeven.
   Een plek, zodat de vier proeven het niet elk anders formuleren. */
function meldZonderRol(verdeling) {
  if (!verdeling.zonderRol.length) return;
  console.log('  niet beproefbaar (geen rol te bepalen) : ' + verdeling.zonderRol.length);
  for (const { reden, aantal } of verdeling.redenen) {
    console.log('     ' + String(aantal).padStart(4) + '  ' + reden);
  }
}

/* DE GROTE HENDEL. De platformbrede schakelkast zet functies aan en uit voor de
   HELE server. Een proef die daar rommel heen stuurt, zet onderweg iets uit en
   meet daarna een platform dat hij zelf half heeft afgebroken -- elke bevinding
   erna is dan een gevolg van de proef en niet van de code.

   Deze lijst stond in scripts/beproeving.js en had de invoerproef net zo hard
   nodig. Twee kopieen van "wat mag je niet omzetten" lopen uiteen, en de eerste
   die achterloopt vergiftigt stil een hele ronde (LAT.md, regel 4). */
const SCHAKELPADEN = [
  '/api/office/boardroom/alles', '/api/office/boardroom/fase', '/api/office/boardroom/functie',
  '/api/office/boardroom/functie/zet', '/api/office/leveranciers', '/api/office/geld'
];
const isSchakel = (pad) => SCHAKELPADEN.some(p => String(pad || '').startsWith(p));

module.exports = { alleRoutes, WORTEL, loopMap, SCHAKELPADEN, isSchakel,
  rolVan, redenZonderRol, verdeelOpRol, meldZonderRol, bewakerskaart };
