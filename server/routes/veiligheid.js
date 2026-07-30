/* Routes van RTG Veilig: het gedeelde beeld, de kring en de plek. De drie
   app-specifieke stukken (wacht, codewoord, rust) staan in ./veiligheid/.

   Alles loopt op de sessiesleutel van het lid en op codenamen, nooit op een
   echte naam of een telefoonnummer: die blijven in de kluis. */
module.exports = (kern) => {
  const { app, auth, liveCodename } = kern;

  // De vriendenlaag (en dus de kring) draait op de sessiesleutel; de codenaam
  // is alleen wat mensen te zien krijgen. Die twee niet verwarren.
  const mij = (req) => req.session.key;
  const uit = (res, r) => res.status(r.status || 200).json(r.error ? { error: r.error } : r);

  // Het volledige beeld: alle vier de apps beginnen hiermee.
  app.post('/api/veiligheid', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    res.json(kern.veiligBeeld(h));
  });

  /* ---- de kring ---- */
  app.post('/api/veiligheid/kring', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    res.json({ kring: kern.kringToon(h) });
  });

  app.post('/api/veiligheid/kring/toevoegen', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    uit(res, kern.kringToevoegen(h, req.body.handle, { locatie: req.body.locatie !== false }));
  });

  app.post('/api/veiligheid/kring/aanpassen', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    uit(res, kern.kringAanpassen(h, req.body.handle, { locatie: req.body.locatie !== false }));
  });

  app.post('/api/veiligheid/kring/verwijderen', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    uit(res, kern.kringVerwijderen(h, req.body.handle));
  });

  app.post('/api/veiligheid/kring/mail', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    uit(res, req.body.weg ? kern.kringMailVerwijderen(h, req.body.adres) : kern.kringMailToevoegen(h, req.body.adres));
  });

  /* ---- de plek ----
     De app stuurt hier zijn positie zolang er iets loopt. Dit is het
     "levensteken" waar de hele opzet op rust: valt het toestel uit, dan is de
     laatste melding wat de kring krijgt. */
  app.post('/api/veiligheid/plek', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    uit(res, kern.plekMelden(h, req.body || {}));
  });

  /* ---- zelf alarm slaan, en afsluiten ---- */
  app.post('/api/veiligheid/alarm', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    const proef = req.body.proef === true;
    uit(res, kern.alarmSlaan({
      handle: h, codenaam: liveCodename(req.session), soort: proef ? 'proef' : 'knop',
      notitie: req.body.notitie, proef
    }));
  });

  app.post('/api/veiligheid/alarm/afsluiten', auth, (req, res) => {
    const h = mij(req);
    if (!h) return res.status(403).json({ error: 'Log eerst in.' });
    uit(res, kern.alarmAfsluiten(h, req.body.id, req.body.hoe));
  });

  require('./veiligheid/wacht')(kern);
  require('./veiligheid/codewoord')(kern);
  require('./veiligheid/rust')(kern);
};
