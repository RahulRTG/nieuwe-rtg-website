/* Routes "voeding": het weekplan van het lid (kern/voeding.js).

   Drie routes, alle drie van het lid zelf. Er is met opzet geen vierde die iets
   telt, iets beoordeelt of een gerecht "veilig" noemt: alleen de keuken weet wat
   er in de pan ging. Uw allergenen reizen al mee naar de zaak waar u bestelt
   (kern/gastzorg.js); daar staat een mens, en dat is de weg die werkt. */
module.exports = (kern) => {
  const { app, auth, voedingVan, voedingZet, voedingWeg } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  const lijf = req => req.body || {};

  app.post('/api/voeding', auth, (req, res) => stuur(res, voedingVan(req.session.key)));
  app.post('/api/voeding/zet', auth, (req, res) => stuur(res, voedingZet(req.session.key, lijf(req))));
  app.post('/api/voeding/weg', auth, (req, res) => stuur(res, voedingWeg(req.session.key, lijf(req).id)));
};
