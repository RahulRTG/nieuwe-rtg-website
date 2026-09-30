/* Backoffice (deelmodule): het Concierge-bureau van De Rechterhand. De concierge
   in het RTG-kantoor ziet alle open verzoeken van de Lifestyle Pass-leden en loopt
   de statusketen door (in behandeling -> bevestigd -> afgerond, of afgewezen).
   Elke stap belandt in het verzoek van het lid en stuurt het lid een melding: zo
   bevestigt een MENS de boeking, nooit de AI. Gemount vanuit routes/office.js. */
module.exports = (octx) => {
  const { kern } = octx;
  const { app, officeAuth, conciergeDesk, conciergeVoortgang } = kern;
  // alleen de balie: het kantoor kan de graaf en het mandaat van een lid niet zien
  const B = kern.bureauBalie;
  const { boardroomWie, liveCodename } = kern;

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
  app.post('/api/office/bureau', officeAuth, (req, res) => res.json(B.desk()));

  app.post('/api/office/bureau/voortgang', officeAuth, (req, res) => {
    const r = B.voortgang(String(req.body.key || ''), String(req.body.id || ''), String(req.body.status || ''), req.body.notitie);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  /* De concierge-lus aan de kantoorkant. Elke route neemt de sleutel van het lid
     en de id van de zaak; de lus zelf weigert een zaak die er niet via loopt.
     De naam van wie een zaak oppakt komt uit de SESSIE en nooit uit het verzoek
     (AUTHORITY.md): met de gedeelde kantoorcode is er geen naam, en dan ziet
     het lid een rol. */
  const lus = (fn) => (req, res) => {
    const b = req.body || {};
    let r;
    try { r = fn(String(b.key || ''), String(b.id || ''), b, req); }
    catch (e) { return res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
    if (r && r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  };
  app.post('/api/office/bureau/lus', officeAuth, lus((k, id) => B.lusKantoor(k, id)));
  app.post('/api/office/bureau/lus/neem', officeAuth, lus((k, id, b, req) => {
    const wie = boardroomWie ? boardroomWie(req) : null;
    return B.lusNeem(k, id, { naam: wie && liveCodename ? liveCodename(wie) : null });
  }));
  app.post('/api/office/bureau/lus/weigering', officeAuth, lus((k, id, b) => B.lusWeigering(k, id, b)));
  app.post('/api/office/bureau/lus/aanbod', officeAuth, lus((k, id, b) => B.lusAanbod(k, id, b)));
  app.post('/api/office/bureau/lus/kies', officeAuth, lus((k, id, b) => B.lusKies(k, id, b)));
  app.post('/api/office/bureau/lus/onderdeel', officeAuth, lus((k, id, b) => B.lusOnderdeel(k, id, b)));
  app.post('/api/office/bureau/lus/bevestig', officeAuth, lus((k, id, b) => B.lusBevestig(k, id, String(b.onderdeel || ''))));
  app.post('/api/office/bureau/lus/vertraging', officeAuth, lus((k, id, b) => B.lusVertraging(k, id, b)));
  app.post('/api/office/bureau/lus/verstuur', officeAuth, lus((k, id, b) => B.lusVerstuur(k, id, b)));
  app.post('/api/office/bureau/lus/kapot', officeAuth, lus((k, id, b) => B.lusKapot(k, id, b)));
};
