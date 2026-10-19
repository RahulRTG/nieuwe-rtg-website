/* Een betaling is een regel in het lijstje (server/kern/wbw.js, verreken).

   Twee tikken op Verreken met dezelfde sleutel, terwijl RTG Pay nog bezig is
   (echte I/O: Postgres, een kaart die bijlaadt). pay.stuur betaalt terecht een
   keer en geeft de tweede dezelfde boeking -- maar het lijstje schreef allebei
   als verrekening op: een betaling van 15 euro, en B stond daarna 15 euro voor.
   Gezocht vanuit de voltooiproef van Samen betalen (scripts/lib/voltooi/wbw.js),
   waar de lokale betaalnaad te snel is om dat venster te raken. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakWbw } = require('../server/kern/wbw');

function wereld() {
  const db = { data: {} };
  const betaald = new Map();
  let n = 0;
  const pay = {
    async stuur({ idem }) {
      if (idem && betaald.has(idem)) return Object.assign({}, await betaald.get(idem), { herhaald: true });
      const p = new Promise((res) => setTimeout(() => res({ ok: true, boeking: 'B' + (++n) }), 20));
      if (idem) betaald.set(idem, p);
      return p;
    }
  };
  const k = maakWbw({ db, save: () => {}, crypto, schoon: (v, m) => String(v == null ? '' : v).slice(0, m || 200),
    codenaamVan: (x) => 'C' + x, connectieTussen: () => 1, verbActief: () => true, pay, notify: () => {} });
  const g = k.wbwMaak('a', { naam: 'Weekend', leden: ['b'] }).groep;
  return { k, gid: g.id, betalingen: () => n, db };
}

test('twee tikken tegelijk met dezelfde sleutel: een betaling en een verrekening', async () => {
  const { k, gid, betalingen } = wereld();
  k.wbwUitgave('a', gid, { centen: 3000 });
  const [x, y] = await Promise.all([k.wbwVerreken('b', gid, 'k'), k.wbwVerreken('b', gid, 'k')]);
  assert.equal(x.status, 200);
  assert.equal(y.status, 200);
  assert.equal(betalingen(), 1);
  assert.equal(k.wbwGroep('b', gid).groep.mijnSaldo, 0, 'B staat op nul, niet voor');
  assert.equal(k.wbwGroep('a', gid).groep.mijnSaldo, 0, 'A staat op nul');
});

test('een verrekening die bij een crash verloren ging, komt met dezelfde sleutel terug zonder tweede betaling', async () => {
  const { k, gid, betalingen, db } = wereld();
  k.wbwUitgave('a', gid, { centen: 2000 });
  await k.wbwVerreken('b', gid, 'k2');
  /* de regel weg, het geld niet: de stroomstoring tussen RTG Pay en het lijstje */
  const lijst = require('../server/kern/eigencollectie')({ db, domein: 'kern/wbw', bezit: { wbwGroepen: 'lijst' } }).bak('wbwGroepen');
  lijst.find((x) => x.id === gid).regels.pop();
  const r = await k.wbwVerreken('b', gid, 'k2');
  assert.equal(r.status, 200);
  assert.equal(betalingen(), 1, 'geen tweede betaling');
  assert.equal(k.wbwGroep('b', gid).groep.mijnSaldo, 0);
});
