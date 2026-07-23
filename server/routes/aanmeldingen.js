/* Routes voor de aanmeldingen per pas. De aanvraag zelf mag iedereen indienen
   (een aanstaande aanvrager is nog geen lid); de AI verzorgt daarna automatisch
   de hele reis. De wachtrij en de ENE menselijke handeling -- accepteren of
   afwijzen -- zitten achter de office-inlog (RTG-personeel). */
module.exports = (kern) => {
  const { app, officeAuth, aanmeldingen, tooManyTries } = kern;
  const veilig = (res, werk) => { try { const r = werk(); res.status(r && r.status ? r.status : 200).json(r); } catch (e) { console.error('[aanmeldingen]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); } };
  const wie = req => { const s = req.session || {}; return s.codename || (s.account && s.account.codename) || s.naam || 'RTG-personeel'; };

  // een aanvraag indienen (publiek, met een lichte rem tegen misbruik)
  app.post('/api/aanmelding/aanvraag', (req, res) => {
    if (tooManyTries && tooManyTries(res, 'aanmelding:' + req.ip)) return;
    veilig(res, () => aanmeldingen.aanvraag(req.body || {}));
  });

  // de wachtrij en het besluit: alleen RTG-personeel
  app.post('/api/aanmelding/lijst', officeAuth, (req, res) => veilig(res, () => aanmeldingen.lijst((req.body || {}).status)));
  app.post('/api/aanmelding/een', officeAuth, (req, res) => veilig(res, () => aanmeldingen.een(String((req.body || {}).id || ''))));
  app.post('/api/aanmelding/beslis', officeAuth, (req, res) => veilig(res, () =>
    aanmeldingen.beslis(String((req.body || {}).id || ''), String((req.body || {}).besluit || ''), wie(req), (req.body || {}).notitie)));
};
