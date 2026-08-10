/* Domein "supplier" (deelmodule): de aanbieder-kant van RTG Care. Een spa of
   kliniek ziet de agenda van de dag per behandelaar, met de zorgcontext die
   met toestemming meereist (allergenen en, voor een kliniek met een gedeelde
   intake, de medische notitie), en vinkt een afspraak af als afgerond.
   Draait op de gedeelde kern; de logica woont in kern/care.js. */
module.exports = (kern) => {
  const { app, supplierAuth, careAgenda, careAfronden, careVastleg,
    careNietVerschenen, careGemist, sseToSupplier } = kern;

  app.post('/api/supplier/care/agenda', supplierAuth, (req, res) => {
    const r = careAgenda(req.supplier.code, req.body.datum);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });

  app.post('/api/supplier/care/afronden', supplierAuth, (req, res) => {
    const r = careAfronden(req.supplier.code, req.body.ref);
    if (r.error) return res.status(r.status).json({ error: r.error });
    sseToSupplier(req.supplier.code, 'sync', { scope: 'care' });
    res.json(r);
  });

  /* Iets VASTLEGGEN in het dossier van het lid (de derde herkomst). Gaat altijd
     via de referentie van een afspraak bij deze aanbieder, en alleen als het lid
     die aanbieder daar apart toestemming voor gaf -- de intake-deling is die
     toestemming niet: die gaat de andere kant op. */
  /* Niet verschenen. Genoteerd bij de EIGEN agenda; RTG houdt geen cijfer bij
     dat een lid meeneemt naar een andere zaak. Het lid krijgt geen berisping
     maar het aanbod om zijn herinnering eerder te zetten. */
  app.post('/api/supplier/care/nietverschenen', supplierAuth, (req, res) => {
    const r = careNietVerschenen(req.supplier.code, req.body || {});
    if (r.error) return res.status(r.status).json({ error: r.error });
    sseToSupplier(req.supplier.code, 'sync', { scope: 'care' });
    res.json(r);
  });
  app.post('/api/supplier/care/gemist', supplierAuth, (req, res) => {
    const r = careGemist(req.supplier.code);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });

  app.post('/api/supplier/care/vastleggen', supplierAuth, (req, res) => {
    const r = careVastleg(req.supplier.code, req.body || {});
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
};
