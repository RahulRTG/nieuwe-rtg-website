/* ============================================================================
   DE METING ALS CLASSIFICATIEGROND, EN DE POORT ERVOOR.

   WAAROM DEZE TOETS BESTAAT. Het mutatieboek kende maar een grond voor een
   formele status: de verklaring in server/lib/idemsleutels.js. Alles zonder
   verklaring viel in NOG_NIET_GECLASSIFICEERD -- 3604 van de 4661 mutaties. Dat
   getal leest als "over 3604 mutaties is niet nagedacht", en dat klopte niet:
   IDEMPROEF.json draagt per route de uitslag van drie echte oproepen.

   De verleiding is dan om die meting er gewoon bij te trekken. Dat mag alleen
   met twee grendels ervoor, en dit bestand toetst die allebei:

     1. DE VERSHEIDSPOORT. Een meting van een andere commit -- of gemaakt met
        ongecommit werk in de boom -- is geen grond voor een status. De poort is
        fail-closed: dicht betekent GEEN enkele classificatie, niet een deel.
     2. HET ONDERSCHEID VERKLAARD/GEMETEN. Een gemeten BESCHERMD zegt: met deze
        invoer merkte de server de herhaling. Hij zegt niet wat "hetzelfde
        verzoek" hier betekent -- dat is een besluit. Ze samenvouwen maakt van
        waarnemingen besluiten.

   DE MUTATIE: laat meting() de stempelcontrole overslaan -> de eerste drie
   toetsen zakken. Laat statusUitUitslag() ook 'onbeschermd' een status geven ->
   de laatste zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { meting, statusUitUitslag } = require('../scripts/lib/idemmeting');

test('een meting zonder stempel is geen grond', () => {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-meting-'));
  const f = path.join(d, 'x.json');
  fs.writeFileSync(f, JSON.stringify({ perRoute: [{ methode: 'POST', pad: '/a', idempotentie: 'beschermd', reden: 'x' }] }));
  const u = meting(path.relative(path.join(__dirname, '..'), f));
  assert.equal(u.klaar, false);
  assert.equal(Object.keys(u.perRoute).length, 0, 'dicht is dicht: geen enkele classificatie');
  assert.match(u.reden, /stempel/);
});

test('een meting met een vuile boom is geen grond, en zegt waarom', () => {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-meting-'));
  const f = path.join(d, 'y.json');
  fs.writeFileSync(f, JSON.stringify({ stempel: { commit: 'abc1234', boomVuil: true, op: '2026-01-01' },
    perRoute: [{ methode: 'POST', pad: '/a', idempotentie: 'beschermd', reden: 'x' }] }));
  const u = meting(path.relative(path.join(__dirname, '..'), f));
  assert.equal(u.klaar, false);
  assert.equal(Object.keys(u.perRoute).length, 0);
  assert.match(u.reden, /ongecommit/);
});

test('een meting van een andere commit is geen grond', () => {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-meting-'));
  const f = path.join(d, 'z.json');
  fs.writeFileSync(f, JSON.stringify({ stempel: { commit: '0000000', boomVuil: false, op: '2026-01-01' },
    perRoute: [{ methode: 'POST', pad: '/a', idempotentie: 'beschermd', reden: 'x' }] }));
  const u = meting(path.relative(path.join(__dirname, '..'), f));
  assert.equal(u.klaar, false);
  assert.equal(Object.keys(u.perRoute).length, 0);
  assert.match(u.reden, /HEAD/);
});

test('"onbeschermd" levert met opzet GEEN status op', () => {
  /* Een herhaling die het opnieuw doet kan een defect zijn of precies de
     bedoeling (een betaalopdracht, een bericht). Dat verschil is een besluit en
     geen waarneming; deze module maakt er dus niets van. */
  assert.equal(statusUitUitslag({ idempotentie: 'onbeschermd', reden: 'hij deed het opnieuw', statussen: [200] }), null);
});

test('een geweigerde eerste oproep is een fixture-vraag, met de code erbij', () => {
  const u = statusUitUitslag({ idempotentie: 'ongemeten',
    reden: 'de eerste oproep deed geen werk (status 404)', statussen: [404, 404, 404] });
  assert.equal(u.status, 'WACHT_OP_FIXTURE');
  assert.match(u.waarom, /gemeten/, 'de grond hoort in de reden te staan');
  assert.match(u.waarom, /404/, 'en de gemeten code, want die bepaalt de reparatie');
});

test('503 is iets anders dan 404: de dienst staat uit, dat is geen fixture', () => {
  const u = statusUitUitslag({ idempotentie: 'ongemeten',
    reden: 'de eerste oproep deed geen werk (status 503)', statussen: [503] });
  assert.equal(u.status, 'NIET_BEPROEFBAAR');
});

test('een gemeten status draagt altijd het woord "gemeten" in zijn grond', () => {
  for (const c of [400, 401, 403, 404, 409, 422, 503]) {
    const u = statusUitUitslag({ idempotentie: 'ongemeten',
      reden: 'de eerste oproep deed geen werk (status ' + c + ')', statussen: [c] });
    assert.ok(u && /^gemeten:/.test(u.waarom), 'status voor ' + c + ' zonder gemeten-grond');
  }
});
