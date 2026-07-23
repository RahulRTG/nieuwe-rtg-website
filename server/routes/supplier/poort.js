/* Supplier-submodule "poort": de ondernemer-poort. Een nieuwe zaak loopt eerst
   de basis door (Salon-pagina vullen + rondleiding kassa en werk-apps) en zet
   zichzelf daarna online. Zolang de zaak offline staat, is hij niet zichtbaar
   of boekbaar voor leden. De helpers (poortBeeld, poortKlaar, rondleidingZet,
   zaakOnline) komen uit kern/ondernemerpoort.js via het kern-object. */
module.exports = (kern) => {
  const { app, supplierAuth, save, logActivity, sseToSupplier, broadcastSync,
    poortBeeld, poortKlaar, rondleidingZet } = kern;

  // De stand van de poort: de stappen, de rondleidingen en of de zaak online is.
  app.post('/api/supplier/poort', supplierAuth, (req, res) => {
    res.json(poortBeeld(req.supplier));
  });

  // Een rondleiding als "gevolgd" aftikken (kassa, werk of salon).
  app.post('/api/supplier/poort/rondleiding', supplierAuth, (req, res) => {
    const id = String(req.body && req.body.id || '');
    if (!rondleidingZet(req.supplier, id)) return res.status(400).json({ error: 'Onbekende rondleiding.' });
    save();
    logActivity(req.supplier.code, req.actor, 'volgde de rondleiding: ' + id);
    res.json(poortBeeld(req.supplier));
  });

  // De zaak online of offline zetten. Online kan alleen de manager, en alleen
  // als de poort klaar is (Salon-pagina + verplichte rondleidingen). Offline
  // (pauzeren) mag altijd -- de baas is baas over de eigen zaak.
  app.post('/api/supplier/poort/online', supplierAuth, (req, res) => {
    const s = req.supplier;
    const aan = req.body && req.body.online === true;
    if (aan) {
      if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager kan de zaak online zetten.' });
      if (!poortKlaar(s)) return res.status(409).json({ error: 'Rond eerst de poort af: vul uw Salon-pagina en volg de rondleidingen door de kassa en de werk-apps.' });
      s.online = true;
      logActivity(s.code, req.actor, 'zette de zaak online');
    } else {
      s.online = false;
      logActivity(s.code, req.actor, 'zette de zaak offline (gepauzeerd)');
    }
    save();
    sseToSupplier(s.code, 'sync', { scope: 'poort' });
    broadcastSync(['rtg', 'lifestyle', 'business'], 'suppliers');
    res.json(poortBeeld(s));
  });
};
