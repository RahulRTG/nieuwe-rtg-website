/* RTG Meet: de code opent alleen de eerste toetreding. Daarna gebruikt een
   geautoriseerd lid de niet-geheime kamer-id. Alle storagefouten falen dicht. */
'use strict';

module.exports = (kern) => {
  const { app, meet, auth, tooManyTries, noteFailedTry, loginFails } = kern;
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest' && !req.session.account) {
      res.status(403).json({ error: 'Maak een gratis account om te vergaderen.' });
      return true;
    }
    return false;
  };
  const status = r => Number.isInteger(r && r.status) && r.status >= 100 && r.status <= 599 ? r.status : 200;
  const handel = async (res, werk) => {
    try {
      const r = await Promise.resolve(werk());
      res.status(status(r)).json(r);
      return r;
    } catch (e) {
      /* Het foutobject kan uit de storage komen na een codeclaim. Schrijf het
         daarom niet uit; route + 503 zijn genoeg voor de operationele teller. */
      console.error('[meet] veilige verwerking mislukt');
      const r = { status: 503, error: 'Meet kon niet veilig worden verwerkt. Probeer het later opnieuw.' };
      res.status(503).json({ error: r.error });
      return r;
    }
  };
  const idem = req => String(((req.body || {}).idem || req.get('idempotency-key') || '')).slice(0, 200);

  app.post('/api/meet/mijn', auth, async (req, res) =>
    handel(res, () => meet.meetMijn(req.session.key)));
  app.post('/api/meet/maak', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    await handel(res, () => meet.meetMaak(req.session.key, req.body || {}, idem(req)));
  });
  app.post('/api/meet/kom', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {}, metCode = !!String(b.code || '').trim();
    const bucket = 'meet-code:' + req.ip;
    if (metCode && tooManyTries && tooManyTries(res, bucket)) return;
    const r = await handel(res, () => meet.meetKom(req.session.key,
      metCode ? { code: b.code } : { id: b.id }));
    if (metCode && r && r.error && r.status !== 503 && noteFailedTry) noteFailedTry(bucket, req.ip);
    else if (metCode && r && !r.error && loginFails) loginFails.delete(bucket);
  });
  app.post('/api/meet/code', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    await handel(res, () => meet.meetCode(req.session.key, (req.body || {}).id, idem(req)));
  });
  app.post('/api/meet/verlaat', auth, async (req, res) =>
    handel(res, () => meet.meetVerlaat(req.session.key, String((req.body || {}).id || ''))));
  app.post('/api/meet/weg', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    await handel(res, () => meet.meetWeg(req.session.key, String((req.body || {}).id || '')));
  });
  app.post('/api/meet/sein', auth, async (req, res) =>
    handel(res, () => meet.meetSein(req.session.key, req.body || {})));
};
