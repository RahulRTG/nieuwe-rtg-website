/* Domein "ov": RTG OV, al het vervoer in een app. De ledenkant (kaart, twee
   snelle check-ins, uitchecken met eerlijke km-prijs) achter de leden-inlog;
   de dienstkant (dienst starten, live GPS, code-check-in) achter de
   PDA-inlog; het zaakoverzicht voor de vervoerder zelf. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, managerOnly, ovKaart, ovCodeMaak, ovHierIn, ovCheckUit, ovMijn,
    ovDienst, ovPos, ovCodeIn, ovStand, ovOverzicht, ovLijnenBeheer, ovLijnZet } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG OV is voor leden.' }); return true; }
    return false;
  };
  const ovZaakOnly = (req, res) => {
    if (req.supplier.type !== 'ov') { res.status(409).json({ error: 'Deze functies horen bij een OV-zaak.' }); return true; }
    return false;
  };

  // de ledenkant
  app.post('/api/ov/kaart', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, ovKaart(req.session.key, { lat: req.body.lat, lng: req.body.lng }));
  });
  // snelle optie 1: de oplichtende code
  app.post('/api/ov/code', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, ovCodeMaak(req.session.key));
  });
  // snelle optie 2: een tik op GPS (aantoonbaar bij het voertuig)
  app.post('/api/ov/hier', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, ovHierIn(req.session.key, { lat: req.body.lat, lng: req.body.lng }));
  });
  app.post('/api/ov/uit', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await ovCheckUit(req.session.key, { lat: req.body.lat, lng: req.body.lng }, req.body.idem));
  });
  app.post('/api/ov/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, ovMijn(req.session.key));
  });

  // de dienstkant (PDA: chauffeur, machinist, schipper)
  app.post('/api/staff/ov/dienst', supplierAuth, (req, res) => {
    if (ovZaakOnly(req, res)) return;
    stuur(res, ovDienst(req.supplier, req.actor, req.body || {}));
  });
  app.post('/api/staff/ov/pos', supplierAuth, (req, res) => {
    if (ovZaakOnly(req, res)) return;
    stuur(res, ovPos(req.supplier, req.actor, req.body || {}));
  });
  app.post('/api/staff/ov/checkin', supplierAuth, (req, res) => {
    if (ovZaakOnly(req, res)) return;
    stuur(res, ovCodeIn(req.supplier, req.actor, req.body.code));
  });
  app.post('/api/staff/ov/stand', supplierAuth, (req, res) => {
    if (ovZaakOnly(req, res)) return;
    stuur(res, ovStand(req.supplier, req.actor));
  });

  // de routetekenaar (PDA, alleen de manager): lijnen en haltes op de eigen kaart
  app.post('/api/staff/ov/lijnen', supplierAuth, (req, res) => {
    if (ovZaakOnly(req, res)) return;
    if (!managerOnly(req, res)) return;
    stuur(res, ovLijnenBeheer(req.supplier));
  });
  app.post('/api/staff/ov/lijn/zet', supplierAuth, (req, res) => {
    if (ovZaakOnly(req, res)) return;
    if (!managerOnly(req, res)) return;
    stuur(res, ovLijnZet(req.supplier, req.body || {}));
  });

  // het zaakoverzicht
  app.post('/api/supplier/ov/overzicht', supplierAuth, (req, res) => {
    if (ovZaakOnly(req, res)) return;
    stuur(res, ovOverzicht(req.supplier));
  });
};
