/* Routes van de Reiswijzer: alle reisregels van elk land van de wereld, voor
   iedereen met een sessie (ook de gratis app -- veilig reizen is voor
   iedereen). Het reisbureau en het partnerkanaal reiken de wijzer daarnaast
   AUTOMATISCH uit bij een boeking (zie winkel.js en partnerkanaal.js). */
module.exports = (kern) => {
  const { app, auth, reiswijzer, reisLanden } = kern;

  app.post('/api/reis/wijzer', auth, (req, res) => {
    const r = reiswijzer(req.body.land || req.body.bestemming);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  app.post('/api/reis/landen', auth, (req, res) => res.json({ landen: reisLanden() }));

  /* RTG Reizen, de samenhanglaag: uw komende reis uit alle reisdomeinen bij
     elkaar. Alleen lezen -- boeken, wijzigen en annuleren blijft in de
     gespecialiseerde app, en deze route heeft er geen tegenhanger voor. */
  app.post('/api/reis/wereld', auth, (req, res) => res.json(kern.reiswereld.komend(req.session.key)));
};
