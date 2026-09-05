/* LivingOS Samen-routes. Alleen de eerste toetreding gebruikt de deelcode;
   alle kamermutaties daarna zijn object-scoped op de niet-geheime kamer-id. */
'use strict';

module.exports = kern => {
  const { app, auth, liveCodename, samen, tooManyTries,
    noteFailedTry, loginFails } = kern;
  const geenGast = (req, res) => {
    if (req.session.tier !== 'guest') return false;
    res.status(403).json({ error: 'Samen-sessies zijn voor leden.' });
    return true;
  };
  const idem = req => String(((req.body || {}).idem ||
    (req.get && req.get('idempotency-key')) || '')).slice(0, 200);
  const status = r => Number.isInteger(r && r.status) && r.status >= 100 && r.status <= 599
    ? r.status : 200;
  const handel = async (res, werk) => {
    try {
      const r = await Promise.resolve(werk());
      return res.status(status(r)).json(r && r.error ? { error: r.error } : r);
    } catch (e) {
      /* Een storagefout kan na een credentialclaim optreden. Het foutobject
         wordt daarom nooit gelogd: route en 503 zijn voldoende. */
      console.error('[samen] veilige verwerking mislukt');
      return res.status(503).json({ error: 'Samen kon niet veilig worden verwerkt.' });
    }
  };
  const lid = (req, res) => geenGast(req, res) ? null : liveCodename(req.session);

  app.post('/api/samen/maak', auth, async (req, res) => {
    const codenaam = lid(req, res); if (!codenaam) return;
    await handel(res, () => samen.maak(req.session.key, codenaam, idem(req)));
  });
  app.post('/api/samen/mee', auth, async (req, res) => {
    const codenaam = lid(req, res); if (!codenaam) return;
    const bucket = 'samen-code:' + req.ip;
    if (tooManyTries && tooManyTries(res, bucket)) return;
    let r;
    try { r = await Promise.resolve(samen.doeMee(req.session.key, codenaam, (req.body || {}).code)); }
    catch (e) {
      console.error('[samen] veilige verwerking mislukt');
      return res.status(503).json({ error: 'Samen kon niet veilig worden verwerkt.' });
    }
    if (r && r.error && r.status !== 503 && noteFailedTry) noteFailedTry(bucket, req.ip);
    else if (r && !r.error && loginFails) loginFails.delete(bucket);
    return res.status(status(r)).json(r && r.error ? { error: r.error } : r);
  });
  app.post('/api/samen/code', auth, async (req, res) => {
    if (!lid(req, res)) return;
    await handel(res, () => samen.roteer(req.session.key, (req.body || {}).id, idem(req)));
  });
  app.post('/api/samen/zet', auth, async (req, res) => {
    if (!lid(req, res)) return;
    const b = req.body || {};
    await handel(res, () => samen.zet(req.session.key, b.id, b.pad, b.titel));
  });
  app.post('/api/samen/chat', auth, async (req, res) => {
    if (!lid(req, res)) return;
    const b = req.body || {};
    await handel(res, () => samen.chat(req.session.key, b.id, b.tekst));
  });
  app.post('/api/samen/muziek', auth, async (req, res) => {
    if (!lid(req, res)) return;
    const b = req.body || {};
    await handel(res, () => samen.muziek(req.session.key, b.id, b.media));
  });
  app.post('/api/samen/weg', auth, async (req, res) => {
    if (!lid(req, res)) return;
    await handel(res, () => samen.weg(req.session.key, (req.body || {}).id));
  });
  app.post('/api/samen/sluit', auth, async (req, res) => {
    if (!lid(req, res)) return;
    await handel(res, () => samen.sluit(req.session.key, (req.body || {}).id));
  });
  app.post('/api/samen/staat', auth, async (req, res) => {
    if (!lid(req, res)) return;
    await handel(res, () => samen.staat(req.session.key, (req.body || {}).id));
  });
};
