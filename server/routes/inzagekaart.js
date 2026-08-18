/* Routes "inzagekaart": wie heeft er in mijn gegevens gekeken (kern/inzagekaart.js).
   Alleen voor het lid zelf, en alleen over de eigen sleutel -- er is geen vorm
   waarin een zaak of een kantoor deze kaart over iemand anders kan opvragen.
   Gasten hebben geen dossier en dus geen kaart. */
module.exports = (kern) => {
  const { app, auth, inzagekaartVan } = kern;
  app.post('/api/inzagekaart', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Een inzagekaart hoort bij een ledendossier; gasten hebben er geen.' });
    res.status(200).json(inzagekaartVan(req.session.key));
  });
};
