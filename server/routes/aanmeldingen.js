/* Routes voor de aanmeldingen per pas. De aanvraag zelf mag iedereen indienen
   (een aanstaande aanvrager is nog geen lid); de AI verzorgt daarna automatisch
   de hele reis. De wachtrij en de ENE menselijke handeling -- accepteren of
   afwijzen -- zitten achter de office-inlog (RTG-personeel). */
module.exports = (kern) => {
  const { app, officeAuth, aanmeldingen, accounts, tooManyTries, boardroomWie } = kern;
  const veilig = (res, werk) => { try { const r = werk(); res.status(r && r.status ? r.status : 200).json(r); } catch (e) { console.error('[aanmeldingen]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); } };
  /* WIE HEEFT DIT BESLOTEN?

     Hier stond `req.session.codename || ... || 'RTG-personeel'`. Deze routes
     staan achter officeAuth, en die zet req.session HELEMAAL NIET -- dus viel
     hij niet soms maar ALTIJD terug op 'RTG-personeel'. Elk pasbesluit ooit
     genomen draagt die naam, en dat is geen naam.

     Het wrange is dat de kern het al eist: beslis() weigert een `door` van
     minder dan twee tekens met "een besluit draagt altijd de naam van de mens
     die beslist". Die grendel stond er dus, en werd verslagen door een terugval
     die altijd slaagt.

     boardroomWie geeft de sleutel van wie er echt achter zit: het lid-account
     dat aan de backoffice gekoppeld is, of de eigenaar met zijn eigen inlog.
     Bij de kale gedeelde kantoorcode is er niemand aan te wijzen, en dan is
     null het eerlijke antwoord -- de kern beslist wat daarmee mag, want die
     kent de pas waar het over gaat. Zelfde patroon als bij RTG Bank. */
  const wie = req => boardroomWie(req) || null;
  // Is er een geldig leden-token meegestuurd? Dan koppelen we dat account aan de
  // aanvraag (server-side, nooit uit de body), zodat een menselijk akkoord op een
  // Lifestyle/Business-aanvraag dat account kan optillen.
  const aanvragerVan = req => {
    try {
      const h = req.get('authorization') || '';
      const tok = h.startsWith('Bearer ') ? h.slice(7) : null;
      const u = tok && accounts && accounts.verifyToken(tok);
      return u ? u.id : null;
    } catch (e) { return null; }
  };

  // een aanvraag indienen (publiek, met een lichte rem tegen misbruik)
  app.post('/api/aanmelding/aanvraag', (req, res) => {
    if (tooManyTries && tooManyTries(res, 'aanmelding:' + req.ip)) return;
    veilig(res, () => aanmeldingen.aanvraag(req.body || {}, aanvragerVan(req)));
  });

  // de wachtrij en het besluit: alleen RTG-personeel
  app.post('/api/aanmelding/lijst', officeAuth, (req, res) => veilig(res, () => aanmeldingen.lijst((req.body || {}).status)));
  app.post('/api/aanmelding/een', officeAuth, (req, res) => veilig(res, () => aanmeldingen.een(String((req.body || {}).id || ''))));
  app.post('/api/aanmelding/beslis', officeAuth, (req, res) => veilig(res, () =>
    aanmeldingen.beslis(String((req.body || {}).id || ''), String((req.body || {}).besluit || ''), wie(req), (req.body || {}).notitie)));
  // het betaalschema: na een akkoord loopt de bijdrage 12 maanden automatisch,
  // met de 30%-foundationsplit. Alleen voor het personeel.
  app.post('/api/aanmelding/betalingen', officeAuth, (req, res) => veilig(res, () => aanmeldingen.betalingen(req.body || {})));
  // een termijn aftekenen als voldaan (administratieve bevestiging, geen
  // betaalclaim); de eerste voldane termijn zet een ondernemerszaak klaar
  app.post('/api/aanmelding/termijn-voldaan', officeAuth, (req, res) => veilig(res, () =>
    aanmeldingen.termijnVoldaan(String((req.body || {}).id || ''), (req.body || {}).maand, wie(req))));
};
