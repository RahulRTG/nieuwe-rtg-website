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
   even tegen -- en we zetten het terug voordat we zelf iets zeggen. */
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
Object.assign(console, echt);

const routes = (app && typeof app._routes === 'function' ? app._routes() : [])
  .filter(r => r.pad && r.pad !== '/');

// per pad de methoden bundelen; hetzelfde pad met GET en POST is een pad
const perPad = new Map();
for (const r of routes) {
  if (!perPad.has(r.pad)) perPad.set(r.pad, new Set());
  perPad.get(r.pad).add(r.methode);
}
const lijst = [...perPad].sort((a, b) => a[0] < b[0] ? -1 : 1)
  .map(([pad, m]) => ({ pad, methoden: [...m].sort() }));

if (jsonUit) {
  process.stdout.write(JSON.stringify({ aantal: lijst.length, routes: lijst }) + '\n');
} else {
  const api = lijst.filter(r => r.pad.startsWith('/api/'));
  console.log('Routes totaal: ' + lijst.length + ', waarvan onder /api: ' + api.length);
  for (const r of api) console.log('  ' + r.methoden.join(',').padEnd(12) + r.pad);
}
process.exit(0);
