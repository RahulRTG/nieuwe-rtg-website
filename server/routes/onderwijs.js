/* RTG School: dunne routes op kern/onderwijs.js -- de officiële ladder, het
   leerpaspoort dat een leven lang meegaat, inschrijven en overgaan, en de
   behaalde leerdoelen. Altijd-aan gemount; via de stuur-laag ook voor Rahul
   bereikbaar ("schrijf me in voor havo", "waar sta ik op de ladder?"). */
module.exports = (kern) => {
  const { app, auth, onderwijs, vervolg } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  // golf 3: het niveau-advies -- adviseert op doelen en examentraining, beslist nooit
  app.post('/api/onderwijs/advies', auth, (req, res) => stuur(res, vervolg.advies(req.session.key)));

  app.post('/api/onderwijs/ladder', auth, (req, res) => stuur(res, onderwijs.ladder()));
  app.post('/api/onderwijs/mijn', auth, (req, res) => stuur(res, onderwijs.mijn(req.session.key)));
  app.post('/api/onderwijs/inschrijf', auth, (req, res) => stuur(res, onderwijs.inschrijf(req.session.key, req.body || {})));
  app.post('/api/onderwijs/jaar-over', auth, (req, res) => stuur(res, onderwijs.jaarOver(req.session.key)));
  app.post('/api/onderwijs/doel', auth, (req, res) => stuur(res, onderwijs.doelBehaald(req.session.key, req.body || {})));
};
