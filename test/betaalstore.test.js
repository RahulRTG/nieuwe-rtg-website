/* De betaal-naad met een geïnjecteerde, durable idempotentie-store (zoals
   server.js hem nu koppelt aan de database): dezelfde sleutel geeft hetzelfde
   resultaat terug, het resultaat staat echt in de store (en overleeft dus een
   herstart), en de FIFO-cap-vorm van de server-wiring werkt.
   Zuiver, zonder server. Draai: node --test test/betaalstore.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const betaal = require('../server/betaal');

test('betaalstore: injectie wordt gebruikt en dezelfde sleutel schrijft nooit dubbel', async () => {
  const opslag = {}; // het "db.data.betaalIdem"-equivalent
  betaal.koppelStore({ get: k => opslag[k], set: (k, v) => { opslag[k] = v; } });

  const a = await betaal.maakBetaling({ bedrag: 1250, referentie: 'T-1', idempotentieSleutel: 'sleutel-1', omschrijving: 'test' });
  assert.equal(a.status, 'betaald');
  assert.ok(opslag['sleutel-1'], 'het resultaat staat in de geïnjecteerde (durable) store');

  const b = await betaal.maakBetaling({ bedrag: 1250, referentie: 'T-1', idempotentieSleutel: 'sleutel-1' });
  assert.equal(b.id, a.id, 'zelfde sleutel = exact dezelfde betaling');
  assert.equal(b.herhaald, true, 'en gemarkeerd als herhaling');

  // een "herstart": een verse get/set-koppeling op DEZELFDE opslag (zoals de
  // database na een reboot) geeft nog steeds hetzelfde resultaat terug
  betaal.koppelStore({ get: k => opslag[k], set: (k, v) => { opslag[k] = v; } });
  const c = await betaal.maakBetaling({ bedrag: 1250, referentie: 'T-1', idempotentieSleutel: 'sleutel-1' });
  assert.equal(c.id, a.id, 'ook na een herstart schrijft dezelfde sleutel niet dubbel af');
});

test('betaalstore: de FIFO-cap-vorm van de server-wiring houdt de administratie begrensd', () => {
  // dezelfde vorm als in server.js, met een kleine cap zodat de test snel is
  const CAP = 5;
  const idem = { _keys: [] };
  const set = (k, v) => {
    if (k === '_keys') return;
    if (!(k in idem)) {
      idem._keys.push(k);
      if (idem._keys.length > CAP)
        for (const weg of idem._keys.splice(0, idem._keys.length - CAP)) delete idem[weg];
    }
    idem[k] = v;
  };
  for (let i = 0; i < 12; i++) set('k' + i, { id: i });
  assert.equal(idem._keys.length, CAP, 'nooit meer sleutels dan de cap');
  assert.ok(!('k0' in idem), 'de oudste sleutels zijn opgeruimd');
  assert.ok('k11' in idem, 'de nieuwste sleutels blijven');
  set('k11', { id: 'update' }); // bestaande sleutel: geen extra _keys-regel
  assert.equal(idem._keys.length, CAP);
});
