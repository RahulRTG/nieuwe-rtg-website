/* De routekaart: alle paden die de server ECHT registreert.

   Waarom dit bestaat. De blindevlek-toets wil weten of een pad dat een pagina
   aanroept ook werkelijk bestaat. Dat uit de broncode aflezen kan niet eerlijk:
   routes worden op drie manieren opgehangen, en de derde is een hulpje dat het
   pad zelf samenstelt --

     app.post('/api/ik/zet', ...)                        letterlijk
     app.use('/api/foundation', router)                  router met voorvoegsel
     mount('/api/supplier/kantoorpakket', ...)           voorvoegsel-hulpje
     p('/notitie', ...)                                  hulpje in een hulpje

   Een scanner die de broncode leest ziet de laatste twee niet en meldt honderden
   kloppende paden als kapot. Dus vragen we het aan de server zelf: we starten de
   app in dit proces en lezen de router uit (app._routes(), web/routing.js).

   Draai: node --experimental-sqlite scripts/routekaart.js
          node --experimental-sqlite scripts/routekaart.js --json
   Zet de app op een vrije poort en in een tijdelijke datamap, zodat dit nooit
   aan een echte installatie zit. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const jsonUit = process.argv.includes('--json');

/* Eigen poort en eigen datamap: dit gereedschap mag niets raken. Poort 0 (de
   nette "geef me maar wat") kan hier niet: de configuratiecontrole keurt hem af
   en dat geeft een luide waarschuwing in de uitvoer. Dus een hoge, vrijwel
   zeker vrije poort. Er komt sowieso niemand op af. */
if (!process.env.PORT) process.env.PORT = String(28000 + Math.floor(Math.random() * 20000));
if (!process.env.RTG_DATA_DIR) {
  process.env.RTG_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-routekaart-'));
}
process.env.SMTP_URL = process.env.SMTP_URL || '';
process.env.STUN_UIT = '1';

/* De app schrijft bij het opstarten van alles naar de console. Dat hoort niet
   in de uitvoer van een gereedschap dat JSON teruggeeft, dus we houden het
   tegen.

   EN WEL VOOR DE HELE RIT. Hier stond `Object.assign(console, echt)` meteen na
   het laden, "voordat we zelf iets zeggen". Maar een deel van het opstarten is
   ASYNCHROON: de listen-callback meldt "Live updates (SSE) actief" pas als de
   poort openstaat, en dat is na de herstelregel. Die zin belandde dus achter de
   JSON, en een lezer kreeg "Unexpected non-whitespace character after JSON".

   Dat viel jarenlang niet op omdat process.exit(0) er direct achteraan kwam en
   die regels afkapte -- twee fouten die elkaar toedekten. Nu zwijgt de console
   in JSON-stand tot het eind, en gaat onze eigen uitvoer via
   process.stdout.write eromheen. */
const stil = () => {};
const echt = { log: console.log, warn: console.warn, info: console.info, error: console.error };
if (jsonUit) { console.log = stil; console.warn = stil; console.info = stil; }

let app;
try {
  app = require('../server/server').app;
} catch (e) {
  Object.assign(console, echt);
  console.error('kon de server niet laden: ' + (e && e.message));
  process.exit(2);
}
if (!jsonUit) Object.assign(console, echt);

/* DE VOORDEUR HOORT ERBIJ. Hier stond `.filter(r => r.pad && r.pad !== '/')`, en
   dat knipte precies EEN route weg: `GET /`, de meest bezochte pagina van het
   huis (middleware/voordeur.js hangt hem op). Zolang deze kaart alleen werd
   gebruikt om te kijken of een /api-pad bestond, viel dat niemand op.

   Sinds de dekkingsmeting ALLE routes meet, viel het meteen op -- van de
   verkeerde kant: het journaal noteerde `GET /` als geraakt, de kaart kende hem
   niet, en de meting meldde hem als drift tussen router en kaart. Dat is de
   melding die precies goed werkte, en het antwoord erop is niet de melding
   dempen maar de kaart compleet maken.

   Waarom dit veilig is voor de andere lezers: die filteren allemaal zelf op
   /api/ (poortwacht, samenhang, bewijsmatrix, grens-sweep) of gebruiken de lijst
   als verzameling BEKENDE paden (blindevlek), en daar hoort de voordeur in. */
const routes = (app && typeof app._routes === 'function' ? app._routes() : [])
  .filter(r => r.pad);

/* DE BEWAKERS ERBIJ, want dit is de plek waar de routekaart wordt gemaakt.

   Waarom dat hier hoort en niet bij de lezers: wie een route wil beproeven moet
   weten welke rol de JUISTE is, anders bewijst aankloppen niets over scheiding.
   Dat werd tot nu toe geraden met een regex over de brontekst
   (scripts/lib/routes.js), en zo'n regex ziet niet wat via
   app.use('/api/foundation', router) of een voorvoegsel-hulpje hangt. Vier
   bewijsproeven misten daardoor alle vier exact dezelfde 1257 routes.

   De afleiding zelf (laatste laag = handler, de rest = bewaker) staat in
   server/kern/routedekking.js en NIET hier -- dat is een feit over deze router en
   het hoort op een plek te staan (LAT.md regel 4). Dit script vraagt het daar op
   en zet het in de uitvoer. */
const routedekking = require(path.join(__dirname, '..', 'server', 'kern', 'routedekking'));
const bewakersVan = new Map();
for (const r of routedekking.inventaris(routes).routes) {
  bewakersVan.set(r.methode + ' ' + r.pad, r.bewakers);
}

// per pad de methoden bundelen; hetzelfde pad met GET en POST is een pad
const perPad = new Map();
for (const r of routes) {
  if (!perPad.has(r.pad)) perPad.set(r.pad, new Set());
  perPad.get(r.pad).add(r.methode);
}
const lijst = [...perPad].sort((a, b) => a[0] < b[0] ? -1 : 1)
  .map(([pad, m]) => {
    const methoden = [...m].sort();
    /* Per methode een eigen bewakerslijst: op /api/office/papieren hangt GET
       anders dan POST kan hangen, en dat verschil mag niet platgeslagen worden.
       null blijft null -- onbekend is geen leeg lijstje (LAT.md regel 3). */
    const bewakers = {};
    for (const mm of methoden) {
      const b = bewakersVan.get(routedekking.normaalMethode(mm) + ' ' + pad);
      bewakers[mm] = b === undefined ? null : b;
    }
    return { pad, methoden, bewakers };
  });

/* AFSLUITEN MAG PAS ALS DE UITVOER DE DEUR UIT IS.

   Hier stond `process.exit(0)` direct achter de write, en dat is stil kapot: naar
   een PIJP schrijft Node asynchroon, en process.exit() gooit weg wat er nog in
   de wachtrij staat. Naar een terminal gaat het wel goed -- daar is de write
   synchroon -- dus met de hand zag je er nooit iets van.

   Zo kwam het aan het licht: tijdens het ijken van endpointsZonderTest werden er
   honderd routes bijgeplakt. De kaart groeide van 143 naar 146 kilobyte, en
   scripts/keuring.js kreeg "Unexpected end of JSON input" terug. Die vangt dat
   netjes op met "de dekking is niet gemeten" -- en dan staan endpointsZonderTest
   en dekkingPct op NUL. Nul is voor allebei de mooiste stand die er is.

   Dus: twee RATELTANDEN sloegen om in hun beste waarde omdat een pijp vol liep.
   Dat had bij de volgende paar honderd routes vanzelf gebeurd, zonder ijking en
   zonder dat iemand het zag. De write-callback vuurt pas als alles is
   weggeschreven; de vangnet-timer is voor het geval de lezer niets ophaalt.

   EN DE CALLBACK MOET AAN DE ECHTE WRITE HANGEN. De eerste reparatie zette er
   een lege `write('', stoppen)` achteraan als vaandeldrager; die callback vuurt
   meteen, want een lege brok wordt niet in de wachtrij gezet. Het cijfer bleef
   nul. Dus gaat ALLE uitvoer nu door een enkele write, en die write draagt de
   callback zelf. */
function schrijfEnStop(tekst, code) {
  const stoppen = () => process.exit(code);
  setTimeout(stoppen, 10000).unref();
  process.stdout.write(tekst, stoppen);
}

if (jsonUit) {
  schrijfEnStop(JSON.stringify({ aantal: lijst.length, routes: lijst }) + '\n', 0);
} else {
  const api = lijst.filter(r => r.pad.startsWith('/api/'));
  schrijfEnStop('Routes totaal: ' + lijst.length + ', waarvan onder /api: ' + api.length + '\n' +
    api.map(r => '  ' + r.methoden.join(',').padEnd(12) + r.pad).join('\n') + '\n', 0);
}
