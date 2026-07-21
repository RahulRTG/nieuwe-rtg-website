/* Routes "marechaussee": de Brigade RTG Airport (kern/marechaussee.js).
   Alleen voor de brigade zelf (supplier KMAR, roster-login): de grensbalie,
   patrouilles, incidenten, de cockpit en de AI-wachtcommandant. */
module.exports = (kern) => {
  const { app, supplierAuth, kmar } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  function poort(req, res, next) {
    if (!kmar.isKmar(req.supplier)) return res.status(403).json({ error: 'Alleen voor de marechaussee.' });
    next();
  }
  const wie = req => (req.actor && req.actor.name) || 'brigade';

  app.post('/api/kmar/cockpit', supplierAuth, poort, (req, res) => res.json(kmar.cockpit()));
  app.post('/api/kmar/controle/lijst', supplierAuth, poort, (req, res) => stuur(res, kmar.controleLijst(String(req.body.vlucht || ''))));
  app.post('/api/kmar/controle/zet', supplierAuth, poort, (req, res) => stuur(res, kmar.controleZet(wie(req), String(req.body.boekingId || ''), String(req.body.besluit || ''))));
  app.post('/api/kmar/patrouille', supplierAuth, poort, (req, res) => stuur(res, kmar.patrouille(wie(req), String(req.body.zone || ''), req.body.bevinding)));
  app.post('/api/kmar/incidenten', supplierAuth, poort, (req, res) => res.json(kmar.incidenten()));
  app.post('/api/kmar/incident', supplierAuth, poort, (req, res) => stuur(res, kmar.incident(wie(req), req.body || {})));
  app.post('/api/kmar/incident/sluit', supplierAuth, poort, (req, res) => stuur(res, kmar.incidentSluit(wie(req), String(req.body.id || ''), req.body.afloop)));
  app.post('/api/kmar/ai', supplierAuth, poort, async (req, res) => {
    try { res.json(await kmar.kmarAI(String(req.body.vraag || ''))); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
