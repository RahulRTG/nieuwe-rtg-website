/* Domein "supplier" (deelmodule): de autoverkoop-afdeling van een verhuur/
   autobedrijf. De zaak beheert de showroom en zet de afdeling aan/uit; de balie
   en het personeel (PDA) handelen proefritten en afleveringen af. Draait op
   kern/autoverkoop. */
module.exports = (kern) => {
  const { app, express, supplierAuth, managerOnly, avDealerInbox, avZetAan, avZetAuto, avVerwijderAuto, avBeslis, AUTOVERKOOP_BRANDSTOF } = kern;

  app.post('/api/supplier/verkoop/overzicht', supplierAuth, (req, res) => {
    res.json(Object.assign(avDealerInbox(req.supplier.code), { brandstoffen: AUTOVERKOOP_BRANDSTOF }));
  });
  app.post('/api/supplier/verkoop/aan', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = avZetAan(req.supplier, req.body.aan !== false);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, aan: r.aan });
  });
  app.post('/api/supplier/verkoop/auto', supplierAuth, express.json({ limit: '8mb' }), (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = avZetAuto(req.supplier, req.body || {});
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, auto: r.auto, overzicht: avDealerInbox(req.supplier.code) });
  });
  app.post('/api/supplier/verkoop/auto/weg', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = avVerwijderAuto(req.supplier, String(req.body.id || ''));
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true });
  });
  // proefrit inplannen / gereden / afwijzen; koop aanvaarden (met tegenbod +
  // inruil-taxatie) / afleveren. Ook door balie/PDA-personeel te doen.
  app.post('/api/supplier/verkoop/deal', supplierAuth, (req, res) => {
    const r = avBeslis(req.supplier.code, String(req.body.ref || ''), String(req.body.actie || ''),
      { moment: req.body.moment, prijs: req.body.prijs, taxatie: req.body.taxatie }, req.actor);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, status: r.status2, overzicht: avDealerInbox(req.supplier.code) });
  });
};
