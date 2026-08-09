/* Routes "life": het ene scherm (kern/life.js). Een verzoek, en daarin staat
   alles wat RTG over vandaag te zeggen heeft -- uit lagen die het lid al had.
   Er wordt hier niets vastgelegd; dit is puur lezen. */
module.exports = (kern) => {
  const { app, auth, liveCodename, lifeVoor } = kern;

  app.post('/api/life', auth, (req, res) =>
    res.json(lifeVoor(req.session.key, liveCodename(req.session))));
};
