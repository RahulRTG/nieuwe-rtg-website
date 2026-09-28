/* Van een betaalde pas naar gast (server/kern/aanmeldingen/naargast.js, besluit C5).

   Drie deuren op een kern. Het LID kiest zelf nu of aan het eind van zijn periode;
   wie hij is komt uit zijn token en nooit uit het lichaam. Het KANTOOR zet een pas
   naar gast op naam en met een reden. De SCHAKELAARS van de automatische regels
   zet alleen de eigenaar, en de ronde mag de boardroom met de hand draaien. */
'use strict';

module.exports = (kern) => {
  const { app, auth, boardroomAuth, boardroomWie, accounts, aanmeldingen } = kern;
  const ng = () => aanmeldingen.naarGast;
  const stuur = (res, r) => (r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r));
  const ikBen = req => {
    try {
      const h = req.get('authorization') || '';
      const u = h.startsWith('Bearer ') && accounts.verifyToken(h.slice(7));
      return u ? u.id : null;
    } catch (e) { return null; }
  };

  app.post('/api/mijn/pas/gast', auth, (req, res) => {
    const id = ikBen(req);
    if (id == null) return res.status(404).json({ error: 'Deze sessie hangt niet aan een RTG-account.' });
    const wanneer = String((req.body || {}).wanneer || '');
    if (wanneer === 'nu') return stuur(res, ng().lidNu(id));
    if (wanneer === 'einde') return stuur(res, ng().lidEinde(id));
    res.status(400).json({ error: 'Kies nu, of aan het eind van je periode (einde).' });
  });

  app.post('/api/office/pas/gast', boardroomAuth, (req, res) => {
    const b = req.body || {};
    stuur(res, ng().kantoor(b.accountId, boardroomWie(req), b.reden));
  });

  app.post('/api/office/pas/gast/regels', boardroomAuth, (req, res) =>
    res.json({ ok: true, regels: ng().regels() }));
  app.post('/api/office/pas/gast/regels/zet', boardroomAuth, (req, res) => {
    if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar zet een automatische regel aan of uit.' });
    const b = req.body || {};
    stuur(res, ng().regelZet(String(b.regel || ''), b, boardroomWie(req)));
  });
  app.post('/api/office/pas/gast/ronde', boardroomAuth, (req, res) =>
    res.json(Object.assign({ ok: true }, ng().ronde())));
};
