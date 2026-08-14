module.exports = (kern) => {
  const { app, officeAuth, boardroomWie, boardroomBaas, accounts, rtgone } = kern;
  const actor = req => boardroomWie(req) || (req.actor && req.actor.name) || 'kantoor';
  const context = req => {
    const key = boardroomWie(req); let label = key || 'Gedeelde kantoorcode', codename = null;
    if (key && String(key).startsWith('user-')) { const u = accounts.getUserById(Number(String(key).slice(5))); if (u) { codename = u.codename || null; label = u.codename || key; } }
    return { key, label, codename, baas: boardroomBaas(key) };
  };
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const veilig = (res, werk) => { try { stuur(res, werk()); } catch (e) { console.error('[rtgone]', e); res.status(500).json({ error: 'RTG One kon de handeling niet verwerken.' }); } };
  app.post('/api/rtgone/state', officeAuth, (req, res) => veilig(res, () => rtgone.state(req.body.huis, context(req))));
  app.post('/api/rtgone/intentie', officeAuth, (req, res) => veilig(res, () => rtgone.intentieMaak(req.body || {}, actor(req))));
  app.post('/api/rtgone/belofte', officeAuth, (req, res) => veilig(res, () => rtgone.belofteMaak(req.body || {}, actor(req))));
  app.post('/api/rtgone/frictie', officeAuth, (req, res) => veilig(res, () => rtgone.frictieMaak(req.body || {}, actor(req))));
  app.post('/api/rtgone/overdracht', officeAuth, (req, res) => veilig(res, () => rtgone.overdrachtMaak(req.body || {}, actor(req))));
  app.post('/api/rtgone/goedkeuring', officeAuth, (req, res) => veilig(res, () => rtgone.goedkeuringMaak(req.body || {}, context(req))));
  app.post('/api/rtgone/goedkeuring/beslis', officeAuth, (req, res) => veilig(res, () => rtgone.goedkeuringBeslis(req.body.id, req.body.besluit, context(req))));
  app.post('/api/rtgone/rol/geef', officeAuth, (req, res) => veilig(res, () => rtgone.rolGeef(req.body || {}, context(req))));
  app.post('/api/rtgone/rol/trek', officeAuth, (req, res) => veilig(res, () => rtgone.rolTrek(req.body.id, context(req))));
  app.post('/api/rtgone/project/van-mail', officeAuth, (req, res) => veilig(res, () => rtgone.projectVanMail(req.body || {}, context(req))));
  app.post('/api/rtgone/project/taak', officeAuth, (req, res) => veilig(res, () => rtgone.projectTaakZet(req.body.id, req.body.taakId, req.body.af, context(req))));
  app.post('/api/rtgone/automatisering/voorbereid', officeAuth, (req, res) => veilig(res, () => rtgone.automatiseringVoorbereid(req.body || {}, actor(req))));
  app.post('/api/rtgone/automatisering/voer', officeAuth, (req, res) => veilig(res, () => rtgone.automatiseringVoer(req.body.id, actor(req))));
  app.post('/api/rtgone/automatisering/herstel', officeAuth, (req, res) => veilig(res, () => rtgone.automatiseringHerstel(req.body.id, actor(req))));
};
