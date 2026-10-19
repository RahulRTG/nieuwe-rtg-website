/* Een herhaalde tik op "Deel" is EEN clipkaart, ook na een crash.
   /api/clips/maak kende geen herhaalsleutel; de algemene idempotentielaag
   (server/middleware/idempotentie.js) onthoudt alleen in het geheugen. Viel
   de server weg na het delen en tikte de maker opnieuw, dan stond dezelfde
   opname er twee keer in de feed. De sleutel staat nu op de kaart
   (server/kern/clips.js); het scherm stuurt er een per opname mee
   (test/clips-deel.e2e.js). Gevonden door de voltooiproef
   (scripts/lib/voltooi/clips.js). MUTATIE GEZIEN ZAKKEN: de herhaalcontrole
   in kern/clips.js weghalen; toets 1 zakte. Draai los: node --test test/clipsdeel-herhaal.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, stopHard } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, lid, ander, TMP;
test.before(async () => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-clipdeel-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const maak = (n) => api(base, '/api/auth/register', { name: 'Clip Maker', email: 'cm' + n + u + '@x.nl',
    phone: '06' + n + u.slice(1), password: 'geheim123', geboortedatum: '1992-03-03', tier: 'rtg' });
  lid = (await maak('1')).body.token;
  ander = (await maak('2')).body.token;
});
test.after(() => stop(srv && srv.child));

const mijn = async (tok, titel) => ((await api(base, '/api/clips/feed', {}, tok)).body.mijn || []).filter(c => c.titel === titel);

test('1. dezelfde sleutel na een crash geeft dezelfde kaart, niet een tweede', async () => {
  const lijf = { titel: 'Kade', duurS: 12, idem: 'toets-clip-deel-0001' };
  const a = await api(base, '/api/clips/maak', lijf, lid);
  await stopHard(srv.child);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const b = await api(base, '/api/clips/maak', lijf, lid);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(b.body.id, a.body.id, 'dezelfde kaart, niet twee');
  assert.equal(b.body.herhaald, true);
  assert.equal((await mijn(lid, 'Kade')).length, 1);
});

test('2. een andere sleutel is een nieuwe kaart, en de sleutel van een ander lid raakt de mijne niet', async () => {
  assert.equal((await api(base, '/api/clips/maak', { titel: 'Kade', duurS: 12, idem: 'toets-clip-deel-0002' }, lid)).status, 200);
  assert.equal((await api(base, '/api/clips/maak', { titel: 'Kade', duurS: 12, idem: 'toets-clip-deel-0001' }, ander)).status, 200);
  assert.equal((await mijn(lid, 'Kade')).length, 2);
  assert.equal((await mijn(ander, 'Kade')).length, 1);
});
