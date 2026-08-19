/* RTG School: dunne routes op kern/leerstof.js -- de leerlijn per groep, de
   les in gewone taal, en de oefensessie met antwoorden op de server. Via de
   stuur-laag ook voor Rahul bereikbaar ("geef me een les breuken",
   "overhoor me de tafel van 7"). */
module.exports = (kern) => {
  const { app, auth, leerstof, vervolg } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/leerstof/vakken', auth, (req, res) => stuur(res, leerstof.leerstofVakken(req.session.key, req.body || {})));
  app.post('/api/leerstof/les', auth, (req, res) => stuur(res, leerstof.leerstofLes(req.session.key, req.body || {})));
  /* De weg naar een leerdoel: wat ligt eronder, en wat daarvan is nog niet af.
     Dit is het antwoord op "waarom lukt dit niet" dat geen percentage geeft. */
  app.post('/api/leerstof/pad', auth, (req, res) => stuur(res, leerstof.leerstofPad(req.session.key, req.body || {})));
  app.post('/api/leerstof/oefen', auth, (req, res) => stuur(res, leerstof.leerstofOefenStart(req.session.key, req.body || {})));
  app.post('/api/leerstof/antwoord', auth, (req, res) => stuur(res, leerstof.leerstofOefenAntwoord(req.session.key, req.body || {})));
  // golf 3: examentraining (terugblik pas aan het eind, zoals een echt examen)
  app.post('/api/leerstof/examen', auth, (req, res) => stuur(res, vervolg.examenStart(req.session.key, req.body || {})));
  app.post('/api/leerstof/examen-antwoord', auth, (req, res) => stuur(res, vervolg.examenAntwoord(req.session.key, req.body || {})));
};
