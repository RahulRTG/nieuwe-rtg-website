/* Domein "marina": het jachthaven-systeem voor partners met de marina-cap.
   De havenmeester stuurt vanuit de leverancier-app; de steiger, service en
   de marina-concierge werken met dezelfde endpoints vanaf de PDA. */
module.exports = (kern) => {
  const { app, db, supplierAuth, marina } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  /* De paden staan voluit: een opgebouwd pad is onzichtbaar voor de
     schakelkast en dus niet vanuit de boardroom te sturen (scripts/check.js
     regel 45). De caps-controle blijft op EEN plek. */
  const doe = (fn) => (req, res) => {
    const caps = db.capsVan(req.supplier);
    if (!caps.includes('marina')) { res.status(403).json({ error: 'Deze zaak is geen jachthaven.' }); return; }
    stuur(res, fn(req.supplier.code, req.body || {}));
  };

  app.post('/api/supplier/marina', supplierAuth, doe((code) => marina.overzicht(code)));
  app.post('/api/supplier/marina/passant', supplierAuth, doe((code, b) => marina.passantMeld(code, b)));
  app.post('/api/supplier/marina/vertrek', supplierAuth, doe((code, b) => marina.vertrek(code, b.id)));
  app.post('/api/supplier/marina/brandstof', supplierAuth, doe((code, b) => marina.brandstofVraag(code, b)));
  app.post('/api/supplier/marina/brandstof/klaar', supplierAuth, doe((code, b) => marina.brandstofKlaar(code, b.id)));
  app.post('/api/supplier/marina/service', supplierAuth, doe((code, b) => marina.serviceVraag(code, b)));
  app.post('/api/supplier/marina/service/status', supplierAuth, doe((code, b) => marina.serviceStatus(code, b.id, b.status)));
  app.post('/api/supplier/marina/concierge', supplierAuth, doe((code, b) => marina.conciergeVraag(code, b)));
  app.post('/api/supplier/marina/concierge/status', supplierAuth, doe((code, b) => marina.conciergeStatus(code, b.id, b.status, b.notitie)));
};
