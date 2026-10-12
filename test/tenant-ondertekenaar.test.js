/* WIE TEKENT BIJ EEN TENANT, komt uit de SESSIE (11 oktober 2026; B7 van de
   tweede tegenlezing). Contract, levensloop, bewaringsplicht en vernietigen
   lazen `b.door || wie(req)`: een getypte naam ging voor de ingelogde mens. Deze
   toets mount de echte routes met een nagemaakte kern en kijkt per route welke
   ondertekenaar er bij de kern aankomt, met een `door` in het lijf.

   Draai los: node --test test/tenant-ondertekenaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function mount() {
  const routes = new Map();
  const gezien = {};
  const doorgaan = (req, res, next) => next();
  const ok = (wat) => (...a) => { gezien[wat] = a; return { ok: true, bewijs: { werkruimtes: [] }, contract: {} }; };
  require('../server/routes/techniek/tenant')({
    app: { get: (p, ...h) => routes.set('GET ' + p, h), post: (p, ...h) => routes.set('POST ' + p, h) },
    accounts: { realNameOf: () => 'Echte Eigenaar' }, techAuth: doorgaan, eigenaarAlleen: doorgaan,
    kern: { tenant: { register: {}, contract: { zet: ok('contract'), van: () => null, PAKKETTEN: [] },
      levensloop: { zet: ok('levensloop'), houdVast: ok('bewaringsplicht'), vernietig: ok('vernietig'), stand: () => null } } }
  });
  const roep = (pad, body) => {
    const h = routes.get('POST ' + pad);
    assert.ok(h, 'route ' + pad + ' is gemount');
    const req = { body, techUser: { id: 1 } };
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } };
    let i = 0; const volgende = () => { const f = h[i++]; if (f) f(req, res, volgende); };
    volgende();
    return res;
  };
  return { roep, gezien };
}

test('een `door` in het lijf komt bij geen enkele tenanthandeling als ondertekenaar aan', () => {
  const { roep, gezien } = mount();
  const lijf = { org: 'O-X', door: 'Iemand Anders', reden: 'Een reden van genoeg tekens.' };
  roep('/api/techniek/tenant/contract', Object.assign({ pakket: 'team' }, lijf));
  roep('/api/techniek/tenant/levensloop', Object.assign({ naar: 'opzegging' }, lijf));
  roep('/api/techniek/tenant/bewaringsplicht', Object.assign({ aan: true }, lijf));
  roep('/api/techniek/tenant/vernietig', lijf);
  assert.equal(gezien.contract[1].door, 'Echte Eigenaar', 'contract');
  assert.equal(gezien.levensloop[1].door, 'Echte Eigenaar', 'levensloop');
  assert.equal(gezien.bewaringsplicht[3], 'Echte Eigenaar', 'bewaringsplicht');
  assert.equal(gezien.vernietig[1].door, 'Echte Eigenaar', 'vernietig');
});
