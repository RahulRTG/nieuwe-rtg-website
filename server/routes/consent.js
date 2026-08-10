/* Routes "consent": het Consent Center (kern/consent.js). Lezen wie wat mag, en
   het bij de bron intrekken. Alleen voor het lid zelf; er staat hier niets dat
   een zaak of een kantoor kan opvragen. */
module.exports = (kern) => {
  const { app, auth, consentVan, consentIntrek } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };

  app.post('/api/toestemming', auth, (req, res) => stuur(res, consentVan(req.session.key)));
  app.post('/api/toestemming/intrek', auth, (req, res) => stuur(res, consentIntrek(req.session.key, req.body || {})));
};
