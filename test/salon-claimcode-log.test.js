'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('verzilvering schrijft de kale Salon-claimcode nooit in het activiteitenlog', async () => {
  const routes = {}, logs = [];
  const code = 'SAL.A1B2C3D4E5F60718293A4B5C6D7E8F90';
  const kern = {
    app: { post(pad, ...lagen) { routes[pad] = lagen.at(-1); } },
    salonClaimcode: { async verzilver(invoer) {
      assert.equal(invoer.code, code);
      return { status: 200, ok: true, titel: 'Chefsmenu', codename: 'Kobalt', partnerCode: 'ZAAK' };
    } },
    logActivity(...delen) { logs.push(JSON.stringify(delen)); },
    supplierAuth() {}
  };
  require('../server/routes/supplier/salon/claims')(kern);
  const res = { statusCode: 200, body: null,
    status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } };
  await routes['/api/supplier/salon/deal/redeem']({ body: { code, idem: 'salon-log-000000000001' },
    supplier: { code: 'ZAAK' }, actor: { name: 'Kassier' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.codename, 'Kobalt');
  assert.equal(logs.join('\n').includes(code), false);
  assert.match(logs.join('\n'), /Chefsmenu/);
});
