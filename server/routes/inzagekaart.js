/* Routes "inzagekaart": wie heeft er in mijn gegevens gekeken (kern/inzagekaart.js).
   Alleen voor het lid zelf, en alleen over de eigen sleutel -- er is geen vorm
   waarin een zaak of een kantoor deze kaart over iemand anders kan opvragen.
   Een echt account houdt eigen inzage, ook zonder betaalde pas; een accountsloze
   gast of demo heeft geen persoonlijk dossier en dus geen kaart. */
module.exports = (kern) => {
  const { app, auth, inzagekaartVan } = kern;
  app.post('/api/inzagekaart', auth, (req, res) => {
    if (!req.session.account) return res.status(403).json({ error: 'Een inzagekaart hoort bij uw eigen account; log eerst in.' });
    res.status(200).json(inzagekaartVan(req.session.key));
  });
};
