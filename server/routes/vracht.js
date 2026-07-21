/* Domein "vracht": internationale vracht voor expediteurs (cap 'vracht').
   Alles achter de leverancier-inlog en de vracht-cap; alleen het publieke
   volgen op volgcode staat open, en dat geeft bewust geen klantgegevens. */
module.exports = (kern) => {
  const { app, db, supplierAuth, vracht } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  function eisVracht(req, res) {
    const caps = (db.data.supplierTypes[req.supplier.type] || {}).caps || [];
    if (!caps.includes('vracht')) { res.status(403).json({ error: 'Dit is geen vracht- of expeditiepartner.' }); return false; }
    return true;
  }

  app.post('/api/supplier/vracht', supplierAuth, (req, res) => {
    if (!eisVracht(req, res)) return;
    res.json(vracht.overzicht(req.supplier.code));
  });
  app.post('/api/supplier/vracht/maak', supplierAuth, (req, res) => {
    if (!eisVracht(req, res)) return;
    stuur(res, vracht.maak(req.supplier.code, req.body || {}));
  });
  app.post('/api/supplier/vracht/etappe', supplierAuth, (req, res) => {
    if (!eisVracht(req, res)) return;
    stuur(res, vracht.etappeKlaar(req.supplier.code, req.body.id));
  });
  app.post('/api/supplier/vracht/douane', supplierAuth, (req, res) => {
    if (!eisVracht(req, res)) return;
    stuur(res, vracht.douaneVrij(req.supplier.code, req.body.id));
  });
  app.post('/api/supplier/vracht/afleveren', supplierAuth, (req, res) => {
    if (!eisVracht(req, res)) return;
    stuur(res, vracht.afleveren(req.supplier.code, req.body.id));
  });
  app.post('/api/supplier/vracht/melding', supplierAuth, (req, res) => {
    if (!eisVracht(req, res)) return;
    stuur(res, vracht.melding(req.supplier.code, req.body.id, req.body.tekst));
  });

  // publiek: de klant volgt de zending op volgcode, zonder klantgegevens
  app.post('/api/vracht/volg', (req, res) => stuur(res, vracht.volg((req.body || {}).code)));
};
