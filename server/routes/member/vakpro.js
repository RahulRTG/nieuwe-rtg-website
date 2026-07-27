/* Member-submodule "vakpro": de offerte-stroom vanuit het lid. Een vrije klus
   aanvragen bij een dienstverlenende zaak (Dienstenplein), de eigen offertes
   volgen, akkoord geven (dan staat de klus als bevestigde boeking klaar,
   betalen loopt daarna gewoon achteraf) of intrekken. Alles op codenaam.
   Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, PERSONAS } = kern;
  const vak = () => kern.vakwerk;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/vak/offerte/vraag', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
    stuur(res, vak().offerteVraag({ key: req.session.key, tier: req.session.tier, codename }, req.body || {}));
  });
  app.post('/api/vak/offertes/mijn', auth, (req, res) => {
    stuur(res, vak().offertesVanLid(req.session.key));
  });
  app.post('/api/vak/offerte/akkoord', auth, (req, res) => {
    stuur(res, vak().offerteAkkoord(req.session.key, req.body || {}));
  });
  app.post('/api/vak/offerte/intrek', auth, (req, res) => {
    stuur(res, vak().offerteIntrek(req.session.key, req.body || {}));
  });

  // vaste afspraken: starten, volgen en altijd kunnen stoppen
  app.post('/api/vak/ritme/start', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
    stuur(res, vak().ritmeStart({ key: req.session.key, tier: req.session.tier, codename }, req.body || {}));
  });
  app.post('/api/vak/ritmes/mijn', auth, (req, res) => stuur(res, vak().ritmesVanLid(req.session.key)));
  app.post('/api/vak/ritme/stop', auth, (req, res) => {
    stuur(res, vak().ritmeStop({ key: req.session.key }, (req.body || {}).id));
  });

  // de wachtlijst: een seintje bij een vrijgekomen plek; boeken doet u zelf
  app.post('/api/vak/wachtlijst/zet', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
    stuur(res, vak().wachtZet({ key: req.session.key, tier: req.session.tier, codename }, req.body || {}));
  });

  // beoordelingen: na een afgeronde klus, een per klus, op codenaam
  app.post('/api/vak/review', auth, (req, res) => stuur(res, vak().reviewGeef(req.session.key, req.body || {})));
  app.post('/api/vak/reviews/open', auth, (req, res) => stuur(res, vak().reviewsOpen(req.session.key)));
};
