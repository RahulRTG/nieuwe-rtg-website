'use strict';
// De leverancierslink is een extra sleutel bij een account (eigenaarsbesluit 19 oktober 2026).
module.exports = ({ app, db, kern, save }, leverancier, stuur) => {
  const { auth } = kern, { handleVan } = require('../kern/gast/naad')();
  async function actueel() {
    if (typeof db.verversVerzoekCollectie === 'function') {
      await db.verversVerzoekCollectie('tenants');
      await db.verversVerzoekCollectie('werkruimtes');
    } else if (process.env.NODE_ENV === 'production') throw new Error('Actuele leveranciersbevoegdheid ontbreekt');
  }
  const weg = { status: 404, error: 'Deze leverancierslink is verlopen, ingetrokken of niet geldig.' };
  app.post('/api/werk-leverancier/beeld', auth, async (req, res) => {
    await actueel(); const g = leverancier.gast(req.body || {});
    stuur(res, g ? leverancier.beeld(g) : weg);
  });
  app.post('/api/werk-leverancier/besluit', auth, async (req, res) => {
    await actueel(); let r;
    await kern.bijeen(() => {
      const g = leverancier.gast(req.body || {});
      r = g ? leverancier.besluit(g, req.body || {}, handleVan(req.session)) : weg;
      if (r.ok) save();
    }, { duurzaam: true });
    stuur(res, r);
  });
};
