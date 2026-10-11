/* Kindproces en lezer voor test/schorspoort-spelling.test.js (N26): de
   SCHRIJVENDE lagen van de router, met hun pad ZOALS ZE ZIJN OPGEHANGEN.

   app._routes() geeft dat niet: leesLagen() in server/web/routing.js haalt een
   slash aan het eind weg, zodat '/api/t/' en de wortel van een gemounte router
   (router.post('/') onder app.use('/api/x', router)) er als '/api/t' en
   '/api/x' uitkomen. Dat is de vorm van de registersleutel, en juist het
   verschil met de opgehangen vorm is wat de toets zoekt. Daarom wordt hier de
   ruwe stapel gelezen, door de mounts heen, met elk voorvoegsel apart.

   Als module: rauweLagen(stapel) leest een stapel die je zelf in handen hebt
   (de zelfijking in de toets). Als kindproces: start de echte app in dit proces
   (eigen poort, eigen datamap, net als scripts/routekaart.js), zoek de
   wortelrouter op en schrijf de lagen als JSON naar stdout. De wortelrouter van
   web() zit in een closure; hij wordt HERKEND aan zijn lagen (dezelfde
   functies in dezelfde volgorde als app._router.stack) en niet geraden. */
'use strict';
const path = require('path');

const SCHRIJFT = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/* Elke laag die een schrijvende methode aanneemt: een route met zo'n methode,
   of een .all() (methode null), die ze allemaal aanneemt. Een RegExp-pad heeft
   geen naam in het register en staat apart. */
function rauweLagen(stapel) {
  const lagen = [], regexp = [], gezien = new Set();
  (function loop(st, voor) {
    for (const l of st) {
      if (l.mount) {
        if (l.fn && Array.isArray(l.fn._stack)) loop(l.fn._stack, voor.concat(String(l.prefix)));
        continue;
      }
      if (l.method && !SCHRIJFT.has(l.method)) continue;
      const methode = l.method || 'ALL';
      if (typeof l.pad !== 'string') { regexp.push(methode + ' ' + voor.join('') + ' ' + String(l.pad)); continue; }
      const k = JSON.stringify([methode, voor, l.pad]);
      if (gezien.has(k)) continue;   // een bewaker en zijn handler zijn twee lagen met hetzelfde pad
      gezien.add(k);
      lagen.push({ methode, voorvoegsels: voor, pad: l.pad });
    }
  })(stapel, []);
  return { lagen, regexp };
}

module.exports = { rauweLagen, SCHRIJFT };

if (require.main === module) {
  const fs = require('fs');
  const os = require('os');
  const WORTEL = path.join(__dirname, '..', '..');
  if (!process.env.RTG_DATA_DIR) process.env.RTG_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schrijflagen-'));
  process.env.SMTP_URL = process.env.SMTP_URL || '';
  process.env.STUN_UIT = '1';
  const routing = require(path.join(WORTEL, 'server', 'web', 'routing.js'));
  const origMaak = routing.maakRouter;
  const ROUTERS = [];
  routing.maakRouter = function () { const r = origMaak.apply(this, arguments); ROUTERS.push(r); return r; };
  // De app praat bij het opstarten; stdout is voor de uitkomst.
  const stil = () => {};
  console.log = stil; console.warn = stil; console.info = stil; console.error = stil;
  const { app } = require(path.join(WORTEL, 'server', 'server'));
  const boven = app._router.stack;
  const wortel = ROUTERS.filter(r => r._stack.length === boven.length && r._stack.every((l, i) => l.fn === boven[i].handle));
  /* Pas stoppen als de uitvoer weg is: naar een pijp schrijft stdout
     asynchroon, en een process.exit() direct erachter kapt het JSON-antwoord
     ergens halverwege af. */
  const zeg = (o, code) => process.stdout.write(JSON.stringify(o), () => process.exit(code));
  if (wortel.length !== 1) zeg({ fout: 'wortelrouter niet eenduidig te herkennen (' + wortel.length + ' kandidaten)' }, 2);
  else zeg(rauweLagen(wortel[0]._stack), 0);
}
