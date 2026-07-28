/* Supplier-submodule: het THUIS-KANTOOR van de zaak. Hosts horen bij de
   leveranciers: elke zaak host op RTG Thuis onder de eigen vlag
   'zaak:<code>' -- gasten zien de zaaknaam, de zaak krijgt in het Kantoor
   het volledige host-dashboard (inkomsten, bezetting, superhost),
   aanvragenbeheer, aanbodbeheer, kalenderblokkades en het gratis
   AI-prijsadvies. Lezen mag het hele team; beheren (huizen zetten,
   aanvragen beslissen, blokkeren, uitchecken) is voor de manager. */
module.exports = (kern) => {
  const { app, supplierAuth, managerOnly, logActivity, thuis } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const vlag = req => 'zaak:' + req.supplier.code;

  // lezen: het bord en het eigen aanbod (heel het team)
  app.post('/api/supplier/thuis/bord', supplierAuth, (req, res) => res.json(thuis.thuisHostBord(vlag(req))));
  app.post('/api/supplier/thuis/huizen', supplierAuth, (req, res) => res.json(thuis.thuisMijnHuizen(vlag(req))));
  app.post('/api/supplier/thuis/prijsadvies', supplierAuth, (req, res) => stuur(res, thuis.thuisSlimmePrijs(vlag(req), String(req.body.id || ''))));
  app.post('/api/supplier/thuis/berichten', supplierAuth, (req, res) => stuur(res, thuis.thuisBerichten(vlag(req), req.body.ref)));
  // de commerciele tak: omzet, af te dragen logies-btw, commissie en netto
  app.post('/api/supplier/thuis/zakelijkbord', supplierAuth, (req, res) => res.json(thuis.thuisZakelijkBord(vlag(req))));

  // beheren: de manager zet huizen live, beslist en blokkeert
  app.post('/api/supplier/thuis/huis', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = thuis.thuisHuisZet(vlag(req), req.body.huis || {}, req.body.id ? String(req.body.id) : null);
    if (!r.error) logActivity(req.supplier.code, req.actor, (req.body.id ? 'werkte een Thuis-huis bij' : 'zette een huis op RTG Thuis') + ': ' + r.huis.titel);
    stuur(res, r);
  });
  app.post('/api/supplier/thuis/beslis', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = thuis.thuisBeslis(vlag(req), req.body.ref, req.body.akkoord === true);
    if (!r.error) logActivity(req.supplier.code, req.actor, (req.body.akkoord === true ? 'accepteerde' : 'wees af') + ' een Thuis-aanvraag');
    stuur(res, r);
  });
  app.post('/api/supplier/thuis/blokkeer', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, thuis.thuisBlokkeer(vlag(req), String(req.body.id || ''), req.body.van, req.body.tot, req.body.weg === true));
  });
  app.post('/api/supplier/thuis/checkuit', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, thuis.thuisCheckuit(vlag(req), req.body.ref));
  });
  app.post('/api/supplier/thuis/zakelijk', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = thuis.thuisZakelijkZet(vlag(req), String(req.body.id || ''), req.body.zakelijk || {});
    if (!r.error) logActivity(req.supplier.code, req.actor,
      (r.huis.commercieel ? 'zette een Thuis-huis in de commerciele tak' : 'zette een Thuis-huis terug op prive-verhuur') + ': ' + r.huis.titel);
    stuur(res, r);
  });
  app.post('/api/supplier/thuis/bericht', supplierAuth, (req, res) => stuur(res, thuis.thuisBericht(vlag(req), req.body.ref, req.body.tekst)));
  app.post('/api/supplier/thuis/review', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, thuis.thuisReview(vlag(req), req.body || {}));
  });
};
