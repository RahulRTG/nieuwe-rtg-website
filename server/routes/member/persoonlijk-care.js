/* Domein "member", deelmodule persoonlijk-care: Toren 4, RTG Care (kern/care.js).
   Zorg & welzijn: spa's, wellness en klinieken. Een behandeling boeken bij
   een behandelaar in een tijdslot; het zorgprofiel reist mee en een aparte,
   veilige intake kan uitdrukkelijk (en tijdelijk) met een aanbieder worden
   gedeeld. Betalen loopt via careBetaal (RTG Pay-punten via verdienPunten).
   Afgesplitst uit persoonlijk.js zodat elk deel klein blijft. */
module.exports = (kern) => {
  const { app, auth, liveCodename, verdienPunten,
    careOverzicht, careBoek, careBetaal, careAnnuleer, careMijn, careIntakeDeel, careIntakeStop,
    carePakketOverzicht, carePakketBoek, carePakketBetaal, carePakketMijn } = kern;

  app.post('/api/care', auth, (req, res) => res.json(careOverzicht(req.session.key)));
  app.post('/api/care/boek', auth, (req, res) => {
    const r = careBoek(req.session, liveCodename(req.session), req.body);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/care/betaal', auth, (req, res) => {
    const r = careBetaal(req.session, req.body.ref, verdienPunten);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/care/annuleer', auth, (req, res) => {
    const r = careAnnuleer(req.session.key, req.body.ref);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/care/mijn', auth, (req, res) => res.json(careMijn(req.session.key)));
  // de veilige, aparte intake-deling met een aanbieder (uitdrukkelijk, tijdelijk)
  app.post('/api/care/intake/deel', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const r = careIntakeDeel(req.session.key, req.body.aanbiederId, req.body.medisch);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/care/intake/stop', auth, (req, res) => {
    const r = careIntakeStop(req.session.key, req.body.id);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  /* Herstel- & verblijfpakketten: een behandeling gekoppeld aan een hotelverblijf,
     als een pakket met een prijs. De behandeling boekt gewoon in de agenda. */
  app.post('/api/care/pakketten', auth, (req, res) => res.json(carePakketOverzicht()));
  app.post('/api/care/pakket/boek', auth, (req, res) => {
    const r = carePakketBoek(req.session, liveCodename(req.session), req.body);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/care/pakket/betaal', auth, (req, res) => {
    const r = carePakketBetaal(req.session, req.body.ref, verdienPunten);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/care/pakket/mijn', auth, (req, res) => res.json(carePakketMijn(req.session.key)));
};
