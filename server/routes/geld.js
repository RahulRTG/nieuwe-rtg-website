/* RTG Geld, de samenhanglaag: hoe u er financieel voor staat, uit alle
   gelddomeinen bij elkaar (PLATFORM.md par. 0).

   ALLEEN LEZEN. Betalen, verrekenen en toezeggen blijft in de module die het
   echte werk doet, en deze route heeft er met opzet geen tegenhanger voor. */
module.exports = (kern) => {
  const { app, auth } = kern;

  app.post('/api/geld/wereld', auth, (req, res) =>
    res.json(kern.geldwereld.stand(req.session.key)));
};
