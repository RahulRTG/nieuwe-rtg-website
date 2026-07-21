/* Domein "bieb": de bibliothecaris van de echte RTG Bibliotheek in de Mall.
   Voor iedereen die is ingelogd, ook de gratis gast: advies vragen mag
   altijd; wat je vervolgens mag installeren bepalen de bibliotheek-routes. */
module.exports = (kern) => {
  const { app, auth, bibliothecaris } = kern;

  app.post('/api/bieb/ai', auth, async (req, res) => {
    try {
      const r = await bibliothecaris.adviseer(String((req.body || {}).vraag || ''), { wereld: 'mall' });
      const { status, ...rest } = r;
      res.status(status || 200).json(rest);
    } catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
