/* Domein "kantoorpakket": RTG Office, het eigen kantoorpakket van het lid
   (tekstdocumenten en rekenbladen). Achter de leden-inlog; de bewaar-route
   heeft een ruimere body-limiet omdat een kantoortekst of rekenblad groter
   mag zijn. Los van de RTG-backoffice (/api/office); dit pakket hangt onder
   /api/kantoorpakket. */
module.exports = (kern) => {
  const { app, auth, express, officeMijn, officeMaak, officeOpen, officeBewaar, officeDeel, officeWeg } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG Office is voor leden.' }); return true; }
    return false;
  };
  const ruim = express.json({ limit: '600kb' });

  app.post('/api/kantoorpakket/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, officeMijn(req.session.key));
  });
  app.post('/api/kantoorpakket/maak', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, officeMaak(req.session.key, req.body || {}));
  });
  app.post('/api/kantoorpakket/open', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, officeOpen(req.session.key, req.body.id));
  });
  app.post('/api/kantoorpakket/bewaar', ruim, auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, officeBewaar(req.session.key, req.body.id, req.body || {}));
  });
  app.post('/api/kantoorpakket/deel', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await officeDeel(req.session.key, req.body.id, req.body.codenaam, req.body.aan !== false));
  });
  app.post('/api/kantoorpakket/weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, officeWeg(req.session.key, req.body.id));
  });
};
