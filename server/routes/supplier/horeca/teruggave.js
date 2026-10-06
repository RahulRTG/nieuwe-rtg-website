/* Horeca OS (deellaag): de TERUGGAVE na een correctie uitvoeren.

   De kern staat in kern/horeca/teruggave.js (per wijze, en waarom). Deze laag
   doet de poort: alleen de MANAGER van de zaak voert een teruggave uit -- het
   is het geld van de zaak, en wie het teruggeeft komt uit de sessie en nooit
   uit het lijf. Het RTG-kantoor heeft hier geen deur.

   Gemount vanuit routes/supplier/horeca.js, na ./correctie.js. */
module.exports = (kern) => {
  const { app, save, supplierAuth, managerOnly, logActivity, sseToSupplier, horeca } = kern;
  const rekVan = kern.horecaRekVan;
  const publiek = kern.horecaPubliek;
  const teruggave = require('../../../kern/horeca/teruggave')({ horeca,
    betaalWaarheid: horeca.terugbetaling, bonlaag: horeca.bonlaag, nu: horeca.nu, id: horeca.id });

  app.post('/api/supplier/horeca/teruggave', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = rekVan(req, res); if (!r) return;
    const b = req.body || {};
    const uit = await teruggave.uitvoeren(r, { correctieId: b.correctieId, betalingId: b.betalingId,
      centen: b.centen, reden: b.reden, door: req.actor.name, zaak: req.supplier.code, idem: b.idem });
    save();
    if (!uit.ok) return res.status(uit.status || 400).json(uit);
    if (!uit.herhaald) logActivity(req.supplier.code, req.actor, 'betaalde ' + (uit.terugbetaling.centen / 100).toFixed(2) +
      ' terug op ' + (r.tafel || r.id) + ' (' + uit.terugbetaling.wijze + ', ' + uit.terugbetaling.stand + ')');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json({ ok: true, herhaald: !!uit.herhaald, terugbetaling: uit.terugbetaling, teruggave: uit.teruggave, rekening: publiek(r) });
  });
};
