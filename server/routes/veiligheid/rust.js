/* Routes van "Niet storen tot thuis" en de andere rustopties.

   De veiligheidsbaan zit niet hier maar in kern/veilig/rust.js (magDoor):
   meldingen met scope 'veiligheid', en alles wat uit je eigen kring komt,
   gaan er altijd doorheen. Deze routes zetten alleen de stand. */
module.exports = (kern) => {
  const { app, auth, liveCodename } = kern;

  // De vriendenlaag (en dus de kring) draait op de sessiesleutel; de codenaam
  // is alleen wat mensen te zien krijgen. Die twee niet verwarren.
  const mij = (req) => req.session.key;
  const uit = (res, r) => res.status(r.status || 200).json(r.error ? { error: r.error } : r);

  app.post('/api/veiligheid/rust', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    res.json({ rust: kern.rustStand(h) });
  });

  app.post('/api/veiligheid/rust/aan', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    uit(res, kern.rustAan(h, req.body || {}));
  });

  app.post('/api/veiligheid/rust/uit', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    uit(res, kern.rustUit(h));
  });
};
