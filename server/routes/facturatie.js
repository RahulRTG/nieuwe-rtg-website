/* De facturen-endpoints: dezelfde motor voor leden en leveranciers. Elke partij
   ziet zijn eigen facturen (als koper of verkoper) en downloadt de PDF. Er is een
   AI-factuurtool die vragen beantwoordt en in gewone taal een factuur maakt.
   Altijd-aan gemount. */
module.exports = (kern) => {
  const { app, facturatie, auth, geenGast, supplierAuth, managerOnly } = kern;

  // ---------- lid ----------
  app.post('/api/facturen/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json(facturatie.voorLid(req.session.key));
  });
  app.post('/api/facturen/pdf', auth, (req, res) => {
    const f = facturatie.vind(String(req.body.id || ''));
    if (!facturatie.mag(f, { key: req.session.key })) return res.status(404).json({ error: 'Factuur niet gevonden.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + f.nummer.replace(/[^\w.-]/g, '') + '.pdf"');
    res.send(facturatie.pdf(f));
  });
  app.post('/api/facturen/ai', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const r = await facturatie.ai({ key: req.session.key }, String(req.body.opdracht || ''), true);
    res.json(Object.assign({ overzicht: facturatie.voorLid(req.session.key) }, r));
  });

  // ---------- leverancier ----------
  app.post('/api/supplier/facturen/mijn', supplierAuth, (req, res) => {
    res.json(facturatie.voorSupplier(req.supplier.code));
  });
  app.post('/api/supplier/facturen/pdf', supplierAuth, (req, res) => {
    const f = facturatie.vind(String(req.body.id || ''));
    if (!facturatie.mag(f, { supplierCode: req.supplier.code })) return res.status(404).json({ error: 'Factuur niet gevonden.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + f.nummer.replace(/[^\w.-]/g, '') + '.pdf"');
    res.send(facturatie.pdf(f));
  });
  // handmatig een factuur maken (bijv. voor een dienst): koper via codenaam of naam
  app.post('/api/supplier/facturen/maak', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    const b = req.body || {};
    const regels = Array.isArray(b.regels) && b.regels.length ? b.regels
      : [{ omschrijving: b.omschrijving, aantal: b.aantal, stuk: b.bedrag }];
    const r = await facturatie.boekMetCodenaam({
      soort: ['verkoop', 'dienst', 'huur'].includes(b.soort) ? b.soort : 'dienst',
      verkoperCode: req.supplier.code, verkoperNaam: req.supplier.name,
      koper: { naam: b.koperNaam }, regels, methode: b.methode || 'factuur'
    }, b.codenaam);
    if (r.error) return res.status(400).json(r);
    res.json(Object.assign({ overzicht: facturatie.voorSupplier(req.supplier.code) }, r));
  });
  app.post('/api/supplier/facturen/ai', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = await facturatie.ai({ supplierCode: req.supplier.code, supplierNaam: req.supplier.name }, String(req.body.opdracht || ''), true);
    res.json(Object.assign({ overzicht: facturatie.voorSupplier(req.supplier.code) }, r));
  });
};
