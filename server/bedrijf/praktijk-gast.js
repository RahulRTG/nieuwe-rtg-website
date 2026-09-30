'use strict';
// Gastlinks verlenen alleen de expliciet gedeelde projectweergave, geen lidmaatschap.
module.exports = ({ app, db, save, kern }, deel, stuur) => {
  async function actueel() {
    if (typeof db.verversVerzoekCollectie === 'function') {
      await db.verversVerzoekCollectie('tenants');
      await db.verversVerzoekCollectie('werkruimtes');
    } else if (process.env.NODE_ENV === 'production') throw new Error('Actuele gastbevoegdheid ontbreekt');
  }
  const weg = { status: 404, error: 'Deze link is verlopen, ingetrokken of niet geldig.' };
  app.post('/api/werk-gast/beeld', async (req, res) => {
    await actueel();
    const g = deel.gast(req.body || {});
    stuur(res, g ? deel.gastBeeld(g) : weg);
  });
  app.post('/api/werk-gast/besluit', async (req, res) => {
    await actueel();
    let r;
    await kern.bijeen(() => {
      const g = deel.gast(req.body || {});
      r = g ? deel.besluit(g, req.body || {}) : weg;
      if (r.ok) save();
    }, { duurzaam: true });
    stuur(res, r);
  });
};
