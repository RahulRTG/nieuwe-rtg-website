'use strict';
// Gastlinks verlenen alleen de expliciet gedeelde projectweergave, geen lidmaatschap.
// De link is een EXTRA sleutel bij een account (eigenaarsbesluit 19 oktober 2026):
// `auth` eist minimaal een gratis account, en het akkoord hangt aan de codenaam ervan.
module.exports = ({ app, db, save, kern }, deel, stuur, betalen) => {
  const { auth } = kern, { handleVan } = require('../kern/gast/naad')();
  async function actueel() {
    if (typeof db.verversVerzoekCollectie === 'function') {
      await db.verversVerzoekCollectie('tenants');
      await db.verversVerzoekCollectie('werkruimtes');
    } else if (process.env.NODE_ENV === 'production') throw new Error('Actuele gastbevoegdheid ontbreekt');
  }
  const weg = { status: 404, error: 'Deze link is verlopen, ingetrokken of niet geldig.' };
  app.post('/api/werk-gast/beeld', auth, async (req, res) => {
    await actueel();
    const g = deel.gast(req.body || {});
    stuur(res, g ? { ...deel.gastBeeld(g), betaling:betalen.beeld(g.w,g.p,g.x) } : weg);
  });
  app.post('/api/werk-gast/besluit', auth, async (req, res) => {
    await actueel();
    let r;
    await kern.bijeen(() => {
      const g = deel.gast(req.body || {});
      r = g ? deel.besluit(g, req.body || {}, handleVan(req.session)) : weg;
      if (r.ok) save();
    }, { duurzaam: true });
    stuur(res, r);
  });
};
