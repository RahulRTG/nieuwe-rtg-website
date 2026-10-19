/* DE OMZETDAG (server/kern/tijdzone.js: omzetdag, eigenaarsbesluit 19 oktober 2026).

   De omzetdag van een zaak loopt tot 05:00 lokale tijd. De kasopmaak en het
   dagrapport van De Kassa (routes/supplier/kassa/premium.js) vergelijken de
   omzetdag van elke bon met die van NU. Hier staan de momenten vast, in een
   proces met TZ=UTC zoals in productie: verkoop om 23:30 en 00:30, kasopmaak om
   01:00 -- alle drie dezelfde dag. In de winter is dat precies de nacht waarin
   de oude regel (de UTC-datum van de bon tegen die van nu) de avond in tweeen
   brak: 23:30 lokaal is 22:30 UTC, 01:00 lokaal is 00:00 UTC.

   Draai los: node --test test/omzetdag.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
function inUtc(klok, code) {
  const uit = execFileSync(process.execPath, ['-e', code], {
    encoding: 'utf8', cwd: WORTEL,
    env: { ...process.env, TZ: 'UTC', RTG_KLOK: klok, NODE_ENV: 'test' }
  });
  return JSON.parse(uit.trim().split('\n').pop());
}

test('verkoop om 23:30 en 00:30, kasopmaak om 01:00: een omzetdag (winter)', () => {
  const r = inUtc('2026-01-15T00:00:00Z', `
    const BD = require('./server/kern/tijdzone');
    const zaak = { code: 'BAR', country: 'NL' };
    const verkoop = ['2026-01-14T22:30:00Z', '2026-01-14T23:30:00Z'];   // 23:30 en 00:30 lokaal
    const dag = BD.omzetdag(zaak);                                             // 01:00 lokaal
    console.log(JSON.stringify({ dag, telt: verkoop.map(at => BD.omzetdagVan(zaak, at) === dag),
      oud: verkoop.map(at => String(at).slice(0, 10) === new Date().toISOString().slice(0, 10)) }));`);
  assert.equal(r.dag, '2026-01-14');
  assert.deepEqual(r.telt, [true, true], 'de hele avond telt mee in de kasopmaak');
  assert.deepEqual(r.oud, [false, false], 'en dat deed de oude UTC-regel niet: de avond viel weg');
});

test('ook in de zomer, en om 05:00 begint de nieuwe omzetdag', () => {
  const r = inUtc('', `
    const BD = require('./server/kern/tijdzone');
    const z = { country: 'NL' };
    console.log(JSON.stringify([
      BD.omzetdagVan(z, '2026-07-15T21:30:00Z'),  // 23:30 lokaal
      BD.omzetdagVan(z, '2026-07-15T22:30:00Z'),  // 00:30 lokaal
      BD.omzetdagVan(z, '2026-07-16T02:59:00Z'),  // 04:59 lokaal: nog de avond ervoor
      BD.omzetdagVan(z, '2026-07-16T03:00:00Z')   // 05:00 lokaal: de nieuwe dag
    ]));`);
  assert.deepEqual(r, ['2026-07-15', '2026-07-15', '2026-07-15', '2026-07-16']);
});

test('de zone is die van de zaak; zonder bekende zone het huis', () => {
  const r = inUtc('', `
    const BD = require('./server/kern/tijdzone');
    const t = '2026-07-15T23:30:00Z';
    console.log(JSON.stringify([
      BD.omzetdagVan({ tijdzone: 'Europe/Lisbon' }, t),  // 00:30 in Lissabon: nog de 15e
      BD.omzetdagVan({ tijdzone: 'Asia/Tokyo' }, t),     // 08:30 op de 16e in Tokio
      BD.omzetdagVan({}, t)                              // 01:30 in het huis: nog de 15e
    ]));`);
  assert.deepEqual(r, ['2026-07-15', '2026-07-16', '2026-07-15']);
});

test('een bon zonder tijdstip heeft geen omzetdag, en telt dus nooit stil mee', () => {
  const BD = require('../server/kern/tijdzone');
  assert.equal(BD.omzetdagVan({}, undefined), null);
  assert.equal(BD.omzetdagVan({}, ''), null);
  assert.equal(BD.omzetdagVan({}, 'rommel'), null);
  assert.equal(BD.OMZETDAG_GRENS, 300);
});
