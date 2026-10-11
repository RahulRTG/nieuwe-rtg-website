/* ELK ADRES DAT MOVE OF DE REISWERELD AAN EEN LID GEEFT, BESTAAT.

   `kern/move/gevolg.js` wees een voorstel naar /apps/vervoer.html,
   /apps/reserveren.html en /apps/portaal.html, en de reiswereld een
   partnerboeking naar /apps/portaal.html. Geen van die schermen heeft ooit
   bestaan. Het viel niet op zolang het voorstel geen scherm had; toen het er
   een kreeg (move.html, 11 oktober 2026), was het eerste wat een lid kon
   aantikken een 404. Deze toets legt elk adres tegen public/ en zakt zodra er
   weer een doodspoor in komt. Een hash of query hoort bij de pagina, dus die
   valt eraf; wat overblijft moet een bestand zijn.

   Draai los: node --test test/move-gevolg-adressen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const bestaat = (adres) => {
  const kaal = String(adres).split(/[?#]/)[0];
  return kaal.startsWith('/') && fs.existsSync(path.join(WORTEL, 'public', kaal));
};

test('elk voorstel van move/gevolg wijst naar een scherm dat bestaat', () => {
  const { WIE } = require('../server/kern/move/gevolg');
  const soorten = Object.keys(WIE);
  assert.ok(soorten.length >= 5, 'de tabel is gelezen en niet leeg');
  for (const s of soorten) assert.ok(bestaat(WIE[s].app), s + ' wijst naar ' + WIE[s].app + ', en dat bestand staat niet in public/');
});

test('elke link die de reiswereld op een onderdeel zet, wijst naar een scherm dat bestaat', () => {
  /* Bronlezing en geen aanroep: de bronnen hebben een gevulde database nodig om
     een rij te maken, en een rij die in de zaaiset niet voorkomt zou dan nooit
     gekeurd worden. De letterlijke `link: '...'` in de bron IS het adres. */
  const dir = path.join(WORTEL, 'server', 'kern');
  const bronnen = fs.readdirSync(dir).filter(f => /^reiswereld.*\.js$/.test(f));
  assert.ok(bronnen.length >= 3, 'de reiswereldbronnen zijn gevonden');
  let gezien = 0;
  for (const f of bronnen) {
    const tekst = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of tekst.matchAll(/link:\s*'([^']+)'/g)) {
      gezien++;
      assert.ok(bestaat(m[1]), f + ' zet link ' + m[1] + ', en dat bestand staat niet in public/');
    }
  }
  assert.ok(gezien >= 5, 'er zijn links gelezen (' + gezien + ')');
});
