/* IDEMPOTENTIE -- een herhaald antwoord gaat alleen terug naar wie het eerste kreeg.

   server/middleware/idempotentie.js bewaart het eerste geslaagde antwoord op een
   POST met idem-sleutel en geeft het bij een herhaling terug, met `herhaald` in
   het lijf. De sleutel in de kas draagt de Authorization-kop en het IP mee:
   anders krijgt wie een idem-sleutel raadt het antwoord van een ander lid.

   Wat hier niet mag sneuvelen:
   1. Dezelfde idem-sleutel van een ander account, of anoniem tegenover
      ingelogd, of van een ander IP, voert opnieuw uit en ziet niets van de ander.
   2. Een anoniem verzoek (geen kop) kan zichzelf wel herhalen.
   3. Een lijst, null of een al gemarkeerd antwoord komt onveranderd terug: de
      markering wordt nooit verzonnen waar ze geen plek heeft.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - idempotentie.js: `const wie = (req.get('authorization') || '') + '|' + String(req.ip || '');` -> `const wie = '';` -> toets 1 zakt.
   - idempotentie.js metHerhaald(): `if (!d || typeof d !== 'object' || Array.isArray(d)) return lijf;` weg -> toets 3 zakt.

   Draai los: node --test test/idempotentie-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakIdempotentie = require('../server/middleware/idempotentie');

/* Een verzoek door de middleware en dan door een handler die telt. Het
   antwoord wordt pas bewaard na de eindstatus (lib/eindstatus.js), dus de
   nep-res meldt 'finish' zoals een echte. */
function maak(antwoordVan) {
  const mw = maakIdempotentie();
  let teller = 0;
  return { telling: () => teller, roep: (lijf, { kop = '', ip = '1.1.1.1' } = {}) => new Promise((klaar) => {
    const luisteraars = {};
    const res = { statusCode: 200, kop: {}, lijf: undefined,
      on(n, f) { (luisteraars[n] = luisteraars[n] || []).push(f); return this; },
      once(n, f) { return this.on(n, f); },
      set(k, v) { this.kop[k.toLowerCase()] = v; return this; }, status(c) { this.statusCode = c; return this; },
      type() { return this; }, send(b) { this.lijf = JSON.parse(b); klaar(this); return this; },
      json(b) { this.lijf = b; (luisteraars.finish || []).forEach(f => f()); klaar(this); return this; } };
    const req = { method: 'POST', path: '/api/proef/doe', body: lijf, ip, get: (k) => (k === 'authorization' ? kop : '') };
    mw(req, res, () => { teller++; res.json(antwoordVan(teller, lijf)); });
  }) };
}

test('1. dezelfde sleutel van een ander, anoniem of van een ander IP voert opnieuw uit', async () => {
  const { roep, telling } = maak((n, b) => ({ ok: true, n, geheim: 'van ' + b.wie }));
  const a = await roep({ idem: 'k1', wie: 'A' }, { kop: 'Bearer A' });
  const b = await roep({ idem: 'k1', wie: 'B' }, { kop: 'Bearer B' });
  const anon = await roep({ idem: 'k1', wie: 'anoniem' });
  const ander = await roep({ idem: 'k1', wie: 'A2' }, { kop: 'Bearer A', ip: '2.2.2.2' });
  assert.equal(telling(), 4, 'vier verschillende afzenders, vier uitvoeringen');
  assert.deepEqual([a, b, anon, ander].map(r => r.lijf.geheim), ['van A', 'van B', 'van anoniem', 'van A2']);
  assert.equal(b.kop['x-idempotentie'], undefined);
  const weer = await roep({ idem: 'k1', wie: 'A' }, { kop: 'Bearer A' });
  assert.equal(weer.lijf.geheim, 'van A');
  assert.equal(weer.lijf.herhaald, true);
  assert.equal(telling(), 4);
});

test('2. anoniem kan zichzelf herhalen', async () => {
  const { roep, telling } = maak((n) => ({ n }));
  await roep({ idempotentieSleutel: 'anon-1' }, { ip: undefined });
  const twee = await roep({ idempotentieSleutel: 'anon-1' }, { ip: undefined });
  assert.equal(telling(), 1);
  assert.deepEqual(twee.lijf, { n: 1, herhaald: true });
});

test('3. lijst, null en een al gemarkeerd antwoord komen onveranderd terug', async () => {
  for (const [sleutel, eerste] of [['lijst', [1, 2]], ['niets', null], ['al', { herhaald: true, x: 1 }]]) {
    const { roep, telling } = maak(() => eerste);
    await roep({ idem: sleutel });
    const weer = await roep({ idem: sleutel });
    assert.equal(telling(), 1, sleutel);
    assert.deepEqual(weer.lijf, eerste, sleutel);
  }
});
