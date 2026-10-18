/* DE VOORRAADPROEF -- het instrument, niet de keten.

   scripts/voorraadproef.js loopt de keten `voorraad-ontvangst` af tegen een
   wegwerpserver en duurt daar een halve minuut; dit bestand bewaakt dat het
   instrument eerlijk blijft en dat zijn register bij de keten hoort.

   Draai los: node --test test/voorraadproef.test.js
   De keten zelf: npm run voorraadproef */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'voorraadproef.js'), 'utf8');
const lees = (n) => JSON.parse(fs.readFileSync(path.join(WORTEL, n), 'utf8'));

test('0. de proef zakt op een open schakel en op een gebroken storing', () => {
  assert.match(bron, /uit\.sluit = .*t\.open === 0 && t\.stuk === 0 && t\.gebroken === 0 && t\.openBekend === 0/);
  assert.match(bron, /uit\.sluitMetBevinding =/);
  assert.match(bron, /process\.exit\(u\.sluitMetBevinding \? 0 : 1\)/);
});

test('1. een wegwerpserver met de groothandel als demo-zaak, en de zaken langs de toelatingsweg', () => {
  assert.match(bron, /require\('\.\/lib\/wegwerpserver'\)/);
  assert.match(bron, /DEMO_SUPPLIER: GROOTHANDEL/);
  assert.doesNotMatch(bron, /localhost:3000|127\.0\.0\.1:3000/);
  /* Een zaak die met een truc in de database wordt gezet, bewijst de keten
     tegen een toestand die in productie niet bestaat. */
  assert.match(bron, /\/api\/aanmelding\/aanvraag/);
  assert.match(bron, /\/api\/aanmelding\/termijn-voldaan/);
});

test('2. de ontvangstschakel meet de KEUKEN en niet alleen de stand van de bestelling', () => {
  /* Dit is precies het gat dat de proef vond: "geleverd" zonder dat er iets
     binnenkwam. Een schakel 6 die alleen de orderstand leest, zou het weer
     verbergen. */
  const zes = bron.slice(bron.indexOf('schakel(6,'), bron.indexOf('schakel(7,'));
  assert.match(zes, /keukenArtikel\(/, 'schakel 6 leest de keukenvoorraad van de koper');
  assert.match(zes, /kostprijs/, 'en de kostprijs die de levering zet');
});

test('3. het register sluit, en de ketenlijst verwijst ernaar', () => {
  const r = lees('VOORRAADPROEF.json');
  assert.equal(r.sluit, true);
  assert.equal(r.telling.schakels, r.telling.gesloten);
  assert.equal(r.telling.storingen, r.telling.gehouden);
  assert.ok(r.grens && /geen geld|Geen browser/i.test(r.grens), 'de grens zegt wat de proef niet meet');
  const ob = fs.readFileSync(path.join(WORTEL, 'scripts', 'ondernemerbewijs.js'), 'utf8');
  assert.match(ob, /id: 'voorraad-ontvangst'[^\n]*proef: 'VOORRAADPROEF\.json'/);
});
