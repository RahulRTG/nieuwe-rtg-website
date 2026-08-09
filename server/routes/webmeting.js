/* Cijfers over het eigen web: voor de ondernemer over zijn eigen site, en
   voor RTG over het geheel.

   Het onderscheid met het spoor (routes/zaakweb.js) is met opzet: het SPOOR
   gaat over mensen -- wie publiceerde wat -- en is daarom werk van de leiding.
   De CIJFERS gaan over de site zelf en noemen niemand, dus die mag iedereen
   lezen die er werkt. Dat is geen slordigheid maar dezelfde regel van twee
   kanten bekeken. */
module.exports = (kern) => {
  const { app, auth, webmaker, supplierAuth, officeAuth } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/site/cijfers', auth, (req, res) => stuur(res, webmaker.cijfers(req.session.key, (req.body || {}).id)));
  app.post('/api/supplier/site/cijfers', supplierAuth, (req, res) =>
    stuur(res, webmaker.cijfers('zaak:' + req.supplier.code, (req.body || {}).id)));

  // het beeld voor RTG zelf: hoe staat het eigen web ervoor (alleen tellingen)
  app.post('/api/office/web/overzicht', officeAuth, (req, res) => res.json(webmaker.webOverzicht()));
};
