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
      `laatsteUitklok` -- geen uren, geen klokregels;
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

test('2. de afleiding leest uit klokVan alleen open en laatsteUitklok, en geeft de juiste stand', () => {
  /* Op de LOOPTIJD gemeten en niet op de bron: een Proxy over het echte antwoord
     van klokVan legt vast welke velden de afleiding werkelijk aanraakt. Naast
     elke lezing staat de stand die eruit hoort te komen, zodat een afleiding die
     minder leest maar verkeerd beslist hier ook zakt. */
  const leen = require('../server/kern/horeca/wijk-leen')({ horeca: { nu: () => new Date().toISOString() }, schoon: (t) => String(t) });
  const boek = [];
  const { klokVan } = require('../server/kern/personeel').maakPersoneel({ db: { data: { klok: { Z: boek }, trustLine: [] } }, accounts: {}, afwezigOp: () => null });
  const gelezen = new Set();
  const bespied = (o) => new Proxy(o, { get(d, k) { if (typeof k === 'string') gelezen.add(k); return d[k]; } });
  const l = { staffId: '7', naam: 'Bram', at: '2026-10-11T20:00:00.000Z' };
  const geval = (regels, verwacht) => {
    boek.length = 0; boek.push(...regels);
    assert.equal(leen.drager(l, bespied(klokVan('Z', '7'))).stand, verwacht, JSON.stringify(regels));
  };
  geval([{ staffId: 7, in: '2026-10-11T18:00:00.000Z', out: null }], 'ingeklokt');
  geval([{ staffId: 7, in: '2026-10-11T18:00:00.000Z', out: '2026-10-11T23:00:00.000Z' }], 'uitgeklokt');
  geval([{ staffId: 7, in: '2026-10-11T17:00:00.000Z', out: '2026-10-11T19:00:00.000Z' }], 'niet-gemeten');
  geval([], 'niet-gemeten');
  assert.deepEqual([...gelezen].sort(), ['laatsteUitklok', 'open'],
    'de dragerstand leest meer uit de prikklok dan besluit 1A toestaat: ' + [...gelezen].join(', '));
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

test('4. de horecakant leest het klokboek niet op een NIEUWE plek rechtstreeks', () => {
  /* Drie plekken lazen db.data.klok al voordat besluit 1A er was (de wie-is-er-
     lijsten van Invisible Arrival, Spatial Command en de vloermissies). Die
     staan hier als BESTAAND en zijn een ratel: de lijst mag korter worden,
     nooit langer. Een nieuwe lezing -- rechtstreeks, met een opgebouwde naam
     (`'klok' + ...`) of via kern[...] -- hoort langs klokVan en het besluit. */
  const BESTAAND = ['server/routes/supplier/horeca/invisible-arrival.js',
    'server/routes/supplier/horeca/spatial-command.js', 'server/routes/supplier/pda/vloer-missies.js'];
  const uit = [];
  const loop = (map) => {
    for (const n of fs.readdirSync(path.join(WORTEL, map))) {
      const r = path.join(map, n);
      if (fs.statSync(path.join(WORTEL, r)).isDirectory()) loop(r);
      else if (n.endsWith('.js') && /data\.klok\b|['"]klok['"]\s*\+|\bkern\[/.test(code(lees(r)))) uit.push(r);
    }
  };
  for (const m of ['server/routes/supplier/horeca', 'server/kern/horeca', 'server/routes/supplier/pda']) loop(m);
  for (const f of ['server/routes/supplier/horeca.js', 'server/kern/horeca.js'])
    if (/data\.klok\b|['"]klok['"]\s*\+|\bkern\[/.test(code(lees(f)))) uit.push(f);
  assert.deepEqual(uit.filter((f) => !BESTAAND.includes(f)), [],
    'een nieuwe rechtstreekse lezing van het klokboek aan de horecakant, buiten besluit 1A om');
});

test('5. klokVan zet geen veld dat een bestaande lezer al anders gebruikt', () => {
  /* routes/staff/collega.js spreidt klokVan() over zijn eigen rij heen. Een veld
     uit klokVan met dezelfde naam als een van die van de rij overschrijft dus
     stil wat het kantoorscherm toont -- de tegenlezing vond precies dat met
     `laatsteUit` (een manager zag "uit gisteren" bij wie nu binnen is). */
  const boek = [{ staffId: 1, in: '2026-10-11T08:00:00.000Z', out: null }];
  const { klokVan } = require('../server/kern/personeel').maakPersoneel({ db: { data: { klok: { Z: boek }, trustLine: [] } }, accounts: {}, afwezigOp: () => null });
  const rij = (code(lees('server/routes/staff/collega.js')).match(/return \{([\s\S]*?)\.\.\.klokVan\(/) || [])[1];
  assert.ok(rij, 'routes/staff/collega.js spreidt klokVan() niet meer zoals deze toets aanneemt');
  const eigen = [...rij.matchAll(/\b([A-Za-z]+)\s*:/g)].map((m) => m[1]);
  assert.deepEqual(Object.keys(klokVan('Z', 1)).filter((k) => eigen.includes(k)), []);
});
