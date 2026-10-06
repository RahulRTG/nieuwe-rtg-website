/* ============================================================================
   ACHTERGRONDWERK ERFT GEEN VERZOEKIDENTITEIT (Fase 2, invariant I4).

   Vier gedeelde spoeltimers -- het journaal, de kostenmeter, de mensdeurteller
   en de slapende-zetelmeter -- spoelen het werk van ALLE verzoeken, maar
   vuurden in de context van het verzoek dat hem toevallig startte: met diens
   (inmiddels gesloten) handeling, diens kostendrager en diens AI-sessie. Nu
   zetten ze hun timer via server/lib/losvanverzoek.js, in de nulcontext.

   Hoe deze toets kijkt: de globale setTimeout wordt omhuld zodat de callback
   METEEN vuurt (de vertraging doet voor de context niet ter zake: die hoort bij
   het moment van zetten) en bij het vuren noteert wat er nog aan identiteit
   hangt. Mutatie, met de hand: zet in een van de vier bestanden setTimeout
   terug zonder losVanVerzoek en zijn toets hier zakt.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { AsyncLocalStorage } = require('node:async_hooks');
const { losVanVerzoek } = require('../server/lib/losvanverzoek');
const handeling = require('../server/opzet/handeling');
const haak = require('../server/kern/kosten/haak');

/* Draai `doe` binnen een echt (open) verzoek met een kostendrager, en geef
   terug wat de timers die het zette bij het vuren nog zagen. */
async function vuurtMet(doe) {
  const gezien = [];
  const echt = global.setTimeout;
  global.setTimeout = function (fn, ms, ...rest) {
    const t = echt.call(this, function () {
      gezien.push({ handeling: !!handeling.huidige(), drager: haak.wieNu() });
      return fn.apply(this, arguments);
    }, 0, ...rest);
    return t;
  };
  try {
    const req = { id: 'i4', path: '/i4', method: 'POST' };
    const res = new EventEmitter();
    handeling.middleware({ data: () => null, log: () => {} })(req, res, () => {
      haak.binnen(haak.drager('lid', 'i4-lid'), doe);
    });
    res.emit('finish');
  } finally { global.setTimeout = echt; }
  await new Promise(r => setImmediate(r));
  await new Promise(r => echtTimeout(r, 20));
  return gezien;
}
const echtTimeout = global.setTimeout;

function zonderIdentiteit(gezien, wat) {
  assert.ok(gezien.length >= 1, wat + ': er werd geen timer gezet -- dan bewijst deze toets niets');
  for (const g of gezien) {
    assert.strictEqual(g.handeling, false, wat + ' vuurde met de handeling van een verzoek dat al klaar was');
    assert.strictEqual(g.drager, haak.HUIS, wat + ' vuurde met de kostendrager van dat verzoek (' + g.drager + ')');
  }
}

test('losVanVerzoek draait in de nulcontext, ook voor winkels die hij niet kent', async () => {
  const vreemd = new AsyncLocalStorage();
  const binnen = vreemd.run({ wie: 'lid' }, () => losVanVerzoek(() => vreemd.getStore()));
  assert.strictEqual(binnen, undefined);
  assert.strictEqual(vreemd.run({ wie: 'lid' }, () => losVanVerzoek((a, b) => a + b, 2, 3)), 5, 'argumenten en uitkomst gaan door');
  /* De controle: zonder losVanVerzoek erft het wel. Anders bewijst de regel hierboven niets. */
  assert.deepStrictEqual(vreemd.run({ wie: 'lid' }, () => (() => vreemd.getStore())()), { wie: 'lid' });
});

test('de besturingsproef: een kale timer in een verzoek ERFT wel -- de waarneming werkt', async () => {
  const gezien = await vuurtMet(() => setTimeout(() => {}, 5));
  assert.strictEqual(gezien.length, 1);
  assert.strictEqual(gezien[0].handeling, true);
  assert.strictEqual(gezien[0].drager, 'lid:i4-lid');
});

test('journaalbestand: de spoeltimer erft geen verzoek', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-i4-journaal-'));
  try {
    const { maakJournaalbestand } = require('../server/kern/journaalbestand');
    const j = maakJournaalbestand({ dir });
    zonderIdentiteit(await vuurtMet(() => j.noteerRegel({ t: 1, soort: 'proef' })), 'het journaal');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('kosten/meter: de spoeltimer erft geen verzoek', async () => {
  const data = {};
  const meter = require('../server/kern/kosten/meter')({ d: () => data, save: () => {}, nu: () => '2026-10-05T00:00:00Z' });
  zonderIdentiteit(await vuurtMet(() => meter.meet({ drager: 'lid:i4-lid', soort: 'ai-invoer', aantal: 10 })), 'de kostenmeter');
});

test('kantoor/mensdeur-spoel: de spoeltimer erft geen verzoek', async () => {
  const kaart = {};
  const { maakSpoeler } = require('../server/kern/kantoor/mensdeur-spoel');
  const s = maakSpoeler({ bak: () => kaart, save: () => {}, collectie: 'proef', maxPaden: 10 });
  zonderIdentiteit(await vuurtMet(() => s.tik('/api/proef', true)), 'de mensdeurteller');
});

test('beleidsmotor/slapend: de spoeltimer erft geen verzoek', async () => {
  const kaart = {};
  const { maakSlapend } = require('../server/kern/beleidsmotor/slapend');
  const s = maakSlapend({ bak: () => kaart, kijk: () => kaart, save: () => {}, nu: () => Date.parse('2026-10-05') });
  zonderIdentiteit(await vuurtMet(() => s.noteer('user-1', 'boardroom')), 'de slapende-zetelmeter');
});
