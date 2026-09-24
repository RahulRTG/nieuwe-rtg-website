/* DE LUSPROEF EN ZIJN REGISTER -- de zesde keten, en sinds 24 september 2026
   een bron van bewijs voor APPWERKT.

   scripts/lusproef.js loopt de ontdeklus van Foundation Connect af (CONNECT.md)
   tegen een wegwerpserver. Tot 24 september schreef hij geen register, en dus
   kon versheid() niets over hem zeggen. Nu schrijft `npm run lusproef:vast`
   LUSPROEF.json, en scripts/lib/appcontract.js laat dat register het bewijs
   `voltooibaar` leveren voor Ontdekken (link:connect).

   Dit bestand bewaakt het INSTRUMENT en het REGISTER, niet de keten zelf -- die
   duurt op een wegwerpserver te lang voor een gewone toets.

     1. De proef draait op een wegwerpserver, zakt op een breuk, en deelt geen
        module met de andere ketens.
     2. Het register spreekt het woordgebruik dat scripts/lib/bewijsbron.js leest
        (`gesloten`, `gehouden`). Schreef hij zijn eigen woorden (`sluit`,
        `houdt`), dan zou de lezer elke schakel als open zien.
     3. Het echte register draagt een stempel met commit, schakels en storingen,
        en een telling die de rijen niet overstemt.

   Draai los: node --test test/lusproef.test.js
   De keten zelf: npm run lusproef:vast */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'lusproef.js'), 'utf8');
const REGISTER = 'LUSPROEF.json';

test('1. de proef draait op een wegwerpserver, zakt op een breuk, en deelt geen ketenmodule', () => {
  assert.match(bron, /require\('\.\/lib\/wegwerpserver'\)/);
  assert.doesNotMatch(bron, /localhost:3000|127\.0\.0\.1:3000/);
  assert.match(bron, /process\.exit\(stuk \? 1 : 0\)/, 'zonder foutcode op een breuk is dit een meting en geen proef');
  assert.doesNotMatch(bron, /require\(.*(lib\/keten|lib\/ketenvorm|lib\/proefvorm)/,
    'een gedeelde ketenmodule zou scripts/ketenvorm.js zijn eigen aanname laten meten');
});

test('2. het register spreekt het woordgebruik van de andere ketenregisters', () => {
  assert.match(bron, /sluit: 'gesloten'/);
  assert.match(bron, /houdt: 'gehouden'/);
  assert.match(bron, /stempel: huisStempel\(\)/, 'zonder huisstempel kan versheid() niets over dit register zeggen');
  assert.match(bron, /reg\.sluit = reg\.sluitMetBevinding && t\.openBekend === 0/,
    'sluit hoort een open schakel met reden mee te tellen');
});

test('3. het echte register is bruikbaar als bewijs en spreekt zichzelf niet tegen', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, REGISTER), 'utf8'));
  assert.ok(reg.stempel && typeof reg.stempel === 'object' && reg.stempel.commit, REGISTER + ' draagt geen stempel met commit');
  assert.ok(Array.isArray(reg.schakels) && reg.schakels.length >= 10, REGISTER + ' draagt te weinig schakels om iets te bewijzen');
  assert.ok(Array.isArray(reg.storingen) && reg.storingen.length >= 5, REGISTER + ' draagt te weinig storingen');
  const STANDEN = new Set(['gesloten', 'openBekend', 'stuk']);
  for (const s of reg.schakels) assert.ok(STANDEN.has(s.stand), 'schakel ' + s.nr + ' draagt de onbekende stand ' + s.stand);
  for (const s of reg.storingen) assert.ok(['gehouden', 'gebroken'].includes(s.stand), 'storing ' + s.nr + ' draagt de onbekende stand ' + s.stand);
  const tel = (lijst, stand) => lijst.filter((s) => s.stand === stand).length;
  assert.equal(reg.telling.gesloten, tel(reg.schakels, 'gesloten'), 'de telling overstemt de schakels');
  assert.equal(reg.telling.gebroken, tel(reg.storingen, 'gebroken'), 'de telling overstemt de storingen');
  const heel = tel(reg.schakels, 'stuk') === 0 && tel(reg.storingen, 'gebroken') === 0 && tel(reg.schakels, 'openBekend') === 0;
  assert.equal(reg.sluit, heel, '`sluit` zegt iets anders dan de rijen');
});
