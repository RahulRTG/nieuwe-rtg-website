/* Domein "supplier" (deelmodule): de handelsketen -- zaak-naar-zaak inkoop over
   ALLE genres heen. Beschikbaar voor elke leverancier; kern/handelsketen.js
   bepaalt per stap wie er aan zet is (koper of leverancier).

   Geldstappen (gunnen, factureren, betalen) zijn voor het beheer: dat zijn de
   momenten waarop de zaak zich ergens aan verbindt. Offreren, plannen en
   leveren mag het personeel, want dat is het werk zelf. */
module.exports = (kern) => {
  const { app, handelsketen, managerOnly, supplierAuth } = kern;

  // een fout uit de keten komt met zijn eigen statuscode terug
  const uit = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/supplier/handel/mijn', supplierAuth, (req, res) => {
    res.json(handelsketen.mijn(req.supplier));
  });

  /* ---------------- de koper ---------------- */
  app.post('/api/supplier/handel/aanvraag', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    uit(res, handelsketen.nieuweAanvraag(req.supplier, req.body || {}));
  });
  app.post('/api/supplier/handel/gunnen', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    uit(res, handelsketen.gunnen(req.supplier, req.body.id, req.body.offerteId));
  });
  app.post('/api/supplier/handel/intrekken', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    uit(res, handelsketen.intrekken(req.supplier, req.body.id));
  });
  app.post('/api/supplier/handel/betalen', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    uit(res, handelsketen.betalen(req.supplier, req.body.id));
  });

  /* ---------------- de leverancier ---------------- */
  app.post('/api/supplier/handel/offreren', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;   // een prijs afgeven bindt de zaak
    uit(res, handelsketen.offreren(req.supplier, req.body.id, req.body || {}));
  });
  app.post('/api/supplier/handel/plannen', supplierAuth, (req, res) => {
    uit(res, handelsketen.plannen(req.supplier, req.body.id, req.body || {}));
  });
  app.post('/api/supplier/handel/leveren', supplierAuth, (req, res) => {
    uit(res, handelsketen.leveren(req.supplier, req.body.id, req.body || {}));
  });
  app.post('/api/supplier/handel/factureren', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    uit(res, handelsketen.factureren(req.supplier, req.body.id, req.body || {}));
  });
};
