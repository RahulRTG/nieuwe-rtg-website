/* Domein "samen": meekijken en samen doen door het hele leden-OS. Alles
   achter de leden-inlog en op codenaam; gasten kijken niet mee. De widget
   (shared/metgezel.js) praat hiermee en luistert via /api/stream naar de
   'samen'-seintjes. */
module.exports = (kern) => {
  const { app, auth, liveCodename, samen } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Samen-sessies zijn voor leden.' }); return true; }
    return false;
  };

  app.post('/api/samen/maak', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, samen.maak(req.session.key, liveCodename(req.session)));
  });
  app.post('/api/samen/mee', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, samen.doeMee(req.session.key, liveCodename(req.session), req.body.code));
  });
  app.post('/api/samen/zet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, samen.zet(req.session.key, req.body.code, req.body.pad, req.body.titel));
  });
  app.post('/api/samen/chat', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, samen.chat(req.session.key, req.body.code, req.body.tekst));
  });
  app.post('/api/samen/weg', auth, (req, res) => stuur(res, samen.weg(req.session.key, req.body.code)));
  app.post('/api/samen/staat', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, samen.staat(req.session.key, req.body.code));
  });
};
