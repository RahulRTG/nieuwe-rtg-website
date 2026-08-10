/* Routes "gedachten": het gedachtenboek van het lid (kern/gedachten.js).

   Drie routes, alle drie van het lid zelf: lezen, opschrijven, weggooien. Er is
   met opzet geen vierde. Geen samenvatten, geen "vat mijn week samen", geen
   deel-route en niets dat deze tekst langs de AI-poort voert -- dat zou van een
   dagboek materiaal maken. */
module.exports = (kern) => {
  const { app, auth, gedachtenVan, gedachteZet, gedachteWeg } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };

  app.post('/api/gedachten', auth, (req, res) => stuur(res, gedachtenVan(req.session.key)));
  app.post('/api/gedachten/zet', auth, (req, res) => stuur(res, gedachteZet(req.session.key, req.body || {})));
  app.post('/api/gedachten/weg', auth, (req, res) => stuur(res, gedachteWeg(req.session.key, (req.body || {}).id)));
};
