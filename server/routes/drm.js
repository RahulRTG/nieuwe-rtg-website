/* Routes "drm": de DRM-route van de contentbescherming (kern/drm.js).
   - /api/drm/capability  welke sleutelsystemen RTG bedient (en het advies)
   - /api/drm/key         de Clear Key-licentie (JWK) voor een lid met recht
   - /api/drm/report      lichte telemetrie over de sleutelsystemen van de client
   Alles achter de leden-auth; de licentie gaat nooit naar gasten. */
module.exports = (kern) => {
  const { app, auth, drm } = kern;

  app.post('/api/drm/capability', auth, (req, res) => res.json(drm.capability()));

  app.post('/api/drm/key', auth, (req, res) => {
    const r = drm.sleutel(req.session, req.body || {});
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  app.post('/api/drm/report', auth, (req, res) => res.json(drm.report(req.session, req.body || {})));
};
