/* Domein "gids": de app-gids achter het ?-knopje van de gedeelde basis-laag.
   Bewust zonder inlog: de uitleg is openbare hulp (wat is deze app, wat kun
   je er doen) en bevat nooit persoonsgegevens. Alleen /apps/-paden krijgen
   een antwoord. */
module.exports = (kern) => {
  const { app, appgids } = kern;

  app.post('/api/gids/app', (req, res) => {
    const g = appgids.gidsVan(String((req.body || {}).pad || ''));
    if (!g) return res.status(404).json({ error: 'Voor deze pagina is geen gids.' });
    res.json({ gids: g });
  });
};
