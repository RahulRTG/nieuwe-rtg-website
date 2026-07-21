/* Routes "luchthaven": RTG Airport (kern/luchthaven.js).
   - Het luchthavenpersoneel (supplier LUCHT, roster-login): vluchtleiding,
     platform (de draai), toren (klaring), bagagekelder en security.
   - Leden: het vertrek/aankomstbord, een vlucht boeken, inchecken (boarding
     pass op codenaam) en de eigen boekingen met kofferstatus.
   Operationele routes achter supplierAuth + type luchthaven; ledenroutes
   achter de gewone sessie-auth. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, liveCodename, lucht } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  function poort(req, res, next) {
    if (!lucht.isLucht(req.supplier)) return res.status(403).json({ error: 'Alleen voor het luchthavenpersoneel.' });
    next();
  }
  const wie = req => (req.actor && req.actor.name) || 'operations';

  /* ---- de operatie ---- */
  app.post('/api/lucht/cockpit', supplierAuth, poort, (req, res) => res.json(lucht.cockpit()));
  app.post('/api/lucht/bord', supplierAuth, poort, (req, res) => res.json(lucht.bord(req.body || {})));
  app.post('/api/lucht/vlucht/maak', supplierAuth, poort, (req, res) => stuur(res, lucht.vluchtMaak(wie(req), req.body || {})));
  app.post('/api/lucht/vlucht/status', supplierAuth, poort, (req, res) => stuur(res, lucht.vluchtStatus(wie(req), String(req.body.id || ''), String(req.body.status || ''))));
  app.post('/api/lucht/vlucht/vertraag', supplierAuth, poort, (req, res) => stuur(res, lucht.vluchtVertraag(wie(req), String(req.body.id || ''), req.body.minuten, req.body.reden)));
  app.post('/api/lucht/vlucht/gate', supplierAuth, poort, (req, res) => stuur(res, lucht.vluchtGate(wie(req), String(req.body.id || ''), String(req.body.gate || ''))));
  app.post('/api/lucht/draai/taak', supplierAuth, poort, (req, res) => stuur(res, lucht.draaiTaak(wie(req), String(req.body.id || ''), String(req.body.taak || ''))));
  app.post('/api/lucht/toren/klaring', supplierAuth, poort, (req, res) => stuur(res, lucht.torenKlaring(wie(req), String(req.body.id || ''), String(req.body.baan || ''))));
  app.post('/api/lucht/bagage', supplierAuth, poort, (req, res) => res.json(lucht.bagage(req.body || {})));
  app.post('/api/lucht/bagage/zet', supplierAuth, poort, (req, res) => stuur(res, lucht.bagageZet(wie(req), String(req.body.tag || ''), String(req.body.status || ''))));
  app.post('/api/lucht/security/zet', supplierAuth, poort, (req, res) => stuur(res, lucht.securityZet(wie(req), String(req.body.id || ''), req.body || {})));
  app.post('/api/lucht/ai', supplierAuth, poort, async (req, res) => {
    try { res.json(await lucht.luchtAI(String(req.body.vraag || ''))); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* ---- de leden: het bord, boeken, inchecken, mijn reizen ---- */
  const lid = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Alleen voor leden.' }); return false; }
    return true;
  };
  app.post('/api/member/vluchten/bord', auth, (req, res) => res.json(lucht.bord(req.body || {})));
  app.post('/api/member/vluchten/boek', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, lucht.boek(req.session, liveCodename(req.session), String(req.body.id || ''), req.body || {})); });
  app.post('/api/member/vluchten/incheck', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, lucht.incheck(req.session, String(req.body.code || ''), req.body || {})); });
  app.post('/api/member/vluchten/mijn', auth, (req, res) => res.json(lucht.mijn(req.session.key)));
};
