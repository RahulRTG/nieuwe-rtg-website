/* RTG Sociaal, de samenhanglaag: wat er tussen u en de mensen om u heen speelt
   (laag 2 uit PLATFORM.md).

   ALLEEN LEZEN. Praten, plaatsen en aanmelden blijft in de gespecialiseerde
   app -- Berichten, Genootschap, Pulse -- en deze route heeft er met opzet
   geen tegenhanger voor. */
module.exports = (kern) => {
  const { app, auth } = kern;

  app.post('/api/sociaal/wereld', auth, (req, res) =>
    res.json(kern.socialewereld.kring(req.session.key)));
};
