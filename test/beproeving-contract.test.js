'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { alleRoutes } = require('../scripts/beproeving');
const { VERHALEN } = require('../scripts/verhalen');

test('de storm ontvangt de HTTP-methode die de server registreert', () => {
  const routes = alleRoutes();
  assert.ok(routes.length > 100);
  for (const r of routes) assert.match(r.methode, /^(GET|POST|PUT|DELETE)$/);
  assert.ok(routes.some(r => r.pad === '/api/state' && r.methode === 'POST'));
  assert.ok(routes.some(r => r.pad === '/api/metrics' && r.methode === 'GET'));
});

test('herhaalde geldverhalen blijven binnen de walletlimiet en controleren elke boeking', async () => {
  const p = { ploeg: { beursA: { token: 'A' }, beursB: { token: 'B' } } };
  const saldi = { A: 0, B: 0 }, sleutels = new Set();
  let stortingen = 0, overboekingen = 0, eisen = 0;
  const wb = {
    eis(naam, ok, fout) { eisen++; assert.ok(ok, naam + ': ' + fout); },
    async stap(_naam, _m, pad, token, lijf) {
      if (pad === '/api/verify/status') return { data: { status: 'verified' } };
      if (pad === '/api/pay/overzicht') return { data: { saldo: saldi[token], codenaam: token } };
      if (pad === '/api/pay/oplaad' && !sleutels.has(lijf.idem)) {
        assert.ok(saldi[token] + lijf.centen <= 1000000, 'de proef stort zelf de wallet vol');
        saldi[token] += lijf.centen; stortingen++;
      }
      if (pad === '/api/pay/stuur' && !sleutels.has(lijf.idem)) {
        assert.ok(saldi[token] >= lijf.centen);
        saldi[token] -= lijf.centen; saldi[lijf.aan] += lijf.centen; overboekingen++;
      }
      if (lijf.idem) sleutels.add(lijf.idem);
      return { data: {} };
    }
  };
  for (let i = 0; i < 12; i++) await VERHALEN.find(v => v.id === 'portemonnee-klopt').doe(wb, p);
  assert.equal(stortingen, 1);
  assert.equal(overboekingen, 72);
  assert.ok(eisen >= 84);
  assert.deepEqual(saldi, { A: 200000, B: 0 });
});

test('het onderweg-verhaal maakt van een positie alleen een voorstel en bevestigt aankomst apart', async () => {
  const verhaal = VERHALEN.find(v => v.id === 'onderweg-en-aankomen');
  const bestemming = { code: 'PONTO', loc: { lat: 38.92, lng: 1.44 } };
  const aanroepen = [];
  const wb = {
    eis(naam, ok, fout) { assert.ok(ok, naam + ': ' + fout); },
    async stap(naam, methode, pad, token, body) {
      aanroepen.push({ naam, methode, pad, token, body });
      if (pad === '/api/live/start') return { data: { live: { active: true, dest: bestemming } } };
      if (pad === '/api/live/update' && body.lat !== bestemming.loc.lat) {
        return { data: { live: { active: true, nabij: false, arrived: false } } };
      }
      if (pad === '/api/live/update') {
        return { data: { live: { active: true, nabij: true, arrived: false } } };
      }
      /* Het verhaal (uit #444) leest de bevestigde aankomst ook terug en
         bevestigt haar een tweede keer: beide moeten dezelfde stand geven. */
      if (pad === '/api/live/aangekomen' || pad === '/api/live/state') {
        return { data: { live: { active: true, nabij: false, arrived: true, aankomstDoor: 'lid',
          aankomstAt: '2026-10-04T10:00:00.000Z' } } };
      }
      assert.fail('onverwachte verhaalstap: ' + pad);
    }
  };

  await verhaal.doe(wb, { ploeg: { gast: { token: 'lid-token' } }, supCode: 'PONTO' });

  assert.deepEqual(aanroepen.map(r => r.pad), [
    '/api/live/start',
    '/api/live/update',
    '/api/live/update',
    '/api/live/aangekomen',
    '/api/live/state',
    '/api/live/aangekomen'
  ]);
  assert.equal(aanroepen.at(-1).token, 'lid-token');
});
