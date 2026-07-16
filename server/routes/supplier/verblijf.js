/* Receptie-routes (toren hotel): het bord van vandaag en de verblijfsketen.
   Beslissen, inchecken en no-show zijn vloerhandelingen (iedereen achter de
   balie); het bord is leesbaar voor het hele team. */
module.exports = (kern) => {
  const { app, supplierAuth, receptie, kamerplanning, verblijfBeslis, verblijfCheckin, verblijfCheckout, verblijfNoShow, logActivity, dorpKan, dorpPost, dorpVerder, dorpStuurDoor, dorpBuurt, dorpOverzicht, dorpTools, dorpDrukte } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error, openLast: r.openLast }) : res.json(r);

  app.post('/api/supplier/receptie', supplierAuth, (req, res) => {
    if (!Array.isArray(req.supplier.rooms)) return res.status(409).json({ error: 'Dit bedrijf heeft geen kamers.' });
    res.json(receptie(req.supplier, req.body.datum));
  });
  // de kamerkalender: wie zit waar, welke nachten, ook vooruit
  app.post('/api/supplier/kamerplanning', supplierAuth, (req, res) => {
    if (!Array.isArray(req.supplier.rooms)) return res.status(409).json({ error: 'Dit bedrijf heeft geen kamers.' });
    res.json(kamerplanning(req.supplier, req.body.dagen));
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

  /* Het dorp achter de zaak: een motor voor alle afdelingen. Hotels krijgen
     het hoteldorp, bars/clubs/beachclubs het clubdorp; iedereen op de vloer
     kan posten zetten en doorzetten, het dorpsplein is voor het hele team. */
  const eisDorp = (req, res) => {
    if (dorpKan(req.supplier)) return true;
    res.status(409).json({ error: 'Deze zaak heeft geen afdelingenbord.' });
    return false;
  };
  app.post('/api/supplier/dorp', supplierAuth, (req, res) => {
    if (!eisDorp(req, res)) return;
    res.json(dorpOverzicht(req.supplier));
  });
  app.post('/api/supplier/dorp/post', supplierAuth, (req, res) => {
    if (!eisDorp(req, res)) return;
    const r = dorpPost(req.supplier, req.body.afdeling, req.body.waar, req.body.tekst, req.actor.name, req.body.directKlaar === true);
    if (r.ok) logActivity(req.supplier.code, req.actor, 'zette een post bij ' + r.post.afdeling + ': ' + r.post.tekst.slice(0, 60));
    stuur(res, r);
  });
  // het specialistische gereedschap van een afdeling (dagstaat, wachtrij...)
  app.post('/api/supplier/dorp/tools', supplierAuth, (req, res) => {
    if (!eisDorp(req, res)) return;
    stuur(res, dorpTools(req.supplier, String(req.body.afdeling || '')));
  });
  // de standenmeter van een afdeling (drukte, voorraad, seizoen...)
  app.post('/api/supplier/dorp/drukte', supplierAuth, (req, res) => {
    if (!eisDorp(req, res)) return;
    const r = dorpDrukte(req.supplier, String(req.body.afdeling || ''), String(req.body.stand || ''), req.actor.name);
    if (r.ok) logActivity(req.supplier.code, req.actor, 'zette de meter van ' + r.drukte.afdeling + ' op ' + r.drukte.stand);
    stuur(res, r);
  });
  app.post('/api/supplier/dorp/verder', supplierAuth, (req, res) => {
    if (!eisDorp(req, res)) return;
    const r = dorpVerder(req.supplier, String(req.body.id || ''), req.actor.name);
    if (r.ok) logActivity(req.supplier.code, req.actor, 'zette de post "' + r.post.tekst.slice(0, 40) + '" op ' + r.post.status);
    stuur(res, r);
  });
  // afdelingen praten met elkaar: een post reist door met het spoor erbij
  app.post('/api/supplier/dorp/stuurdoor', supplierAuth, (req, res) => {
    if (!eisDorp(req, res)) return;
    const r = dorpStuurDoor(req.supplier, String(req.body.id || ''), req.body.naar, req.actor.name);
    if (r.ok) logActivity(req.supplier.code, req.actor, 'stuurde de post "' + r.post.tekst.slice(0, 40) + '" door naar ' + r.post.afdeling);
    stuur(res, r);
  });
  // de buurt op het conciergescherm: partners om de hoek, op afstand gesorteerd
  app.post('/api/supplier/dorp/buurt', supplierAuth, (req, res) => {
    if (!eisDorp(req, res)) return;
    res.json(dorpBuurt(req.supplier));
  });
};
