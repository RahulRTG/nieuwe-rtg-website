/* Domein "supplier" (deelmodule): de aanbieder-kant van RTG Care. Een spa of
   kliniek ziet de agenda van de dag per behandelaar, met de zorgcontext die
   met toestemming meereist (allergenen en, voor een kliniek met een gedeelde
   intake, de medische notitie), en vinkt een afspraak af als afgerond.
   Draait op de gedeelde kern; de logica woont in kern/care.js. */
module.exports = (kern) => {
  const { app, supplierAuth, careAgenda, careAfronden, sseToSupplier } = kern;

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
};
