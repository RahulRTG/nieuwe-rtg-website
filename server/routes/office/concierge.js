/* Backoffice (deelmodule): het Concierge-bureau van De Rechterhand. De concierge
   in het RTG-kantoor ziet alle open verzoeken van de Lifestyle Pass-leden en loopt
   de statusketen door (in behandeling -> bevestigd -> afgerond, of afgewezen).
   Elke stap belandt in het verzoek van het lid en stuurt het lid een melding: zo
   bevestigt een MENS de boeking, nooit de AI. Gemount vanuit routes/office.js. */
module.exports = (octx) => {
  const { kern } = octx;
  const { app, officeAuth, conciergeDesk, conciergeVoortgang, bureauDesk, bureauVoortgang } = kern;

  app.post('/api/office/concierge', officeAuth, (req, res) => res.json(conciergeDesk()));

  app.post('/api/office/concierge/voortgang', officeAuth, (req, res) => {
    const r = conciergeVoortgang(String(req.body.key || ''), String(req.body.id || ''), String(req.body.status || ''), req.body.notitie);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  /* Het Privékantoor draait op zaken (kern/bureau/cases.js) in plaats van losse
     verzoeken, en heeft daarom zijn eigen bureau -- met dezelfde belofte: hier
     zit een MENS, en alleen deze kant kan een zaak op 'geregeld' zetten.
     Besloten zaken (gezondheid, nalatenschap) komen hier niet binnen; dat is
     geen filter op dit scherm maar een grendel in de kern. */
  app.post('/api/office/bureau', officeAuth, (req, res) => res.json(bureauDesk()));

  app.post('/api/office/bureau/voortgang', officeAuth, (req, res) => {
    const r = bureauVoortgang(String(req.body.key || ''), String(req.body.id || ''), String(req.body.status || ''), req.body.notitie);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
};
