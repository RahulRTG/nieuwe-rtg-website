/* De dunne HTTP-laag van het Experience Platform. Alle mutaties gaan naar de
   Action Broker; projections blijven alleen-lezen. */
'use strict';

module.exports = kern => {
  const { app, auth, experience } = kern;
  const { principalVoorSession } = require('../kern/economie/identiteit');
  const lid = (req, res, next) => req.session.tier === 'guest'
    ? res.status(403).json({ error: 'Het persoonlijke Experience Platform is voor ingelogde leden.' })
    : next();
  const stuur = (res, r) => {
    if (!r || r.error) return res.status((r && r.status) || 400).json({
      error: (r && r.error) || 'Onbekende fout.', code: r && r.code
    });
    res.json(r);
  };

  app.post('/api/experience/bootstrap', auth, lid, (req, res) =>
    stuur(res, experience.bootstrap({ key: req.session.key, world: req.body.world,
      contextId: req.body.contextId, economicPrincipalRef: principalVoorSession(req.session) })));

  app.post('/api/experience/projection', auth, lid, (req, res) =>
    stuur(res, experience.projection({ key: req.session.key, world: req.body.world,
      contextId: req.body.contextId, economicPrincipalRef: principalVoorSession(req.session) })));

  app.post('/api/experience/resume', auth, lid, (req, res) =>
    stuur(res, experience.resumeZet(req.session.key, req.body || {})));

  app.post('/api/experience/intent/preview', auth, lid, (req, res) =>
    stuur(res, experience.preview(req.session.key, req.body || {}, principalVoorSession(req.session))));

  app.post('/api/experience/intent/execute', auth, lid, async (req, res) => {
    try { stuur(res, await experience.execute(req.session.key, req.body || {})); }
    catch (e) { res.status(500).json({ error: 'De actie kon niet betrouwbaar worden afgerond.' }); }
  });

  app.post('/api/experience/evidence', auth, lid, (req, res) =>
    stuur(res, experience.evidence(req.session.key, Number(req.body.limit) || 25)));
};
