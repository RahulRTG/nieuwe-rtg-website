/* Horeca OS (deellaag): DE WIJK, deel "nemen" -- een wijk oppakken en loslaten.
   Afgesplitst uit ./wijk.js langs de grens die daar in de kop staat: INDELEN
   is een besluit van de leiding (manager-werk), NEMEN doet de bediening zelf
   aan het begin en het eind van een dienst. Twee soorten handelingen van twee
   soorten mensen, en dus twee deuren. De regels blijven in
   kern/horeca/wijk.js; wijk, wieVan en duw komen mee uit ./wijk.js. */
'use strict';

module.exports = (kern, { wijk, wieVan, duw }) => {
  const { app, save, supplierAuth, logActivity, horeca } = kern;
  const { Hlees } = horeca;

  app.post('/api/supplier/horeca/wijk/neem', supplierAuth, (req, res) => {
    const ik = wieVan(req);
    if (ik.staffId == null) return res.status(403).json({ error: 'Alleen vanaf een persoonlijke inlog.' });
    const h = Hlees(req.supplier.code);
    const uit = wijk.neem(h, req.body.wijkId, ik);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error, code: uit.code || null, van: uit.van });
    if (!uit.al) {
      save();
      logActivity(req.supplier.code, req.actor, 'nam wijk "' + uit.wijk.naam + '"');
      duw(req.supplier.code);
    }
    res.json(uit);
  });

  app.post('/api/supplier/horeca/wijk/laat', supplierAuth, (req, res) => {
    const h = Hlees(req.supplier.code);
    const ik = wieVan(req);
    const uit = wijk.laat(h, req.body.wijkId, ik);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    save();
    logActivity(req.supplier.code, req.actor, 'liet een wijk los');
    duw(req.supplier.code);
    // wie loslaat en nog tafels van een collega draagt, hoort dat (wijk-leen.js)
    res.json(Object.assign({}, uit, wijk.leen.herinnering(h, ik.staffId)));
  });
};
