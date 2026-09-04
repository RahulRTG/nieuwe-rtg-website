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
   taxi niet meer staan. Dat is een regressie en geen migratie, en de kaart
   stond daarop een dag op nul.

   Het besluit van de eigenaar heeft die blokkade opgeheven -- de vervoerder
   kiest zelf welke soort ritten hij aanneemt, en een rit zonder bestemming
   krijgt een opdracht met een bestemming die `onbekend` heet. Wat blijft is het
   RESTRISICO: opdrachtMaak kan nog per geval weigeren. Toets 4 houdt vast dat
   dat zichtbaar blijft, want een kaart die alleen het goede nieuws draagt,
   laat de omzetting met een schoner beeld beginnen dan er is.

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

test('3. de kaart telt op, en de volgorde van het werk staat erin', () => {
  const u = M.meet();
  assert.equal(u.telling.kanNu + u.telling.daarna, u.telling.stand + u.telling.historie + u.telling.schrijver,
    'de telling van wie wanneer om kan, dekt niet alle lezers');
  assert.equal(u.telling.wachtOpBesluit, 0, 'er wacht nog iets op een besluit dat genomen is');
  /* De stand-lezers eerst en de schrijvers laatst: die laatste worden de plek
     waar de projectie ontstaat, en dat kan pas als de lezers om zijn. */
  assert.equal(u.telling.kanNu, u.telling.stand);
});

test('4. het opgeheven besluit blijft leesbaar, met het restrisico erbij', () => {
  const u = M.meet();
  assert.equal(u.blokkade.stand, 'opgeheven');
  assert.ok(u.blokkade.op, 'een opgeheven blokkade zonder datum is een bewering');
  assert.match(u.blokkade.besluit, /vervoerder kiest/i, 'het besluit zegt niet wat er is besloten');
  /* Wat een besluit oplost, lost het nooit helemaal op. Dat hoort te blijven
     staan, anders begint de omzetting met een schoner beeld dan er is. */
  assert.ok(u.restrisico && u.restrisico.wat && u.restrisico.bijOmzetting,
    'het restrisico ontbreekt; dan lijkt de weg vrijer dan hij is');
  assert.match(u.restrisico.bijOmzetting, /stil/i,
    'het restrisico zegt niet dat een rit nooit stil uit een lijst mag vallen');
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
