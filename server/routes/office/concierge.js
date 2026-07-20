/* Backoffice (deelmodule): het Concierge-bureau van De Rechterhand. De concierge
   in het RTG-kantoor ziet alle open verzoeken van de Lifestyle Pass-leden en loopt
   de statusketen door (in behandeling -> bevestigd -> afgerond, of afgewezen).
   Elke stap belandt in het verzoek van het lid en stuurt het lid een melding: zo
   bevestigt een MENS de boeking, nooit de AI. Gemount vanuit routes/office.js. */
module.exports = (octx) => {
  const { kern } = octx;
  const { app, officeAuth, conciergeDesk, conciergeVoortgang } = kern;

  app.post('/api/office/concierge', officeAuth, (req, res) => res.json(conciergeDesk()));

  app.post('/api/office/concierge/voortgang', officeAuth, (req, res) => {
    const r = conciergeVoortgang(String(req.body.key || ''), String(req.body.id || ''), String(req.body.status || ''), req.body.notitie);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
};
