/* Sparren (kern/fluister/sparren.js): Rahul denkt mee om het idee beter te
   maken, en parkeert een gedachte die je noemt op een druk moment. Op een
   rustig moment (thuis, lege agenda) kaart hij hem uit zichzelf weer aan.

   Afgesplitst uit ./persoonlijk.js toen dat tegen de omvangband van
   keuringsregel `omvang` aan zat. De naad is echt: dit gaat over een gedachte
   die je parkeert, en niet over de Rahul-beurt zelf. Zelfde patroon als
   ./persoonlijk-assets.js en ./persoonlijk-care.js. */
module.exports = (kern) => {
  const { app, auth } = kern;
  const { sparLijst, sparParkeer, sparStatus } = kern.fluister;

  app.post('/api/spar/lijst', auth, (req, res) => res.json(sparLijst(req.session.key)));
  app.post('/api/spar/parkeer', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const r = sparParkeer(req.session.key, req.body.tekst, 'app');
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/spar/status', auth, (req, res) => {
    const st = req.body.status === 'weg' ? 'weg' : 'besproken';
    const r = sparStatus(req.session.key, String(req.body.id || ''), st);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
};
