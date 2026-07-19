/* Routes "synergie": zaken maken samen deals en pakketten (kern/synergie.js).
   De zaak-kant (maken, tekenen, stoppen, overzicht) achter de
   leverancier-inlog; de leden-kant (pakketten zien en boeken) achter de
   gewone leden-inlog, boeken alleen voor echte leden. Kopen valt onder de
   geldremmen van het AI-stuur (het pad eindigt op /koop). */
module.exports = (kern) => {
  const { app, auth, supplierAuth, liveCodename, synergie, sseToOffice } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/supplier/synergie', supplierAuth, (req, res) => {
    res.json(synergie.dealsVoorZaak(req.supplier.code));
  });
  app.post('/api/supplier/synergie/maak', supplierAuth, (req, res) => {
    stuur(res, synergie.dealMaak(req.supplier.code, req.body || {}));
  });
  app.post('/api/supplier/synergie/reageer', supplierAuth, (req, res) => {
    stuur(res, synergie.dealReageer(req.supplier.code, String(req.body.id || ''), req.body.akkoord !== false));
  });
  app.post('/api/supplier/synergie/stop', supplierAuth, (req, res) => {
    stuur(res, synergie.dealStop(req.supplier.code, String(req.body.id || '')));
  });

  app.post('/api/pakketten', auth, (req, res) => {
    res.json(synergie.pakketten());
  });
  app.post('/api/pakket/koop', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Pakketten boeken is voor leden.' });
    const r = synergie.pakketKoop(liveCodename(req.session), String(req.body.id || ''), req.body.idem);
    if (r.ok && sseToOffice) sseToOffice('sync', { scope: 'pay' });
    stuur(res, r);
  });
};
