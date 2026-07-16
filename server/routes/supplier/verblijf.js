/* Receptie-routes (toren hotel): het bord van vandaag en de verblijfsketen.
   Beslissen, inchecken en no-show zijn vloerhandelingen (iedereen achter de
   balie); het bord is leesbaar voor het hele team. */
module.exports = (kern) => {
  const { app, supplierAuth, receptie, verblijfBeslis, verblijfCheckin, verblijfCheckout, verblijfNoShow, logActivity } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error, openLast: r.openLast }) : res.json(r);

  app.post('/api/supplier/receptie', supplierAuth, (req, res) => {
    if (!Array.isArray(req.supplier.rooms)) return res.status(409).json({ error: 'Dit bedrijf heeft geen kamers.' });
    res.json(receptie(req.supplier, req.body.datum));
  });
  app.post('/api/supplier/verblijf/beslis', supplierAuth, (req, res) => {
    const actie = req.body.actie === 'bevestig' ? 'bevestig' : 'weiger';
    const r = verblijfBeslis(req.supplier, String(req.body.id || ''), actie);
    if (r.ok) logActivity(req.supplier.code, req.actor, (actie === 'bevestig' ? 'bevestigde' : 'weigerde') + ' het verblijf van ' + r.verblijf.codenaam + ' (' + r.verblijf.roomName + ', ' + r.verblijf.aankomst + ')');
    stuur(res, r);
  });
  app.post('/api/supplier/verblijf/checkin', supplierAuth, (req, res) => {
    const r = verblijfCheckin(req.supplier, String(req.body.id || ''), req.actor.name);
    if (r.ok) logActivity(req.supplier.code, req.actor, 'checkte ' + r.verblijf.codenaam + ' in op ' + r.verblijf.roomName);
    stuur(res, r);
  });
  app.post('/api/supplier/verblijf/checkout', supplierAuth, (req, res) => {
    const r = verblijfCheckout(req.supplier, String(req.body.id || ''));
    if (r.ok) logActivity(req.supplier.code, req.actor, 'checkte ' + r.verblijf.codenaam + ' uit van ' + r.verblijf.roomName);
    stuur(res, r);
  });
  app.post('/api/supplier/verblijf/noshow', supplierAuth, (req, res) => {
    const r = verblijfNoShow(req.supplier, String(req.body.id || ''));
    if (r.ok) logActivity(req.supplier.code, req.actor, 'meldde het verblijf van ' + r.verblijf.codenaam + ' als no-show');
    stuur(res, r);
  });
};
