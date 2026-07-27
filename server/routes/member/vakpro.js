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
};
