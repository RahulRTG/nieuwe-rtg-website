/* Domein "vracht": internationale vracht voor expediteurs (cap 'vracht').
   Alles achter de leverancier-inlog en de vracht-cap; alleen het publieke
   volgen op volgcode staat open, en dat geeft bewust geen klantgegevens. */
module.exports = (kern) => {
  const { app, db, supplierAuth, vracht } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  function eisVracht(req, res) {
    const caps = db.capsVan(req.supplier);
    if (!caps.includes('vracht')) { res.status(403).json({ error: 'Dit is geen vracht- of expeditiepartner.' }); return false; }
    return true;
  }

  app.post('/api/supplier/vracht', supplierAuth, async (req, res) => {
    if (!eisVracht(req, res)) return;
    res.json(await vracht.overzicht(req.supplier.code));
  });
  app.post('/api/supplier/vracht/maak', supplierAuth, async (req, res) => {
    if (!eisVracht(req, res)) return;
    stuur(res, await vracht.maak(req.supplier.code, req.body || {}));
  });
  app.post('/api/supplier/vracht/etappe', supplierAuth, async (req, res) => {
    if (!eisVracht(req, res)) return;
    stuur(res, await vracht.etappeKlaar(req.supplier.code, req.body.id, req.body.idem));
  });
  app.post('/api/supplier/vracht/douane', supplierAuth, async (req, res) => {
    if (!eisVracht(req, res)) return;
    stuur(res, await vracht.douaneVrij(req.supplier.code, req.body.id, req.body.idem));
  });
  app.post('/api/supplier/vracht/afleveren', supplierAuth, async (req, res) => {
    if (!eisVracht(req, res)) return;
    stuur(res, await vracht.afleveren(req.supplier.code, req.body.id, req.body.idem));
  });
  app.post('/api/supplier/vracht/melding', supplierAuth, async (req, res) => {
    if (!eisVracht(req, res)) return;
    stuur(res, await vracht.melding(req.supplier.code, req.body.id, req.body.tekst, req.body.idem));
  });
  app.post('/api/supplier/vracht/volgcode/roteer', supplierAuth, async (req, res) => {
    if (!eisVracht(req, res)) return;
    stuur(res, await vracht.volgcodeRoteer(req.supplier.code, req.body.id,
      req.actor && (req.actor.id || req.actor.name), req.body.idem));
  });
  app.post('/api/supplier/vracht/volgcode/intrek', supplierAuth, async (req, res) => {
    if (!eisVracht(req, res)) return;
    stuur(res, await vracht.volgcodeIntrekken(req.supplier.code, req.body.id,
      req.actor && (req.actor.id || req.actor.name), req.body.reden));
  });

  // publiek: de klant volgt de zending op volgcode, zonder klantgegevens
  app.post('/api/vracht/volg', async (req, res) => stuur(res, await vracht.volg((req.body || {}).code)));
};
