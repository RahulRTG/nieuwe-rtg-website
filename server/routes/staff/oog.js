/* Staff (deelmodule): RTG Eye, de camerabril van de werkvloer. De visielaag
   draait op het toestel (oog.html); hier landen alleen de compacte resultaten:
   nulmetingen en schouwen per voertuig, aangeleerde spullen en het
   uitgifteregister. Alles achter de gewone PDA/zaak-inlog (supplierAuth),
   dus via een Zaakdoos-proxy komt elke regel vanzelf in het doos-journaal. */
module.exports = (actx) => {
  const { app, supplierAuth, oogVoertuigen, oogNulmetingZet, oogNulmetingVan, oogSchouwLog,
    oogSchouwen, oogLeer, oogSpullen, oogUitgifteLog, oogOverzicht } = actx;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  // de startstand voor de PDA: voertuigen (met of zonder nulmeting) en spullen
  app.post('/api/staff/oog', supplierAuth, (req, res) => {
    res.json({ voertuigen: oogVoertuigen(req.supplier), spullen: oogSpullen(req.supplier),
      wie: req.actor && req.actor.name || null });
  });
  // de nulmeting: de referentie-handtekening van een voertuig (compact, geen foto)
  app.post('/api/staff/oog/nulmeting', supplierAuth, (req, res) => {
    stuur(res, oogNulmetingZet(req.supplier, req.actor, req.body || {}));
  });
  app.post('/api/staff/oog/nulmeting/van', supplierAuth, (req, res) => {
    res.json({ nulmeting: oogNulmetingVan(req.supplier, req.body.voertuigId) });
  });
  // de schouw zelf: zones + oordeel, als gecodeerde journaalregel
  app.post('/api/staff/oog/schouw', supplierAuth, (req, res) => {
    stuur(res, oogSchouwLog(req.supplier, req.actor, req.body || {}));
  });
  app.post('/api/staff/oog/schouwen', supplierAuth, (req, res) => {
    res.json({ schouwen: oogSchouwen(req.supplier, req.body.voertuigId ? String(req.body.voertuigId) : null) });
  });
  // de werkvloer: aanleren en het knoploze uitgifteregister
  app.post('/api/staff/oog/leer', supplierAuth, (req, res) => {
    stuur(res, oogLeer(req.supplier, req.actor, req.body || {}));
  });
  app.post('/api/staff/oog/uitgifte', supplierAuth, (req, res) => {
    stuur(res, oogUitgifteLog(req.supplier, req.actor, req.body || {}));
  });
  // het overzicht voor de zaak: schouwen, uitgifte en wat er nog buiten is
  app.post('/api/supplier/oog/overzicht', supplierAuth, (req, res) => {
    res.json(oogOverzicht(req.supplier));
  });
};
