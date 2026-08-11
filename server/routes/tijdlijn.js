/* Route "tijdlijn": wat er in de tijd met het lid gebeurd is (kern/tijdlijn.js).

   EEN route, en die leest alleen. Er is geen /zet en geen /voeg-toe: deze laag
   bezit niets. Wie hier iets wil laten verschijnen, zet het in de laag waar het
   thuishoort -- anders staat er een gebeurtenis in de tijdlijn die nergens
   anders bestaat, en dat is precies het tweede dossier dat niet mag ontstaan. */
module.exports = (kern) => {
  const { app, auth, liveCodename, tijdlijnVoor } = kern;

  app.post('/api/tijdlijn', auth, (req, res) =>
    res.json(tijdlijnVoor(req.session.key, liveCodename(req.session))));
};
