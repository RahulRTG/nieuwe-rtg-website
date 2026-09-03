/* Routes "uitgifte": de documentenuitgifte met het 4/6-ogenprincipe
   (kern/uitgifte.js), voor de drie huizen:
   - de zaak (supplierAuth): elke leverancier/partner, handtekeningen op de
     naam van de ingelogde medewerker (roster)
   - het RTG-kantoor (naamAuth): de backoffice, maar alleen op NAAM. Hier stond
     eerder officeAuth met `req.body.wie` als ondertekenaar -- zelfgetypte tekst
     (TAKEN.md 4.73). Twee "verschillende" ondertekenaars waren dus twee woorden
     uit dezelfde sessie, en het vier-ogenprincipe was een vormvereiste in
     plaats van een grens. De naam komt nu uit de SESSIE (`req.kantoorKey`,
     gezet door kern/kantoor/kluispoort.js), en de gedeelde backoffice-code komt
     hier niet meer door -- met de weg erheen in het antwoord, niet met een
     dichte deur. LEZEN mag hij nog wel: een lijst bekijken zet geen naam onder
     iets
   - het rijk (supplierAuth + rijk): de overheid, op de naam van de ambtenaar */
module.exports = (kern) => {
  const { app, supplierAuth, officeAuth, naamAuth, overheid, uitgifte } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const actorVan = req => (req.actor && req.actor.name) || '';

  /* ---- de zaak ---- */
  app.post('/api/supplier/uitgifte', supplierAuth, (req, res) => res.json(uitgifte.lijst('zaak', req.supplier.code)));
  app.post('/api/supplier/uitgifte/start', supplierAuth, (req, res) => stuur(res, uitgifte.start('zaak', req.supplier.code, actorVan(req), req.body || {})));
  app.post('/api/supplier/uitgifte/teken', supplierAuth, (req, res) => stuur(res, uitgifte.teken('zaak', req.supplier.code, String(req.body.id || ''), actorVan(req))));
  app.post('/api/supplier/uitgifte/bundel', supplierAuth, (req, res) => stuur(res, uitgifte.bundel('zaak', req.supplier.code, String(req.body.id || ''), actorVan(req))));

  /* ---- het RTG-kantoor ---- */
  /* DE ONDERTEKENAAR KOMT UIT DE SESSIE EN NOOIT UIT DE BODY. `req.kantoorKey`
     wordt door naamAuth gezet en is de codenaam van de ingelogde mens; is er
     geen, dan is het verzoek daar al gestrand. De eigenaar komt met zijn eigen
     account binnen en draagt dan `user-<id>` -- ook een persoon, en ook uniek,
     dus het vier-ogenprincipe telt hem als een tweede paar ogen. */
  const wieOffice = req => String(req.kantoorKey || (req.eigenaar ? req.officeKey : '') || '');
  app.post('/api/office/uitgifte', officeAuth, (req, res) => res.json(uitgifte.lijst('office', 'office')));
  app.post('/api/office/uitgifte/start', naamAuth, (req, res) => stuur(res, uitgifte.start('office', 'office', wieOffice(req), req.body || {})));
  app.post('/api/office/uitgifte/teken', naamAuth, (req, res) => stuur(res, uitgifte.teken('office', 'office', String(req.body.id || ''), wieOffice(req))));
  app.post('/api/office/uitgifte/bundel', naamAuth, (req, res) => stuur(res, uitgifte.bundel('office', 'office', String(req.body.id || ''), wieOffice(req))));

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
