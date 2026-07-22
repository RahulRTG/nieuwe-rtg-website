/* Routes "aanmeldgesprek": Rahuls gesprek in plaats van het aanmeldformulier.
   Bewust VOOR de inlog (wie zich aanmeldt, heeft nog geen account), daarom
   met een eigen, strak slot per IP: het gesprek is goedkoop, maar niet gratis
   te bestoken. Het gesprek levert aan het eind de velden voor de ene echte
   registratieroute (/api/auth/register); registreren zelf blijft daar.

   Rahul spreekt in de TAAL VAN HET TOESTEL: de motor denkt in het Nederlands
   (een bron, testbaar), en hier vertalen we zijn antwoord naar de taal die de
   app meestuurt. Lukt die taal niet, dan Engels als terugval, en anders het
   Nederlandse origineel (nooit een kapot scherm). Het begrijpen van niet-
   Nederlandse invoer blijft aan de motor zelf. */
const vertaler = require('../translate');

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

  // Rahuls Nederlandse zin naar de toesteltaal; anders Engels, anders NL.
  async function naarTaal(tekst, lang) {
    if (!tekst || !lang || lang === 'nl') return tekst;
    try {
      const en = (await vertaler.translate(tekst, 'en', 'nl')).text;
      if (lang === 'en') return en;
      const loc = await vertaler.translate(tekst, lang, 'nl');
      return loc.translated ? loc.text : en; // toesteltaal, anders Engels
    } catch (e) { return tekst; }
  }

  app.post('/api/aanmeld/start', async (req, res) => {
    if (teSnel(req.ip)) return res.status(429).json({ error: 'Rustig aan; probeer het over een minuut opnieuw.' });
    const r = intakeStart();
    r.tekst = await naarTaal(r.tekst, (req.body || {}).lang);
    res.json(r);
  });

  app.post('/api/aanmeld/zeg', async (req, res) => {
    if (teSnel(req.ip)) return res.status(429).json({ error: 'Rustig aan; probeer het over een minuut opnieuw.' });
    const lang = (req.body || {}).lang;
    const r = intakeZeg(String((req.body || {}).id || ''), (req.body || {}).tekst);
    if (r.error) return res.status(r.status || 400).json({ error: await naarTaal(r.error, lang) });
    // de sleutelwoorden-inlog is server-side geverifieerd; hier munten we de
    // echte sessie (dezelfde token als /api/auth/login zou geven). Het
    // wachtwoord-pad blijft bij de client, die roept /auth/login zelf aan.
    if (r.inlog && accounts && stateFor) {
      const user = accounts.getUserById(r.inlog.userId);
      if (!user) return res.status(401).json({ error: await naarTaal('Inloggen lukte net niet; probeer het opnieuw.', lang) });
      const token = accounts.issueToken(user.id);
      const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
      return res.json({ tekst: await naarTaal(r.tekst, lang), ingelogd: true, token, state: stateFor(sess, lang) });
    }
    r.tekst = await naarTaal(r.tekst, lang);
    res.json(r);
  });
};
