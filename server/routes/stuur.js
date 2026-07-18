/* Routes "stuur": het universele stuur van de AI (kern/stuur.js) voor de
   drie werelden. Rahul voert hiermee acties uit op ELK toegestaan API-pad,
   altijd met de eigen inlog van wie het vraagt:
   - /api/member/doe    het lid (en de gratis app), met de leden-token
   - /api/supplier/doe  de zaak (eigenaar of manager)
   - /api/staff/doe     het personeel op de PDA (logt in binnen de zaak)
   De /kaart-varianten geven de bijpassende lijst POST-paden terug, zodat de
   AI (en de nieuwsgierige gebruiker) precies ziet wat er kan. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, stuurRoep, stuurPaden } = kern;

  const doeHandler = async (req, res) => {
    const r = await stuurRoep(req, String(req.body.pad || ''), req.body.body,
      { bevestigd: req.body.bevestigd === true });
    if (r.bevestigNodig) return res.status(428).json(r);
    if (r.error) return res.status(r.status || 500).json({ error: r.error });
    // de buitenkant is gelukt; de binnenkant vertelt hoe de actie afliep
    res.json({ ok: r.status < 400, status: r.status, antwoord: r.antwoord });
  };
  app.post('/api/member/doe', auth, doeHandler);
  app.post('/api/supplier/doe', supplierAuth, doeHandler);
  app.post('/api/staff/doe', supplierAuth, doeHandler);

  // de kaart per wereld: leden zien geen werk-paden en andersom
  const WERK = ['/api/supplier', '/api/staff', '/api/office', '/api/foundation', '/api/partner'];
  app.post('/api/member/doe/kaart', auth, (req, res) => {
    const paden = stuurPaden(app).filter(p => !WERK.some(w => p.startsWith(w)));
    res.json({ ok: true, paden });
  });
  app.post('/api/supplier/doe/kaart', supplierAuth, (req, res) => {
    res.json({ ok: true, paden: stuurPaden(app).filter(p => p.startsWith('/api/supplier') || p.startsWith('/api/staff')) });
  });
  app.post('/api/staff/doe/kaart', supplierAuth, (req, res) => {
    res.json({ ok: true, paden: stuurPaden(app).filter(p => p.startsWith('/api/staff')) });
  });
};
