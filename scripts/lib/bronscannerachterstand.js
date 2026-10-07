/* ============================================================================
   HOE VER LOOPT DE BRONSCANNER ACHTER OP DE ROUTER?

   De Magnaat-scanner (server/kern/magnaat-capabilities-bronnen.js) leest de
   routes uit de BRON: hij eist dat het pad letterlijk met `/api/` begint. Een
   router die relatief registreert (`router.post('/gezin/maak')`, gemount op
   /api/foundation) ziet hij daardoor niet. test/magnaat-capabilities.test.js
   legt uit waarom dat een bekende, begrensde blinde vlek is en geen fout om
   vandaag te repareren, en houdt twee getallen vast:

     gemist  routes die de ROUTER kent en de scanner niet
     spook   routes die de scanner noemt en de router niet

   WAAROM DE TELLING HIER STAAT. Die twee getallen waren ratels als constante in
   de toets (GEMIST_MAX, SPOOK_MAX), dus buiten NORM.json en buiten het slot van
   scripts/normbasis.js. Sinds 6 oktober 2026 zijn ze de meters
   `bronscannerGemist` en `bronscannerSpook`. De toets en scripts/norm.js tellen
   allebei met deze functies, zodat er een telling is en niet twee.

   De routerkant komt uit scripts/routekaart.js, met PORT en RTG_DATA_DIR leeg
   zodat hij een eigen poort en een eigen wegwerpmap neemt -- precies zoals de
   toets hem altijd startte. Dat kost een paar seconden en start een server; wie
   het tientallen keren nodig heeft (test/meterijk.test.js), meet een keer en
   hergebruikt de uitslag zolang de bronboom niet wijzigt.
   ========================================================================== */
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..', '..');

/* De routes die de router werkelijk registreert, als `METHODE /pad`, alleen
   onder /api/. De inventaris uit server/kern/routedekking.js is de ene plek waar
   staat wat een route is (methode plus patroon); hier wordt niets opnieuw
   bedacht. */
function routerSleutels(root) {
  const wortel = root || WORTEL;
  const routedekking = require(path.join(wortel, 'server/kern/routedekking'));
  const kaart = JSON.parse(execFileSync(process.execPath,
    [path.join(wortel, 'scripts', 'routekaart.js'), '--json'],
    { cwd: wortel, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, PORT: '', RTG_DATA_DIR: '' } }));
  return new Set(routedekking.inventaris(kaart.routes).routes
    .filter(r => r.pad.startsWith('/api/'))
    .map(r => r.methode + ' ' + r.pad));
}

/* De vergelijking. `/api/test/` telt niet als spook: die routes bestaan alleen
   onder NODE_ENV=test en horen in geen enkele kaart. */
function achterstand(echt, root) {
  const bronnen = require(path.join(root || WORTEL, 'server/kern/magnaat-capabilities-bronnen'));
  const gescand = new Set(bronnen.scanEndpoints(root || WORTEL).map(e => e.sleutel));
  const gemist = [...echt].filter(s => !gescand.has(s));
  const spook = [...gescand].filter(s => !echt.has(s) && !s.includes('/api/test/'));
  return { echt: echt.size, gescand: gescand.size, gemist, spook };
}

module.exports = { routerSleutels, achterstand };
