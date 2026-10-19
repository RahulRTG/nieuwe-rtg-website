/* Een herhaalde tik op "Reserveer" is EEN reservering, ook na een crash.
   /api/member/sport/ticket/koop kende geen eigen herhaalsleutel; de algemene
   idempotentielaag (server/middleware/idempotentie.js) onthoudt antwoorden
   alleen in het geheugen. Viel de server weg na de reservering en tikte het lid
   opnieuw (de app zag geen antwoord), dan stond er een tweede ticket met een
   eigen code en een eigen plaats in het vak. Het scherm stuurde bovendien
   geen sleutel mee. Gevonden door de voltooiproef (scripts/lib/voltooi/sport.js).
   MUTATIE GEZIEN ZAKKEN: de herhaalcontrole in server/kern/sportclub/stadion.js
   weghalen; toets 1 zakte. Draai los: node --test test/sportticket-herhaal.test.js */
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

let srv, base, lid, ander, wedstrijdId, vak, TMP;
test.before(async () => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sporttik-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const maak = (n) => api(base, '/api/auth/register', { name: 'Sport Fan', email: 'st' + n + u + '@x.nl',
    phone: '06' + n + u.slice(1), password: 'geheim123', geboortedatum: '1992-03-03', tier: 'rtg' });
  lid = (await maak('1')).body.token;
  ander = (await maak('2')).body.token;
  const b = await api(base, '/api/member/sport/bord', {}, lid);
  wedstrijdId = b.body.wedstrijden.find(w => w.thuis && !w.uitslag).wedstrijdId;
  vak = (await api(base, '/api/member/sport/plattegrond', { club: 'FCRTG' }, lid)).body.vakken[0].id;
});
test.after(() => stop(srv && srv.child));

test('1. dezelfde sleutel na een crash geeft hetzelfde ticket, niet een tweede', async () => {
  const lijf = { club: 'FCRTG', wedstrijdId, vak, aantal: 2, idem: 'toets-sport-dubbel-0001' };
  const a = await api(base, '/api/member/sport/ticket/koop', lijf, lid);
  await stopHard(srv.child);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const b = await api(base, '/api/member/sport/ticket/koop', lijf, lid);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.body.ticket.code, b.body.ticket.code, 'dezelfde reservering, niet twee');
  assert.equal(b.body.herhaald, true);
  const mijn = await api(base, '/api/member/sport/tickets', {}, lid);
  assert.equal(mijn.body.tickets.length, 1);
});

test('2. een nieuwe sleutel is een nieuwe reservering, en een sleutel van een ander lid raakt de mijne niet', async () => {
  const r = await api(base, '/api/member/sport/ticket/koop', { club: 'FCRTG', wedstrijdId, vak, aantal: 1, idem: 'toets-sport-tweede-0002' }, lid);
  assert.equal(r.status, 200);
  const o = await api(base, '/api/member/sport/ticket/koop', { club: 'FCRTG', wedstrijdId, vak, aantal: 1, idem: 'toets-sport-dubbel-0001' }, ander);
  assert.equal(o.status, 200);
  assert.equal((await api(base, '/api/member/sport/tickets', {}, lid)).body.tickets.length, 2);
  assert.equal((await api(base, '/api/member/sport/tickets', {}, ander)).body.tickets.length, 1);
});
