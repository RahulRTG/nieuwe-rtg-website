/* Routes "uitgifte": de documentenuitgifte met het 4/6-ogenprincipe
   (kern/uitgifte.js), voor de drie huizen:
   - de zaak (supplierAuth): elke leverancier/partner, handtekeningen op de
     naam van de ingelogde medewerker (roster)
   - het RTG-kantoor (officeAuth): de backoffice; het kantoor-token kent geen
     personen, dus elke handtekening draagt verplicht een naam ("wie") en
     dezelfde naam telt nooit dubbel
   - het rijk (supplierAuth + rijk): de overheid, op de naam van de ambtenaar */
module.exports = (kern) => {
  const { app, supplierAuth, officeAuth, overheid, uitgifte } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const actorVan = req => (req.actor && req.actor.name) || '';

  /* ---- de zaak ---- */
  app.post('/api/supplier/uitgifte', supplierAuth, (req, res) => res.json(uitgifte.lijst('zaak', req.supplier.code)));
  app.post('/api/supplier/uitgifte/start', supplierAuth, (req, res) => stuur(res, uitgifte.start('zaak', req.supplier.code, actorVan(req), req.body || {})));
  app.post('/api/supplier/uitgifte/teken', supplierAuth, (req, res) => stuur(res, uitgifte.teken('zaak', req.supplier.code, String(req.body.id || ''), actorVan(req))));
  app.post('/api/supplier/uitgifte/bundel', supplierAuth, (req, res) => stuur(res, uitgifte.bundel('zaak', req.supplier.code, String(req.body.id || ''), actorVan(req))));

  /* ---- het RTG-kantoor ---- */
  const wieOffice = req => String((req.body || {}).wie || '');
  app.post('/api/office/uitgifte', officeAuth, (req, res) => res.json(uitgifte.lijst('office', 'office')));
  app.post('/api/office/uitgifte/start', officeAuth, (req, res) => stuur(res, uitgifte.start('office', 'office', wieOffice(req), req.body || {})));
  app.post('/api/office/uitgifte/teken', officeAuth, (req, res) => stuur(res, uitgifte.teken('office', 'office', String(req.body.id || ''), wieOffice(req))));
  app.post('/api/office/uitgifte/bundel', officeAuth, (req, res) => stuur(res, uitgifte.bundel('office', 'office', String(req.body.id || ''), wieOffice(req))));

  /* ---- het rijk ---- */
  function rijk(req, res, next) {
    if (!overheid.magBehandelen(req.supplier)) return res.status(403).json({ error: 'Alleen voor het rijk.' });
    next();
  }
  app.post('/api/overheid/uitgifte', supplierAuth, rijk, (req, res) => res.json(uitgifte.lijst('rijk', 'RIJK')));
  app.post('/api/overheid/uitgifte/start', supplierAuth, rijk, (req, res) => stuur(res, uitgifte.start('rijk', 'RIJK', actorVan(req), req.body || {})));
  app.post('/api/overheid/uitgifte/teken', supplierAuth, rijk, (req, res) => stuur(res, uitgifte.teken('rijk', 'RIJK', String(req.body.id || ''), actorVan(req))));
  app.post('/api/overheid/uitgifte/bundel', supplierAuth, rijk, (req, res) => stuur(res, uitgifte.bundel('rijk', 'RIJK', String(req.body.id || ''), actorVan(req))));
};
