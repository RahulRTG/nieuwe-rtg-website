/* RTG School: dunne routes op kern/leerstof.js -- de leerlijn per groep, de
   les in gewone taal, en de oefensessie met antwoorden op de server. Via de
   stuur-laag ook voor Rahul bereikbaar ("geef me een les breuken",
   "overhoor me de tafel van 7"). */
module.exports = (kern) => {
  const { app, auth, leerstof } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/leerstof/vakken', auth, (req, res) => stuur(res, leerstof.leerstofVakken(req.session.key, req.body || {})));
  app.post('/api/leerstof/les', auth, (req, res) => stuur(res, leerstof.leerstofLes(req.body || {})));
  app.post('/api/leerstof/oefen', auth, (req, res) => stuur(res, leerstof.leerstofOefenStart(req.session.key, req.body || {})));
  app.post('/api/leerstof/antwoord', auth, (req, res) => stuur(res, leerstof.leerstofOefenAntwoord(req.session.key, req.body || {})));
};
