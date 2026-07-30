/* Routes van de dodemansknop: de Thuiswacht ("ik ben over X minuten thuis")
   en de Vitale check-in (medicatie, en simpelweg: leeft u nog).

   Twee apps, dezelfde vier handelingen. De klok loopt op de server; deze
   routes zetten hem alleen aan, schuiven hem op, of zetten hem stil. */
module.exports = (kern) => {
  const { app, auth, liveCodename } = kern;

  // De vriendenlaag (en dus de kring) draait op de sessiesleutel; de codenaam
  // is alleen wat mensen te zien krijgen. Die twee niet verwarren.
  const mij = (req) => req.session.key;
  const uit = (res, r) => res.status(r.status || 200).json(r.error ? { error: r.error } : r);

  app.post('/api/veiligheid/wacht/start', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    uit(res, kern.wachtStart(h, liveCodename(req.session), req.body || {}));
  });

  /* Inchecken: het levensteken. Dit is de knop die het alarm tegenhoudt, en
     bij de Thuiswacht ook "ik ben thuis" betekent (dan gaat een rustoptie die
     daaraan hangt vanzelf uit). */
  app.post('/api/veiligheid/wacht/checkin', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    uit(res, kern.veiligCheckin(h, req.body.id));
  });

  app.post('/api/veiligheid/wacht/verleng', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    uit(res, kern.wachtVerlengen(h, req.body.id, req.body.minuten));
  });

  app.post('/api/veiligheid/wacht/stop', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    uit(res, kern.wachtStop(h, req.body.id));
  });

  app.post('/api/veiligheid/wacht', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    res.json(kern.wachtenVan(h));
  });
};
