/* Routes "overheid": de behandelkant van De Overheid (kern/overheid.js).
   - Rijksambtenaren (partner-app, ingelogd als de rijks-partner RIJK): de regie,
     toeslagen/uitkeringen/bezwaren beoordelen, bekendmakingen plaatsen en een
     stemming openen of sluiten.
   - Ondernemers (elke ingelogde onderneming): inschrijven in het handelsregister
     (KVK) en het eigen uittreksel opvragen.
   Alles achter supplierAuth; de behandel-routes eisen bovendien dat de ingelogde
   partner het rijk zelf is. */
module.exports = (kern) => {
  const { app, supplierAuth, overheid } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  function rijk(req, res, next) {
    if (!overheid.magBehandelen(req.supplier)) return res.status(403).json({ error: 'Alleen voor het rijk.' });
    next();
  }
  const wie = req => (req.actor && req.actor.name) || 'rijk';

  /* ---- rijksambtenaren ---- */
  app.post('/api/overheid/regie', supplierAuth, rijk, (req, res) => res.json(overheid.regie()));
  app.post('/api/overheid/toeslagen', supplierAuth, rijk, (req, res) => res.json(overheid.toeslagenLijst(req.body || {})));
  app.post('/api/overheid/toeslag/beslis', supplierAuth, rijk, (req, res) => stuur(res, overheid.toeslagBeslis(wie(req), String(req.body.ref || ''), req.body || {})));
  app.post('/api/overheid/uitkeringen', supplierAuth, rijk, (req, res) => res.json(overheid.uitkeringenLijst(req.body || {})));
  app.post('/api/overheid/uitkering/beslis', supplierAuth, rijk, (req, res) => stuur(res, overheid.uitkeringBeslis(wie(req), String(req.body.ref || ''), req.body || {})));
  app.post('/api/overheid/bezwaren', supplierAuth, rijk, (req, res) => res.json(overheid.bezwarenLijst(req.body || {})));
  app.post('/api/overheid/bezwaar/beslis', supplierAuth, rijk, (req, res) => stuur(res, overheid.bezwaarBeslis(wie(req), String(req.body.ref || ''), req.body || {})));
  app.post('/api/overheid/bekendmaking', supplierAuth, rijk, (req, res) => stuur(res, overheid.bekendmakingMaak(wie(req), req.body || {})));
  app.post('/api/overheid/verkiezing/sluit', supplierAuth, rijk, (req, res) => stuur(res, overheid.verkiezingSluit(req.body.open === true)));
  // provincie (subsidies) & waterschap (meldingen)
  app.post('/api/overheid/subsidies/lijst', supplierAuth, rijk, (req, res) => res.json(overheid.subsidiesLijst(req.body || {})));
  app.post('/api/overheid/subsidie/beslis', supplierAuth, rijk, (req, res) => stuur(res, overheid.subsidieBeslis(wie(req), String(req.body.ref || ''), req.body || {})));
  app.post('/api/overheid/water/meldingen', supplierAuth, rijk, (req, res) => res.json(overheid.waterMeldingenLijst(req.body || {})));
  app.post('/api/overheid/water/melding/zet', supplierAuth, rijk, (req, res) => stuur(res, overheid.waterMeldingZet(wie(req), String(req.body.ref || ''), req.body || {})));

  /* ---- ondernemers: inschrijven in het handelsregister als onderneming ---- */
  app.post('/api/supplier/overheid/kvk/inschrijven', supplierAuth, (req, res) =>
    stuur(res, overheid.kvkInschrijven({ supplierCode: req.supplier.code, bedrijf: req.supplier.name }, req.body || {})));
  app.post('/api/supplier/overheid/kvk/mijn', supplierAuth, (req, res) => res.json(overheid.kvkMijn({ supplierCode: req.supplier.code })));
  app.post('/api/supplier/overheid/bekendmakingen', supplierAuth, (req, res) => res.json(overheid.bekendmakingen()));
  // een onderneming vraagt zelf een provinciale subsidie aan en volgt hem
  app.post('/api/supplier/overheid/subsidie', supplierAuth, (req, res) =>
    stuur(res, overheid.subsidieAanvraag({ supplierCode: req.supplier.code, bedrijf: req.supplier.name }, req.body || {})));
  app.post('/api/supplier/overheid/subsidies', supplierAuth, (req, res) => res.json(overheid.mijnSubsidies({ supplierCode: req.supplier.code })));
};
