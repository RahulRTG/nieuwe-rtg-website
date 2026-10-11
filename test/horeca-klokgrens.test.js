/* DE KLOKGRENS -- de horecavloer leest uit het personeelsdomein precies EEN ding.

   Eigenaarsbesluit 1A (11 oktober 2026): de dragerstand op de Vloer mag de
   prikklok lezen, die van het personeelsdomein is (kern/personeel.js, gemount
   voor routes/staff). Met een begrenzing: alleen de noodzakelijke
   klokinformatie, niets anders uit dat domein. Dat besluit staat in NORM.json
   (kernGedeeld 254 -> 255); deze toets is de handhaver ervan, want een besluit
   dat niemand bewaakt groeit met de eerstvolgende handige regel.

   Drie grenzen, en elk zakt als hij breekt:
   1. van de vier dingen die kern/personeel.js levert (urenVan, klokVan,
      trustVan, scheduleFor) gebruikt de horecakant alleen klokVan, en die
      alleen in de wijkroute;
   2. van wat klokVan teruggeeft leest de afleiding alleen `open` en
      `laatsteUit` -- geen uren, geen klokregels;
   3. wat er naar de Vloer gaat is de STAND (stand, om, reden), nooit het
      antwoord van klokVan zelf. Dat laatste meet test/horeca-leen-dienst.test.js
      op een echte server.

   Draai: node --test test/horeca-klokgrens.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const lees = (r) => fs.readFileSync(path.join(WORTEL, r), 'utf8');

// wat het personeelsdomein levert, gelezen uit zijn eigen return en niet overgetypt
const personeel = lees('server/kern/personeel.js');
const levert = (personeel.match(/return \{([^}]*)\};\s*\}\s*\n\s*module\.exports/) || [])[1];
const NAMEN = String(levert || '').split(',').map((s) => s.trim()).filter(Boolean);

function horecaBestanden() {
  const uit = [];
  const loop = (map) => {
    for (const n of fs.readdirSync(path.join(WORTEL, map))) {
      const r = path.join(map, n);
      if (fs.statSync(path.join(WORTEL, r)).isDirectory()) loop(r);
      else if (n.endsWith('.js')) uit.push(r);
    }
  };
  loop('server/routes/supplier/horeca');
  loop('server/kern/horeca');
  uit.push('server/routes/supplier/horeca.js', 'server/kern/horeca.js');
  return uit;
}
// zonder commentaar, want een uitleg die het woord noemt is geen gebruik
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('1. van het personeelsdomein gebruikt de horecakant alleen klokVan, en alleen in de wijkroute', () => {
  assert.deepEqual(NAMEN.slice().sort(), ['klokVan', 'scheduleFor', 'trustVan', 'urenVan'],
    'kern/personeel.js levert iets anders dan deze toets kent: kijk opnieuw welke grens besloten is');
  const gebruik = [];
  for (const f of horecaBestanden()) {
    const t = code(lees(f));
    for (const n of NAMEN) if (new RegExp('\\b' + n + '\\b').test(t)) gebruik.push(n + ' in ' + f);
  }
  assert.deepEqual(gebruik, ['klokVan in server/routes/supplier/horeca/wijk.js'],
    'eigenaarsbesluit 1A staat alleen klokVan toe, en alleen voor de dragerstand op de Vloer');
});

test('2. de afleiding leest uit klokVan alleen open en laatsteUit', () => {
  const t = code(lees('server/kern/horeca/wijk-leen.js'));
  const lijf = (t.match(/function drager\(l, klok\) \{([\s\S]*?)\n  \}/) || [])[1];
  assert.ok(lijf, 'drager(l, klok) staat niet meer in kern/horeca/wijk-leen.js');
  const velden = [...new Set([...lijf.matchAll(/\bklok\.([A-Za-z_]+)/g)].map((m) => m[1]))].sort();
  assert.deepEqual(velden, ['laatsteUit', 'open'],
    'de dragerstand leest meer uit de prikklok dan het besluit toestaat: ' + velden.join(', '));
});

test('3. binnen het hele supplierdomein leest alleen de wijkroute klokVan', () => {
  /* klokVan staat sinds besluit 1A op de grenslijst van `supplier`, en die lijst
     geldt voor het hele domein. Dus kan elke supplierroute hem nu pakken; deze
     toets houdt het bij de ene plek waarvoor het besluit is genomen.
     (scheduleFor stond er al eerder op, voor de AI-route, en valt hier buiten.) */
  const g = JSON.parse(lees('GRENZEN.json')).domeinen.supplier;
  assert.ok(g.includes('klokVan'), 'klokVan hoort op de grenslijst van supplier te staan (besluit 1A)');
  const uit = [];
  const loop = (map) => {
    for (const n of fs.readdirSync(path.join(WORTEL, map))) {
      const r = path.join(map, n);
      if (fs.statSync(path.join(WORTEL, r)).isDirectory()) loop(r);
      else if (n.endsWith('.js') && /\bklokVan\b/.test(code(lees(r)))) uit.push(r);
    }
  };
  loop('server/routes/supplier');
  assert.deepEqual(uit, ['server/routes/supplier/horeca/wijk.js']);
});
