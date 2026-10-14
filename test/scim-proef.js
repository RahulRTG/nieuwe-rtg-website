/* De echte SCIM-routes (server/routes/scim.js + scim-groepen.js) in het proces
   gemonteerd, zodat een toets de organisatiegrens raakt zonder een tweede
   proces dat zijn dekking bij een SIGKILL verliest. `roep` draait alle
   handlers na de rem: eerst scimAuth, dan de route zelf. Gebruikt door
   test/scim-orggrens-weerbaar.test.js en test/scim-groepen-weerbaar.test.js. */
'use strict';
const assert = require('node:assert/strict');

module.exports = function monteerScim({ accounts, tenant }) {
  const routes = {};
  const app = {};
  for (const m of ['get', 'post', 'patch', 'put', 'delete']) app[m] = (p, ...h) => { routes[m.toUpperCase() + ' ' + p] = h; };
  require('../server/routes/scim')({ app, accounts, tenant });

  return async function roep(methode, pad, { sleutel, body, query, id } = {}) {
    const h = routes[methode + ' /api/scim/v2' + pad];
    assert.ok(h, 'route ' + methode + ' ' + pad);
    const res = { code: 200, body: null, kop: {},
      status(c) { this.code = c; return this; }, set(n, w) { this.kop[n.toLowerCase()] = w; return this; },
      json(b) { this.body = b; return this; }, end() { this.einde = true; return this; } };
    const req = { body, query: query || {}, params: { id: id == null ? undefined : String(id) },
      get: (n) => (n.toLowerCase() === 'authorization' && sleutel ? sleutel : '') };
    for (const fn of h.slice(1)) {
      let door = false;
      await fn(req, res, () => { door = true; });
      if (!door) break;
    }
    return res;
  };
};
