/* Keukenvoorraad-routes (toren horeca): het overzicht met waarde, marges en
   inkoopadvies, recepten koppelen aan het menu, en de vloerhandelingen
   telling, verspilling en levering. Recepten en leveringen zijn management;
   tellen en derving melden mag iedereen (de vloer weet wat er staat). */
module.exports = (kern) => {
  const { app, supplierAuth, managerOnly, keuken, save, sseToSupplier } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const sein = code => sseToSupplier(code, 'sync', { scope: 'voorraad' });

  app.post('/api/supplier/keuken', supplierAuth, (req, res) => res.json(keuken.overzicht(req.supplier)));
  // het uittreksel voor de werkvloer-schermen: laag, op en de 86-adviezen
  app.post('/api/supplier/keuken/werkvloer', supplierAuth, (req, res) => res.json(keuken.werkvloer(req.supplier)));

  app.post('/api/supplier/keuken/recept', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = keuken.receptZet(req.supplier, String(req.body.menuItemId || ''), req.body.regels);
    if (r.ok) sein(req.supplier.code);
    stuur(res, r);
  });
  app.post('/api/supplier/keuken/telling', supplierAuth, (req, res) => {
    const r = keuken.telling(req.supplier, req.body.artikelId, req.body.geteld, req.actor.name);
    if (r.ok) sein(req.supplier.code);
    stuur(res, r);
  });
  app.post('/api/supplier/keuken/verspilling', supplierAuth, (req, res) => {
    const r = keuken.verspilling(req.supplier, req.body.artikelId, req.body.hoeveelheid, req.body.reden, req.actor.name);
    if (r.ok) sein(req.supplier.code);
    stuur(res, r);
  });
  app.post('/api/supplier/keuken/levering', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = keuken.levering(req.supplier, req.body.artikelId, req.body.hoeveelheid, req.body.kostprijs, req.actor.name);
    if (r.ok) sein(req.supplier.code);
    stuur(res, r);
  });
};
