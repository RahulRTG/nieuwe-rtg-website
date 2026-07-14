/* Domein "supplier" (deelmodule): groothandel & markt. Twee kanten op dezelfde
   laag (kern/groothandel.js):
   1. De groothandel zelf beheert zijn assortiment, zet zijn functies aan/uit en
      handelt binnenkomende bestellingen af.
   2. Een horecazaak (of een andere groothandel) koopt IN bij een groothandel,
      met de AI die op basis van verkoop + mise-en-place een bijbestelling
      voorstelt. */
module.exports = (kern) => {
  const { app, db, express, managerOnly, supplierAuth,
    ghIsGroothandel, ghFunctieLijst, ghZetFunctie, ghZetProduct, ghZetVoorraad, ghDefaults,
    ghMarkt, ghPlaatsBestelling, ghOrderVerder, ghAnnuleer, ghMijnBestellingen, ghInkomend,
    ghBijbestelVoorstel, GROOTHANDEL_CATEGORIEEN } = kern;

  function eisGroothandel(req, res) {
    if (!ghIsGroothandel(req.supplier)) { res.status(409).json({ error: 'Dit is geen groothandel.' }); return false; }
    return true;
  }
  // wie koopt er in: een groothandel doet doorverkoop, elke andere zaak is 'partner' (B2B)
  function koperVan(s) { return { soort: s.type === 'groothandel' ? 'groothandel' : 'partner', id: s.code, naam: s.name }; }

  /* ---------------- de groothandel beheert zichzelf ---------------- */
  app.post('/api/supplier/groothandel/overzicht', supplierAuth, (req, res) => {
    if (!eisGroothandel(req, res)) return;
    const s = req.supplier; const g = ghDefaults(s);
    res.json({
      functies: ghFunctieLijst(s), producten: g.producten, categorieen: GROOTHANDEL_CATEGORIEEN,
      inkomend: ghInkomend(s.code)
    });
  });
  app.post('/api/supplier/groothandel/functie', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    if (!eisGroothandel(req, res)) return;
    const r = ghZetFunctie(req.supplier, String(req.body.id || ''), req.body.aan !== false);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, functies: r.functies });
  });
  app.post('/api/supplier/groothandel/product', supplierAuth, express.json({ limit: '2mb' }), (req, res) => {
    if (!managerOnly(req, res)) return;
    if (!eisGroothandel(req, res)) return;
    const r = ghZetProduct(req.supplier, req.body || {});
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, product: r.product, producten: ghDefaults(req.supplier).producten });
  });
  app.post('/api/supplier/groothandel/voorraad', supplierAuth, (req, res) => {
    if (!eisGroothandel(req, res)) return;
    const r = ghZetVoorraad(req.supplier, String(req.body.id || ''), req.body.voorraad);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, voorraad: r.voorraad });
  });
  app.post('/api/supplier/groothandel/order/status', supplierAuth, (req, res) => {
    if (!eisGroothandel(req, res)) return;
    const r = ghOrderVerder(req.supplier.code, String(req.body.ref || ''), String(req.body.actie || ''), req.actor);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, status: r.status2, inkomend: ghInkomend(req.supplier.code) });
  });

  /* ---------------- een zaak koopt in bij een groothandel ---------------- */
  app.post('/api/supplier/inkoop/markt', supplierAuth, (req, res) => {
    const soort = koperVan(req.supplier).soort;
    res.json({ groothandels: ghMarkt(soort, { zoek: req.body.zoek, categorie: req.body.categorie }), categorieen: GROOTHANDEL_CATEGORIEEN });
  });
  app.post('/api/supplier/inkoop/bestel', supplierAuth, (req, res) => {
    const r = ghPlaatsBestelling(String(req.body.groothandelCode || ''), koperVan(req.supplier), req.body.regels, { bezorgen: req.body.bezorgen !== false });
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, order: r.order });
  });
  app.post('/api/supplier/inkoop/mijn', supplierAuth, (req, res) => {
    res.json({ bestellingen: ghMijnBestellingen(koperVan(req.supplier)) });
  });
  app.post('/api/supplier/inkoop/annuleer', supplierAuth, (req, res) => {
    const r = ghAnnuleer(koperVan(req.supplier), String(req.body.ref || ''));
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true });
  });
  // AI-bijbestellen: op basis van de eigen verkoop + mise-en-place een voorstel
  app.post('/api/supplier/inkoop/ai', supplierAuth, (req, res) => {
    const r = ghBijbestelVoorstel(req.supplier, String(req.body.groothandelCode || ''));
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  // het AI-voorstel (of een bijgewerkte versie) bevestigen tot een bestelling
  app.post('/api/supplier/inkoop/ai-bevestig', supplierAuth, (req, res) => {
    const r = ghPlaatsBestelling(String(req.body.groothandelCode || ''), koperVan(req.supplier), req.body.regels, { bezorgen: req.body.bezorgen !== false, bron: 'ai' });
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, order: r.order });
  });
};
