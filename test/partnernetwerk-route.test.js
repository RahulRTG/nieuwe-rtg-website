/* PARTNER NETWORK OVER HTTP: /api/supplier/netwerk/overzicht.

   De zaak krijgt tellingen met een bron (kern/partnernetwerk.js); een lid
   zonder zaak en een aanvraag zonder sessie komen er niet in, en de route
   schrijft niets (server/lib/mutatiecontracten-partnernetwerk.js).

   Draai los: node --test test/partnernetwerk-route.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let srv;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-partnernetwerk-'));
const api = (pad, body, token) => fetch(srv.base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => { srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }); });
test.after(() => {
  if (srv && srv.child) try { srv.child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een zaak krijgt haar netwerk met een bron bij elk getal; een lid en een anonieme aanvraag niet', async () => {
  const roster = (await api('/api/supplier/roster', { code: 'HOSHI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  const zaak = (await api('/api/supplier/login', { code: 'HOSHI', staffId: mgr.id, pin: '1234' })).body.token;
  const o = await api('/api/supplier/netwerk/overzicht', {}, zaak);
  assert.equal(o.status, 200);
  assert.equal(o.body.zaak.code, 'HOSHI');
  for (const [naam, g] of Object.entries(o.body.getallen)) {
    assert.ok(g.waarde == null ? !!g.nietGemeten : typeof g.bron === 'string', naam + ' draagt een bron of een reden');
  }
  assert.equal(typeof o.body.getallen.kamersTotaal.waarde, 'number', 'een hotel heeft kamers, en die tellen we');
  assert.ok(o.body.nietGebouwd.length >= 3);
  const nogEens = await api('/api/supplier/netwerk/overzicht', {}, zaak);
  assert.deepEqual(nogEens.body.getallen, o.body.getallen, 'lezen verandert niets');

  const lid = (await api('/api/auth/register', { name: 'Lid Een', email: 'pn-lid@x.nl', phone: '0612345688',
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg' })).body.token;
  assert.equal((await api('/api/supplier/netwerk/overzicht', {}, lid)).status, 401, 'een lid zonder zaak komt er niet in');
  assert.equal((await api('/api/supplier/netwerk/overzicht', {})).status, 401, 'zonder sessie ook niet');
});


test('netwerk leest de volledige eigen werklijst via de leverancier, zonder opslag te maken', () => {
  const { ticketsVanZaak } = require('../server/kern/leverancier/zaak');
  const maak = require('../server/kern/partnernetwerk');
  const db = { data: {} };
  assert.deepEqual(ticketsVanZaak(db, 'A'), []);
  assert.deepEqual(db.data, {}, 'een lege leesvraag maakt geen opslag');
  db.data.tickets = { A: Array.from({ length: 65 }, (_, i) => ({ id: String(i), status: i < 60 ? 'open' : 'klaar', text: 'Eigen klus' })),
    B: [{ id: 'geheim', status: 'open', text: 'Andere zaak' }] };
  const voor = JSON.stringify(db.data);
  const netwerk = maak({ ticketsVanZaak: code => ticketsVanZaak(db, code) });
  const r = netwerk.overzicht({ code: 'A', name: 'Eigen zaak' });
  assert.equal(r.getallen.klussenOpen.waarde, 60, 'geen afkapping op de veertig dashboardrijen');
  assert.equal(r.aandacht.filter(x => x.soort === 'klus').length, 5);
  assert.ok(!JSON.stringify(r).includes('geheim'), 'andere zaak blijft afgeschermd');
  assert.equal(JSON.stringify(db.data), voor);
  assert.deepEqual(ticketsVanZaak(db, '__proto__'), []);
  db.data.tickets.A = {};
  assert.throws(() => ticketsVanZaak(db, 'A'), /Ongeldige werklijst/, 'corrupte gegevens worden geen lege succesuitkomst');
});
