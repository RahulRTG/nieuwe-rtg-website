'use strict';
module.exports = ({ app, db, kern, save }, leverancier, stuur) => {
  async function actueel() {
    if (typeof db.verversVerzoekCollectie === 'function') {
      await db.verversVerzoekCollectie('tenants');
      await db.verversVerzoekCollectie('werkruimtes');
    } else if (process.env.NODE_ENV === 'production') throw new Error('Actuele leveranciersbevoegdheid ontbreekt');
  }
  const weg = { status: 404, error: 'Deze leverancierslink is verlopen, ingetrokken of niet geldig.' };
  app.post('/api/werk-leverancier/beeld', async (req, res) => {
    await actueel(); const g = leverancier.gast(req.body || {});
    stuur(res, g ? leverancier.beeld(g) : weg);
  });
  app.post('/api/werk-leverancier/besluit', async (req, res) => {
    await actueel(); let r;
    await kern.bijeen(() => {
      const g = leverancier.gast(req.body || {});
      r = g ? leverancier.besluit(g, req.body || {}) : weg;
      if (r.ok) save();
    }, { duurzaam: true });
    stuur(res, r);
  });
};
