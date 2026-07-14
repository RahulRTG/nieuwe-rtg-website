/* Domein "supplier" (deelmodule): de veilige mode-bezorgdienst. Twee kanten:
   - de winkel zet de dienst in een tik op en ziet het bezorgbord,
   - de koerier (personeel) krijgt de kortste route, neemt een bezorging aan,
     deelt live zijn positie en rondt veilig af met bezorgcode + foto (en ID bij
     dure stukken), of neemt het aan de deur retour. Draait op kern/modebezorg. */
module.exports = (kern) => {
  const { app, express, supplierAuth, managerOnly,
    mbSetup, mbWinkelOverzicht, mbRoute, mbNeem, mbGps, mbOverhandig, mbRetour } = kern;

  // De winkel zet de bezorgdienst aan/uit en stelt hem in (manager).
  app.post('/api/supplier/mode/bezorg/setup', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = mbSetup(req.supplier, req.body || {});
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, instellingen: r.instellingen });
  });

  // Het bezorgbord van de winkel.
  app.post('/api/supplier/mode/bezorg/overzicht', supplierAuth, (req, res) => {
    res.json(mbWinkelOverzicht(req.supplier.code));
  });

  // De koerier: de open bezorgingen op de kortste route (dichtstbijzijnde eerst).
  app.post('/api/supplier/mode/bezorg/route', supplierAuth, (req, res) => {
    const pos = (Number.isFinite(+req.body.lat) && Number.isFinite(+req.body.lng)) ? { lat: +req.body.lat, lng: +req.body.lng } : null;
    res.json({ route: mbRoute(req.supplier.code, pos) });
  });

  // Een bezorging aannemen (onderweg).
  app.post('/api/supplier/mode/bezorg/neem', supplierAuth, (req, res) => {
    const r = mbNeem(req.supplier.code, String(req.body.ref || ''), req.actor);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, status: r.status2 });
  });

  // Live positie van de koerier naar de klant (vluchtig).
  app.post('/api/supplier/mode/bezorg/gps', supplierAuth, (req, res) => {
    const r = mbGps(req.supplier.code, String(req.body.ref || ''), Number(req.body.lat), Number(req.body.lng));
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, etaMin: r.etaMin });
  });

  // Veilig afronden: bezorgcode + foto-bewijs (+ ID bij dure stukken).
  app.post('/api/supplier/mode/bezorg/overhandig', supplierAuth, express.json({ limit: '1.5mb' }), (req, res) => {
    const r = mbOverhandig(req.supplier.code, String(req.body.ref || ''), {
      bezorgcode: req.body.bezorgcode, foto: req.body.foto, idOk: req.body.idOk === true
    }, req.actor);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, status: r.status2 });
  });

  // Retour aan de deur (past niet / klant weigert).
  app.post('/api/supplier/mode/bezorg/retour', supplierAuth, (req, res) => {
    const r = mbRetour(req.supplier.code, String(req.body.ref || ''), req.body.reden, req.actor);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true });
  });
};
