/* Routes "stuur": het universele stuur van de AI (kern/stuur.js) voor de
   drie werelden. Rahul voert hiermee acties uit op ELK toegestaan API-pad,
   altijd met de eigen inlog van wie het vraagt:
   - /api/member/doe    het lid (en de gratis app), met de leden-token
   - /api/supplier/doe  de zaak (eigenaar of manager)
   - /api/staff/doe     het personeel op de PDA (logt in binnen de zaak)
   De /kaart-varianten geven uitsluitend de expliciet beoordeelde paden terug.
   Een wijziging levert een eenmalig servervoorstel; alleen /doe/bevestig kan
   dat exacte voorstel uitvoeren. De tool-lus zelf mag die route nooit zien. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, stuurRoep, stuurBevestig, stuurPaden } = kern;

  const antwoord = (res, r) => {
    if (r.bevestigNodig) return res.status(428).json(r);
    if (r.error) return res.status(r.status || 500).json({ error: r.error });
    // de buitenkant is gelukt; de binnenkant vertelt hoe de actie afliep
    return res.json({ ok: r.status < 400, status: r.status, antwoord: r.antwoord });
  };
  const alleenPersoneel = (req, res, wereld) => {
    if (wereld === 'staff' && (!req.actor || !req.actor.staffId)) {
      res.status(403).json({ error: 'Het personeelsstuur vereist een persoonlijke personeelslogin.' });
      return false;
    }
    return true;
  };
  const doeHandler = (wereld) => async (req, res) => {
    if (!alleenPersoneel(req, res, wereld)) return;
    const r = await stuurRoep(req, String(req.body.pad || ''), req.body.body,
      { wereld });
    antwoord(res, r);
  };
  const bevestigHandler = (wereld) => async (req, res) => {
    if (!alleenPersoneel(req, res, wereld)) return;
    if (req.body.akkoord !== true)
      return res.status(400).json({ error: 'Bevestig dit voorstel uitdrukkelijk met akkoord=true.' });
    const r = await stuurBevestig(req, String(req.body.goedkeuringId || ''), wereld);
    antwoord(res, r);
  };
  app.post('/api/member/doe', auth, doeHandler('member'));
  app.post('/api/member/doe/bevestig', auth, bevestigHandler('member'));
  app.post('/api/supplier/doe', supplierAuth, doeHandler('supplier'));
  app.post('/api/supplier/doe/bevestig', supplierAuth, bevestigHandler('supplier'));
  app.post('/api/staff/doe', supplierAuth, doeHandler('staff'));
  app.post('/api/staff/doe/bevestig', supplierAuth, bevestigHandler('staff'));

  // de kaart per wereld: leden zien geen werk-paden en andersom
  const WERK = ['/api/supplier', '/api/staff', '/api/office', '/api/foundation', '/api/partner'];
  app.post('/api/member/doe/kaart', auth, (req, res) => {
    const paden = stuurPaden(app, 'member').filter(p => !WERK.some(w => p.startsWith(w)));
    res.json({ ok: true, paden });
  });
  app.post('/api/supplier/doe/kaart', supplierAuth, (req, res) => {
    res.json({ ok: true, paden: stuurPaden(app, 'supplier') });
  });
  app.post('/api/staff/doe/kaart', supplierAuth, (req, res) => {
    if (!alleenPersoneel(req, res, 'staff')) return;
    res.json({ ok: true, paden: stuurPaden(app, 'staff') });
  });
};
