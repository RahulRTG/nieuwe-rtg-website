/* Routes "aanmeldgesprek": Rahuls gesprek in plaats van het aanmeldformulier.
   Bewust VOOR de inlog (wie zich aanmeldt, heeft nog geen account), daarom
   met een eigen, strak slot per IP: het gesprek is goedkoop, maar niet gratis
   te bestoken. Het gesprek levert aan het eind de velden voor de ene echte
   registratieroute (/api/auth/register); registreren zelf blijft daar. */
module.exports = (kern) => {
  const { app, intakeStart, intakeZeg } = kern;

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
    res.json(r);
  });
};
