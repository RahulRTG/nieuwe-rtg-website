/* Cijfers over het eigen web: voor de ondernemer over zijn eigen site, en
   voor RTG over het geheel.

   Het onderscheid met het spoor (routes/zaakweb.js) is met opzet: het SPOOR
   gaat over mensen -- wie publiceerde wat -- en is daarom werk van de leiding.
   De CIJFERS gaan over de site zelf en noemen niemand, dus die mag iedereen
   lezen die er werkt. Dat is geen slordigheid maar dezelfde regel van twee
   kanten bekeken. */
module.exports = (kern) => {
  const { app, auth, webmaker, supplierAuth, managerOnly, officeAuth } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/site/cijfers', auth, (req, res) => stuur(res, webmaker.cijfers(req.session.key, (req.body || {}).id)));
  app.post('/api/supplier/site/cijfers', supplierAuth, (req, res) =>
    stuur(res, webmaker.cijfers('zaak:' + req.supplier.code, (req.body || {}).id)));

  /* ---- een eigen adres buiten het RTG-web ----
     De poort hierop is de boardroom-schakelaar 'dom-eigendomein', die
     STANDAARD UIT staat; de functieschakelaar-middleware geeft 503 met uitleg
     zolang hij dicht is. Wat hier gebeurt is dus alleen bereikbaar als de
     boardroom dat bewust heeft aangezet. */
  app.post('/api/site/domein', auth, (req, res) => {
    const b = req.body || {};
    stuur(res, webmaker.domein(req.session.key, b.id, b.domein));
  });
  app.post('/api/supplier/site/domein', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const b = req.body || {};
    stuur(res, webmaker.domein('zaak:' + req.supplier.code, b.id, b.domein, (req.actor && req.actor.name) || null));
  });

  // het beeld voor RTG zelf: hoe staat het eigen web ervoor (alleen tellingen)
  app.post('/api/office/web/overzicht', officeAuth, (req, res) => res.json(webmaker.webOverzicht()));
};
