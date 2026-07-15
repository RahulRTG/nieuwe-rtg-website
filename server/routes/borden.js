/* Borden-routes: het gedeelde werkbord voor elke zaak (per bord kies je de
   collega's; leeg = het hele team) en voor Business Pass-leden (eigen
   projectborden). Twee dunne ingangen op dezelfde motor (kern/borden.js):
   - POST /api/supplier/borden en /api/supplier/bord  (personeel, per zaak)
   - POST /api/member/borden en /api/member/bord      (Business Pass, per lid)
   Elke wijziging gaat live rond via SSE (scope "borden"). */
const { maakBorden } = require('../kern/borden');

module.exports = (kern) => {
  const { app, db, save, crypto, auth, supplierAuth, sseToSupplier, logActivity } = kern;
  const motor = maakBorden({ db, save, crypto });

  /* de wijzig-acties van een bord: een werkwoord + de velden erbij; zo blijft
     de API een geheel en de client-code overal identiek */
  function voerUit(borden, b, actie, body, wie) {
    switch (actie) {
      case 'maak': return motor.bordMaak(borden, body.naam, wie);
      case 'hernoem': return motor.bordHernoem(b, body.naam);
      case 'leden': return motor.bordLeden(b, body.leden);
      case 'weg': return motor.bordWeg(borden, b.id);
      case 'lijst': return motor.lijstMaak(b, body.naam);
      case 'lijst-bewerk': return motor.lijstBewerk(b, body.lijstId, { naam: body.naam, weg: body.weg });
      case 'kaart': return motor.kaartMaak(b, body.lijstId, body.titel, wie);
      case 'kaart-bewerk': return motor.kaartBewerk(b, body.kaartId, body);
      case 'kaart-zet': return motor.kaartZet(b, body.kaartId, body.naarLijstId, body.pos);
      case 'kaart-weg': return motor.kaartWeg(b, body.kaartId);
      default: return { status: 400, error: 'Onbekende actie.' };
    }
  }

  // ---- de zaak: borden per bedrijf, zichtbaar per bord-lidmaatschap ----
  app.post('/api/supplier/borden', supplierAuth, (req, res) => {
    const borden = motor.bak('borden', req.supplier.code);
    const manager = req.actor.role === 'manager' || !req.actor.staffId;
    res.json({ ok: true, borden: motor.zichtbaar(borden, req.actor.staffId || null, manager) });
  });
  app.post('/api/supplier/bord', supplierAuth, (req, res) => {
    const borden = motor.bak('borden', req.supplier.code);
    const actie = String(req.body.actie || '');
    let b = null;
    if (actie !== 'maak') {
      b = motor.bordVind(borden, String(req.body.id || ''));
      if (!b) return res.status(404).json({ error: 'Bord niet gevonden.' });
      const manager = req.actor.role === 'manager' || !req.actor.staffId;
      if (!manager && (b.leden || []).length && !b.leden.includes(req.actor.staffId))
        return res.status(403).json({ error: 'U zit niet in de groep van dit bord.' });
      if (actie === 'weg' && !manager)
        return res.status(403).json({ error: 'Alleen de manager verwijdert een bord.' });
    }
    const r = voerUit(borden, b, actie, req.body, req.actor.name);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    if (actie === 'maak') logActivity(req.supplier.code, req.actor, 'maakte het bord "' + r.bord.naam + '"');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'borden' });
    res.json(r);
  });

  // ---- het lid: eigen projectborden bij de Business Pass ----
  function lidBak(req) { return motor.bak('bordenLid', req.session.key); }
  const lidOk = (req, res) => {
    if (req.session.tier !== 'business') { res.status(403).json({ error: 'Borden zijn onderdeel van de Business Pass.' }); return false; }
    return true;
  };
  app.post('/api/member/borden', auth, (req, res) => {
    if (!lidOk(req, res)) return;
    res.json({ ok: true, borden: lidBak(req) });
  });
  app.post('/api/member/bord', auth, (req, res) => {
    if (!lidOk(req, res)) return;
    const borden = lidBak(req);
    const actie = String(req.body.actie || '');
    let b = null;
    if (actie !== 'maak') {
      b = motor.bordVind(borden, String(req.body.id || ''));
      if (!b) return res.status(404).json({ error: 'Bord niet gevonden.' });
    }
    const r = voerUit(borden, b, actie, req.body, null);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
};
