/* Loonstrook: EEN OUD-MEDEWERKER HOUDT ZEVEN JAAR ZIJN EIGEN STROKEN.

   Tot 19 oktober 2026 las /api/member/loonstroken de stroken via
   accounts.staffPositions, en die geeft alleen ACTIEVE personeelsplekken
   (active = 1; dat is de inlogregel en die moet zo blijven). Na uit dienst
   gaan (/api/supplier/staff/remove) zag een medewerker dus geen enkele eigen
   strook meer, en gaf /api/member/dossier 404 -- terwijl de fiscale
   bewaarplicht zeven jaar is (art. 52 AWR) en het zijn eigen loon is.

   Nu leest de medewerker-kant ook zijn oude plekken (staffHistorie), met de
   stroken van de laatste zeven jaar. Inloggen bij de oude zaak blijft dicht.

   Draai los: node --test test/loonstrook-oudmedewerker.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const DIT_JAAR = new Date().getUTCFullYear();

function opzet() {
  const routes = {};
  const app = { post: (pad, ...h) => { routes[pad] = h[h.length - 1]; } };
  const plekken = [
    { id: 1, supplier_code: 'NU', member_id: 7, active: 1 },
    { id: 2, supplier_code: 'OUD', member_id: 7, active: 0 }
  ];
  const accounts = {
    staffPositions: (m) => plekken.filter((p) => p.member_id === m && p.active === 1),
    staffHistorie: (m) => plekken.filter((p) => p.member_id === m)
  };
  const strook = (periode) => ({ runId: 'r-' + periode, periode, strook: { bruto: 100, netto: 80, regels: [] } });
  const payrollOS = {
    run: { strokenVan: (code) => (code === 'NU' ? [strook(DIT_JAAR + '-01')]
      : code === 'OUD' ? [strook((DIT_JAAR - 2) + '-05'), strook((DIT_JAAR - 9) + '-05')] : []) },
    dossier: { vanMedewerker: (runId, staffId) => (runId === 'r-' + (DIT_JAAR - 2) + '-05' && staffId === 2 ? { ok: true, runId } : null) },
    identiteit: { mijnVerzoeken: () => [] }
  };
  require('../server/routes/payroll-os-mens')({ app, auth: (q, s, n) => n(), payrollOS, accounts, findSupplier: () => null });
  const roep = (pad, body) => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ status: this.code, data: d }); } };
    routes[pad]({ session: { account: { id: 7 } }, body: body || {} }, res);
  });
  return { roep };
}

test('na uit dienst ziet de medewerker zijn stroken van de laatste zeven jaar nog', async () => {
  const { roep } = opzet();
  const r = await roep('/api/member/loonstroken');
  const perioden = r.data.stroken.map((s) => s.periode);
  assert.ok(perioden.includes(DIT_JAAR + '-01'), 'de huidige zaak');
  assert.ok(perioden.includes((DIT_JAAR - 2) + '-05'), 'de oude zaak, binnen zeven jaar');
  assert.ok(!perioden.includes((DIT_JAAR - 9) + '-05'), 'maar niet ouder dan de bewaartermijn');
});

test('het dossier van een strook bij de oude zaak opent nog', async () => {
  const { roep } = opzet();
  const r = await roep('/api/member/dossier', { runId: 'r-' + (DIT_JAAR - 2) + '-05' });
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
});
