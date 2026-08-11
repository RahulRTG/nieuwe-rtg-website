/* Routes "trainingsschema": het eigen schema van het lid
   (kern/trainingsschema.js; niet te verwarren met server/training.js, de
   micro-learning voor personeel in de PDA).

   Vijf routes, alle vijf van het lid zelf. Er is geen route waarmee een coach,
   een club of een zaak het schema van iemand anders leest of aanpast: een coach
   die meekijkt is een toestemmingslaag met een einddatum, en die bestaat hier
   nog niet. Zie docs/life.md. */
module.exports = (kern) => {
  const { app, auth, trainingVan, trainingZet, trainingWeg, trainingDeed, trainingWegGedaan } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  const lijf = req => req.body || {};

  app.post('/api/training', auth, (req, res) => stuur(res, trainingVan(req.session.key)));
  app.post('/api/training/zet', auth, (req, res) => stuur(res, trainingZet(req.session.key, lijf(req))));
  app.post('/api/training/weg', auth, (req, res) => stuur(res, trainingWeg(req.session.key, lijf(req).id)));
  app.post('/api/training/deed', auth, (req, res) => stuur(res, trainingDeed(req.session.key, lijf(req))));
  app.post('/api/training/deed-weg', auth, (req, res) =>
    stuur(res, trainingWegGedaan(req.session.key, lijf(req).id)));
};
