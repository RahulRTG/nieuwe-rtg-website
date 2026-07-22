/* Routes "aanmeldgesprek": Rahuls gesprek in plaats van het aanmeldformulier.
   Bewust VOOR de inlog (wie zich aanmeldt, heeft nog geen account), daarom
   met een eigen, strak slot per IP: het gesprek is goedkoop, maar niet gratis
   te bestoken. Het gesprek levert aan het eind de velden voor de ene echte
   registratieroute (/api/auth/register); registreren zelf blijft daar. */
module.exports = (kern) => {
  const { app, intakeStart, intakeZeg, accounts, stateFor } = kern;

  // klein slot per IP: hooguit 40 berichten per minuut (een mens haalt dat niet)
  const tempo = new Map();
  function teSnel(ip) {
    const nu = Date.now();
    const t = tempo.get(ip) || { n: 0, tot: nu + 60000 };
    if (nu > t.tot) { t.n = 0; t.tot = nu + 60000; }
    t.n++;
    tempo.set(ip, t);
    if (tempo.size > 5000) tempo.clear(); // vangnet tegen geheugengroei
    return t.n > 40;
  }

  app.post('/api/aanmeld/start', (req, res) => {
    if (teSnel(req.ip)) return res.status(429).json({ error: 'Rustig aan; probeer het over een minuut opnieuw.' });
    res.json(intakeStart());
  });

  app.post('/api/aanmeld/zeg', (req, res) => {
    if (teSnel(req.ip)) return res.status(429).json({ error: 'Rustig aan; probeer het over een minuut opnieuw.' });
    const r = intakeZeg(String((req.body || {}).id || ''), (req.body || {}).tekst);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    // de sleutelwoorden-inlog is server-side geverifieerd; hier munten we de
    // echte sessie (dezelfde token als /api/auth/login zou geven). Het
    // wachtwoord-pad blijft bij de client, die roept /auth/login zelf aan.
    if (r.inlog && accounts && stateFor) {
      const user = accounts.getUserById(r.inlog.userId);
      if (!user) return res.status(401).json({ error: 'Inloggen lukte net niet; probeer het opnieuw.' });
      const token = accounts.issueToken(user.id);
      const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
      return res.json({ tekst: r.tekst, ingelogd: true, token, state: stateFor(sess, (req.body || {}).lang) });
    }
    res.json(r);
  });
};
