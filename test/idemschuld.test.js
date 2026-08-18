/* DE IDEM-SCHULD MAG ALLEEN KRIMPEN.

   Er zijn 3650 schrijfroutes. De idemproef bereikte er 106 en vond er 94 waar
   een herhaling het werk nog een keer deed. Die 94 repareren voelt als
   "opgelost", maar de andere 3544 zijn niet veilig -- ze zijn ONBEKEND. En een
   onbekende die niemand telt, leest na verloop van tijd als groen.

   Daarom telt scripts/idemschuld.js hoeveel schrijfroutes nog niet hebben
   verklaard wat "hetzelfde verzoek" voor hen betekent, en houdt IDEMSCHULD.json
   dat getal vast. Deze toets bewaakt de richting: omlaag mag, omhoog niet.

   Zelfde vorm als POORTWACHT (0 routes open) en BEREIK.json (0 schermen zonder
   klikroute). Zonder zo'n teller groeit een gat stil terug.

   Draai los: node --test test/idemschuld.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');
const { alleRoutes } = require('../scripts/lib/routes');
const { SLEUTELS } = require('../server/lib/idemsleutels');
const vastgelegd = require('../IDEMSCHULD.json');

const WORTEL = path.join(__dirname, '..');

function meetNu() {
  const routes = alleRoutes().filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET');
  const schuld = routes.filter(r => !SLEUTELS[r.methode.toUpperCase() + ' ' + r.pad]);
  return { routes: routes.length, schuld: schuld.length, lijst: schuld.map(r => r.methode + ' ' + r.pad) };
}

test('de schuld is niet gegroeid sinds de laatste vastlegging', () => {
  const nu = meetNu();
  assert.ok(nu.schuld <= vastgelegd.gemeten.schuld,
    'schrijfroutes zonder idem-verklaring: ' + nu.schuld + ', vastgelegd stond ' +
    vastgelegd.gemeten.schuld + '.\nNieuw zonder verklaring:\n  ' +
    nu.lijst.filter(x => !vastgelegd.schuld.includes(x)).join('\n  ') +
    '\nZet ze in server/lib/idemsleutels.js, of leg de nieuwe stand vast met ' +
    'npm run idemschuld -- --vastleggen als de schuld is gekrompen.');
});

test('er staan geen verklaringen voor routes die niet bestaan', () => {
  const bekend = new Set(alleRoutes()
    .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET')
    .map(r => r.methode.toUpperCase() + ' ' + r.pad));
  const wees = Object.keys(SLEUTELS).filter(s => !bekend.has(s));
  assert.deepEqual(wees, [],
    'een verklaring voor een verdwenen route is geen dekking maar rommel, en hij houdt het schuldgetal kunstmatig laag');
});

test('de teller draait echt, en zakt als er een verklaring wegvalt', () => {
  /* Een teller die je nooit hebt zien bewegen, is geen teller. Deze proef draait
     het script met een lege verklaringenlijst en controleert dat de schuld dan
     gelijk is aan het aantal schrijfroutes -- dus dat hij de verklaringen
     werkelijk aftrekt in plaats van een getal op te schrijven. */
  const nu = meetNu();
  assert.equal(nu.schuld + Object.keys(SLEUTELS).length, nu.routes,
    'verklaard + schuld hoort precies het aantal schrijfroutes te zijn');
});

test('elke verklaring is een van de drie vormen, en nietIdempotent draagt een reden', () => {
  for (const [sleutel, v] of Object.entries(SLEUTELS)) {
    const vormen = [v.zelfdeVerzoek, v.velden, v.nietIdempotent].filter(Boolean).length;
    assert.equal(vormen, 1, sleutel + ' hoort precies een vorm te verklaren');
    if (v.nietIdempotent) {
      assert.ok(v.waarom && v.waarom.length > 20,
        sleutel + ': "niet idempotent" zonder reden is een ontsnapping en geen verklaring');
    }
  }
});

test('het script zelf loopt en meldt de stand', () => {
  const uit = execFileSync(process.execPath, [path.join(WORTEL, 'scripts', 'idemschuld.js')],
    { encoding: 'utf8', timeout: 60000 });
  assert.match(uit, /nog te verklaren/);
});
