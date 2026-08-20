/* Routes voor de dynamische, gesloten RTG-code (kern/dyncode.js).

   - POST /api/code/dyn   geeft een verse, ondertekende code uit (kort houdbaar).
   - POST /api/code/scan  verifieert een gescande code en zegt wat het is.

   Beide zitten achter een app-sessie: alleen een ingelogd lid, een zaak of het
   personeel kan een code maken of verifieren. Een generieke QR-lezer die enkel
   "RTG1.xxxx" oppikt, komt hier niet langs -- zo werkt de code alleen via onze
   eigen app. De echte actie (afrekenen, inchecken) blijft in de bestaande
   routes; dit levert alleen de geverifieerde soort + code terug. */
module.exports = (kern) => {
  const { app, express, resolveSession, sessionFor, dyncode } = kern;

  /* Een geldige app-sessie: een lid (account/demo-pas) of een zaak-/personeels-
     /kantoorsessie. Stond hier als eigen functie tot er een tweede deur kwam die
     dezelfde vraag stelt (/api/link/los); nu doet kern/link/wie.js het voor
     allebei. Twee eigen uitrekeningen van "wie klopt er aan" zijn twee
     antwoorden, en dan is de vraag welke klopt (LAT.md regel 4). */
  const appSessie = require('../kern/link/wie')({ sessionFor, resolveSession });

  // welke codesoorten een actor mag uitgeven (de code zelf is geen geheim; de
  // echte controle zit bij het afrekenen/inchecken)
  const MAG = {
    lid: ['kas', 'pas', 'zegel'],
    supplier: ['tafel', 'entree', 'deur'],
    staff: ['tafel', 'entree', 'deur'],
    office: ['tafel', 'entree', 'deur', 'kas', 'pas', 'zegel']
  };

  app.post('/api/code/dyn', express.json({ limit: '4kb' }), (req, res) => {
    const sess = appSessie(req);
    if (!sess) return res.status(401).json({ error: 'Niet ingelogd.' });
    const soort = String(req.body && req.body.soort || '').toLowerCase();
    const mag = MAG[sess.soort] || [];
    if (!mag.includes(soort)) return res.status(403).json({ error: 'Deze codesoort mag u niet maken.' });
    try {
      const c = dyncode.maak({ soort, code: req.body.code, ttlMs: req.body.ttlMs });
      res.json({ token: c.token, soort: c.soort, exp: c.exp, ttlMs: c.ttlMs });
    } catch (e) { res.status(400).json({ error: 'Kon de code niet maken.' }); }
  });

  app.post('/api/code/scan', express.json({ limit: '4kb' }), (req, res) => {
    const sess = appSessie(req);
    if (!sess) return res.status(401).json({ error: 'Niet ingelogd.' });
    const r = dyncode.lees(req.body && req.body.token);
    if (!r.ok) {
      const status = r.reden === 'verlopen' ? 410 : 422;
      return res.status(status).json({ ok: false, reden: r.reden,
        error: r.reden === 'verlopen' ? 'Deze code is verlopen. Laat een verse code tonen.'
             : 'Dit is geen geldige RTG-code.' });
    }
    res.json({ ok: true, soort: r.soort, code: r.code, exp: r.exp });
  });
};
