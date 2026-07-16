/* Domein "supplier" (deelmodule): de zorgvolle keten. Elke zaak ziet de
   gasten die zelf toestemming gaven om live mee te kijken (gps), met het
   zorgprofiel erbij als de gast ook dat deelt. De zaak zet het meekijken
   uit zodra het niet meer nodig is; de gast hoort dat meteen. */
module.exports = (kern) => {
  const { app, supplierAuth, locVoorZaak, locStopZaak, logActivity } = kern;

  app.post('/api/supplier/gastlocaties', supplierAuth, (req, res) => res.json(locVoorZaak(req.supplier)));

  app.post('/api/supplier/gastlocatie/stop', supplierAuth, (req, res) => {
    const r = locStopZaak(req.supplier, String(req.body.id || ''), req.actor.name);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    logActivity(req.supplier.code, req.actor, 'zette het live meekijken met ' + r.deel.codenaam + ' uit (niet meer nodig)');
    res.json(r);
  });
};
