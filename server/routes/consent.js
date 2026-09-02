/* Routes "consent": het Consent Center (kern/consent.js). Lezen wie wat mag, en
   het bij de bron intrekken. Alleen voor het lid zelf; er staat hier niets dat
   een zaak of een kantoor kan opvragen. */
module.exports = (kern) => {
  const { app, auth, consentVan, consentIntrek, relatiesVan, gevolgenVan, relatieSluit } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };

  app.post('/api/toestemming', auth, (req, res) => stuur(res, consentVan(req.session.key)));
  app.post('/api/toestemming/intrek', auth, (req, res) => stuur(res, consentIntrek(req.session.key, req.body || {})));

  /* ---- de firewall: hetzelfde consent, per partij ----
     Drie routes en drie stappen, met opzet in die volgorde: zien, gevolgen
     bekijken, en pas dan sluiten. Sluiten zonder de tussenstap kan wel (de
     route staat los), maar het scherm loopt hem altijd langs -- een handeling
     die niet terug te draaien is, hoort niet in een tik te gebeuren. */
  app.post('/api/toestemming/relaties', auth, (req, res) => stuur(res, relatiesVan(req.session.key)));
  app.post('/api/toestemming/relatie/gevolgen', auth, (req, res) =>
    stuur(res, gevolgenVan(req.session.key, String((req.body || {}).partij || ''))));
  app.post('/api/toestemming/relatie/sluit', auth, (req, res) =>
    stuur(res, relatieSluit(req.session.key, String((req.body || {}).partij || ''))));
};
