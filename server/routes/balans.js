/* Routes "balans": de gezonde leefstijl (kern/balans.js). Het lid ziet het
   eigen weekbeeld met rust-, eet- en beweegadviezen; het personeel ziet op
   de PDA de eigen klokbalans. Beide paden staan op de kaart van het
   AI-stuur, dus Rahul kan de balans in elk gesprek meenemen en op verzoek
   een rustmoment in de agenda zetten. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, liveCodename, balans } = kern;

  app.post('/api/balans', auth, (req, res) => {
    res.json(balans.balansVoorLid(liveCodename(req.session), req.session.key));
  });

  app.post('/api/staff/balans', supplierAuth, (req, res) => {
    res.json(balans.balansVoorStaf(req.supplier.code, req.actor && req.actor.staffId));
  });
};
