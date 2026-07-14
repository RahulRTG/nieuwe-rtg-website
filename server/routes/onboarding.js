/* Routes voor de verplichte onboarding + het contract. Drie soorten gebruikers:
   - elk lid/gast: de eigen status opvragen, gegevens opslaan en tekenen (scope 'rtg');
   - de eigenaar: de platform-eisen en het platformcontract lezen en aanpassen
     (met de hand of met AI);
   - elke leverancier/school: hetzelfde voor de EIGEN scope (hun eigen mensen). */
module.exports = (kern) => {
  const { app, express, auth, accounts, eigenaar, onboarding, supplierAuth, managerOnly, tooManyTries } = kern;

  function eigenaarAlleen(req, res) {
    if (!eigenaar.isEigenaar(accounts, req.session && req.session.account)) {
      res.status(403).json({ error: 'Alleen de eigenaar beheert de platform-onboarding.' });
      return false;
    }
    return true;
  }

  /* ---------- elk lid / elke gast (scope 'rtg') ---------- */
  app.post('/api/onboarding/status', auth, (req, res) => {
    res.json(onboarding.status('rtg', req.session));
  });
  app.post('/api/onboarding/opslaan', express.json({ limit: '256kb' }), auth, (req, res) => {
    res.json(onboarding.slaOp('rtg', req.session, req.body.velden || {}));
  });
  app.post('/api/onboarding/teken', auth, (req, res) => {
    const r = onboarding.teken('rtg', req.session, req.body.naam, req.body.akkoord === true);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });

  /* ---------- de eigenaar: de platform-eisen + contract beheren ---------- */
  app.post('/api/onboarding/config', auth, (req, res) => {
    if (!eigenaarAlleen(req, res)) return;
    res.json({ config: onboarding.config('rtg'), ondertekenaars: onboarding.ondertekenaars('rtg').slice(0, 50) });
  });
  app.post('/api/onboarding/config/zet', express.json({ limit: '256kb' }), auth, (req, res) => {
    if (!eigenaarAlleen(req, res)) return;
    res.json({ ok: true, config: onboarding.zetConfig('rtg', req.body.voorstel || {}) });
  });
  app.post('/api/onboarding/config/ai', express.json({ limit: '64kb' }), auth, async (req, res) => {
    if (!eigenaarAlleen(req, res)) return;
    if (tooManyTries && tooManyTries(res, 'onbAi:' + req.ip)) return;
    const opdracht = String(req.body.opdracht || '').slice(0, 1000);
    if (opdracht.length < 3) return res.status(400).json({ error: 'Beschrijf wat u wilt aanpassen.' });
    try { res.json(await onboarding.aiPasAan('rtg', opdracht)); }
    catch (e) { res.status(500).json({ error: 'Aanpassen mislukte.' }); }
  });

  /* ---------- elke leverancier/school: de eigen scope ---------- */
  app.post('/api/supplier/onboarding/config', supplierAuth, (req, res) => {
    res.json({ config: onboarding.config(req.supplier.code), ondertekenaars: onboarding.ondertekenaars(req.supplier.code).slice(0, 50) });
  });
  app.post('/api/supplier/onboarding/zet', express.json({ limit: '256kb' }), supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    res.json({ ok: true, config: onboarding.zetConfig(req.supplier.code, req.body.voorstel || {}) });
  });
  app.post('/api/supplier/onboarding/ai', express.json({ limit: '64kb' }), supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    if (tooManyTries && tooManyTries(res, 'supOnbAi:' + req.ip)) return;
    const opdracht = String(req.body.opdracht || '').slice(0, 1000);
    if (opdracht.length < 3) return res.status(400).json({ error: 'Beschrijf wat u wilt aanpassen.' });
    try { res.json(await onboarding.aiPasAan(req.supplier.code, opdracht)); }
    catch (e) { res.status(500).json({ error: 'Aanpassen mislukte.' }); }
  });
};
