/* Domein "gids": de app-gids achter het ?-knopje van de gedeelde basis-laag.
   De uitleg bevat nooit persoonsgegevens, maar hij hoort bij een ingelogd
   scherm: sinds het eigenaarsbesluit van 19 oktober 2026 vraagt hij een sessie
   (kern/elkesessie.js -- elk lid, elke zaak, het kantoor of een gezinsprofiel).
   De deur voor wie nog niet is ingelogd (shared/deur.js) valt zonder gids
   terug op de reden en de weg. Alleen /apps/-paden krijgen een antwoord. */
module.exports = (kern) => {
  const { app, appgids } = kern;
  const { magSessie, NIET_INGELOGD } = require('../kern/elkesessie');

  app.post('/api/gids/app', (req, res) => {
    if (!magSessie(req, { resolveSession: kern.resolveSession, rtf: kern.rtf })) return res.status(401).json(NIET_INGELOGD);
    const g = appgids.gidsVan(String((req.body || {}).pad || ''));
    if (!g) return res.status(404).json({ error: 'Voor deze pagina is geen gids.' });
    res.json({ gids: g });
  });
};
