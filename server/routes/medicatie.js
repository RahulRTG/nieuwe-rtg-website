/* Routes "medicatie": het eigen medicatieschema van het lid (kern/medicatie.js).

   Alle vijf de routes zijn van het lid zelf. Er is met opzet geen route waarmee
   een zaak, een kantoor of een behandelaar het schema van iemand anders opvraagt
   of aanpast: een voorschrijver werkt in zijn eigen systeem, en RTG gaat niet
   over dosering. Wie hier ooit een zesde route bij zet, verandert wat dit is. */
module.exports = (kern) => {
  const { app, auth, medicatieVan, medicatieZet, medicatieWeg, medicatieAf, medicatieVoorraad } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  const lijf = req => req.body || {};

  app.post('/api/medicatie', auth, (req, res) => stuur(res, medicatieVan(req.session.key)));
  app.post('/api/medicatie/zet', auth, (req, res) => stuur(res, medicatieZet(req.session.key, lijf(req))));
  app.post('/api/medicatie/weg', auth, (req, res) => stuur(res, medicatieWeg(req.session.key, lijf(req).id)));
  app.post('/api/medicatie/af', auth, (req, res) => stuur(res,
    medicatieAf(req.session.key, lijf(req).id, lijf(req).moment, lijf(req).aan !== false)));
  app.post('/api/medicatie/voorraad', auth, (req, res) => stuur(res,
    medicatieVoorraad(req.session.key, lijf(req).id, lijf(req).aantal)));
};
