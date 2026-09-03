/* DE MIGRATIEKAART VAN db.data.rides (scripts/ritmigratie.js).

   De eigenaar heeft besloten dat de OPDRACHT de waarheid is; de brug staat
   (kern/mobiliteit/appbrug.js) en de migratie van de lezers volgt. Deze kaart
   zegt per lezer wat hij uit een rit haalt en wanneer hij om kan.

   WAT DEZE TOETS BEWAAKT is niet de migratie maar de KAART: zij loopt binnen
   een maand achter op de code als niemand kijkt, en een migratiekaart die
   achterloopt stuurt het werk verkeerd. Vandaar de eis dat elke lezer is
   ingedeeld en dat er geen ingang in staat die de code niet meer kent.

   EN ÉÉN DING DAT DEZE KAART ZELF AL EEN KEER FOUT HAD. De eerste versie zei
   "zeven lezers kunnen nu om", omdat een stand-lezer alleen de lopende rit
   toont en de opdracht die rijker draagt. Wat daarbij werd overgezien: een rit
   ZONDER opdracht valt dan uit die weergave, en dan ziet een lid zijn eigen
   taxi niet meer staan. Toets 3 houdt vast dat `kanNu` nul blijft zolang de
   blokkade er is -- anders is deze kaart een uitnodiging om verkeerd te
   beginnen.

   Draai los: node --test test/ritmigratie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const M = require('../scripts/ritmigratie');

test('0. de kaart loopt gelijk met de code', () => {
  const u = M.meet();
  assert.deepEqual(u.onbekend, [],
    'een bestand leest db.data.rides en staat niet in de kaart -- deel het in, in scripts/ritmigratie.js');
  assert.deepEqual(u.verdwenen, [],
    'de kaart noemt een bestand dat db.data.rides niet meer leest -- haal het eruit');
});

test('1. elke lezer heeft een soort, en die soort is een van de drie', () => {
  for (const [rel, l] of Object.entries(M.LEZERS)) {
    assert.ok(['schrijver', 'stand', 'historie'].includes(l.soort), rel + ': onbekende soort');
    assert.ok(l.wat && l.wat.length > 15, rel + ': zegt niet wat hij leest');
    assert.ok(l.naOmzetting && l.naOmzetting.length > 15, rel + ': zegt niet wat er na de omzetting gebeurt');
  }
});

test('2. elke plek in de kaart bestaat ook echt', () => {
  for (const rel of Object.keys(M.LEZERS).concat(Object.keys(M.GEEN_LEZER)))
    assert.ok(fs.existsSync(path.join(WORTEL, rel)), rel + ' bestaat niet');
});

test('3. zolang de blokkade er is, kan geen enkele lezer om', () => {
  const u = M.meet();
  assert.ok(u.blokkade && u.blokkade.besluit, 'de blokkade en het bijbehorende besluit ontbreken');
  assert.equal(u.telling.kanNu, 0,
    'de kaart zegt dat er lezers om kunnen terwijl er ritten zonder opdracht bestaan -- ' +
    'dan valt zo\'n rit uit beeld, en dat is een regressie en geen migratie');
  assert.equal(u.telling.wachtOpBesluit, u.telling.stand + u.telling.historie);
});

test('4. de blokkade noemt een besluit en geen bouwopdracht', () => {
  const u = M.meet();
  /* Het verschil is niet cosmetisch: een bouwopdracht zou hier gewoon worden
     uitgevoerd. Dit is een keuze over wat een rit zonder bestemming IS, en die
     hoort bij de eigenaar. */
  assert.match(u.blokkade.besluit, /eigenaar/i, 'het besluit zegt niet wie het neemt');
  assert.ok(u.blokkade.besluit.includes('of'), 'een besluit zonder alternatief is geen besluit maar een mening');
  assert.match(u.blokkade.gevolg, /GEEN ENKELE lezer/,
    'het gevolg verzwijgt dat ook de stand-lezers geblokkeerd zijn');
});

test('5. de kaart oordeelt over de code en niet andersom', () => {
  /* Deze kaart mag nooit door de server worden ingeladen: dan zou een oordeel
     over een migratie meebeslissen in het product. Zelfde grens als
     scripts/gezagsnoemer.js, die daarom in scripts/ woont. */
  const uitServer = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      if (fs.statSync(p).isDirectory()) { if (naam !== 'node_modules' && naam !== 'data') loop(p); continue; }
      if (!naam.endsWith('.js')) continue;
      if (/require\(.*ritmigratie/.test(fs.readFileSync(p, 'utf8')))
        uitServer.push(path.relative(WORTEL, p));
    }
  })(path.join(WORTEL, 'server'));
  assert.deepEqual(uitServer, [], 'server-code laadt de migratiekaart in');
});

test('6. het register bestaat en klopt met een verse meting', () => {
  const pad = path.join(WORTEL, 'RITMIGRATIE.json');
  assert.ok(fs.existsSync(pad), 'RITMIGRATIE.json ontbreekt -- draai: npm run ritmigratie:vast');
  const j = JSON.parse(fs.readFileSync(pad, 'utf8'));
  const u = M.meet();
  assert.equal(j.telling.bestanden, u.telling.bestanden,
    'het register loopt achter op de code -- draai npm run ritmigratie:vast');
  assert.equal(j.telling.kanNu, u.telling.kanNu);
});
