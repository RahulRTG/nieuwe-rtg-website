/* Marktplaats voor leveranciers: een zaak kan ervoor kiezen om spullen op de
   RTFoundation-marktplaats te verkopen (opruiming, overstock, gebruikte inventaris).
   De advertenties komen in dezelfde gedeelde motor (kern/markt.js) terecht die de
   RTFoundation-app toont, met een herkenbare "zaak"-badge. Altijd-aan gemount. */
module.exports = (kern) => {
  const { app, markt, supplierAuth, managerOnly } = kern;

  function partij(req) {
    return { soort: 'zaak', id: req.supplier.code, naam: req.supplier.name, badge: 'zaak', magVerkopen: true };
  }

  // overzicht: eigen advertenties + postvak, plus de categorieen voor het formulier
  app.post('/api/supplier/markt/mijn', supplierAuth, (req, res) => {
    const p = partij(req);
    res.json({ ads: markt.mijn(p), postvak: markt.postvak(p), categorieen: markt.CATEGORIEEN, staten: markt.STATEN });
  });
  app.post('/api/supplier/markt/plaats', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = markt.plaats(req.body || {}, partij(req));
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  });
  app.post('/api/supplier/markt/status', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = markt.zetStatus(String(req.body.id || ''), partij(req), String(req.body.status || ''));
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  });
  app.post('/api/supplier/markt/verwijder', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = markt.verwijder(String(req.body.id || ''), partij(req));
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  });
  app.post('/api/supplier/markt/antwoord', supplierAuth, (req, res) => {
    const r = markt.antwoord(String(req.body.chatId || ''), partij(req), String(req.body.tekst || ''));
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  });
  app.post('/api/supplier/markt/ai', supplierAuth, async (req, res) => {
    const r = await markt.aiHelp(String(req.body.soort || 'beschrijving'), req.body || {});
    res.json(r);
  });
};
