/* Magnaat Wereld heeft twee deuren: spelers komen binnen met hun ledenpas;
   de Future Engine en testfases zitten achter de menselijke boardroom-poort. */
module.exports = (kern) => {
  const { app, auth, geenGast, boardroomAuth, magnaatWereld } = kern;
  const stuur = (res, r) => r && r.error
    ? res.status(r.status || 400).json({ error: r.error, taak: r.taak })
    : res.json(r);
  const veilig = (res, werk) => {
    try { stuur(res, werk()); }
    catch (e) { console.error('[magnaat-wereld]', e); res.status(500).json({ error: 'Magnaat Wereld kon deze stap niet verwerken.' }); }
  };
  const alsLid = (req, res, werk) => {
    if (geenGast(req, res)) return;
    veilig(res, () => werk(req.session.key, req.body || {}));
  };

  app.post('/api/member/magnaat/overzicht', auth, (req, res) => alsLid(req, res, key => magnaatWereld.overzicht(key)));
  app.post('/api/member/magnaat/taak/start', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.taakStart(key, b.functieId, b.apparaat)));
  app.post('/api/member/magnaat/taak/antwoord', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.taakAntwoord(key, b.taakId, b.keuze)));
  app.post('/api/member/magnaat/taak/handeling', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.taakHandeling(key, b.taakId, b.handeling)));
  app.post('/api/member/magnaat/taak/actie', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.taakActie(key, b.taakId, b.invoer)));
  app.post('/api/member/magnaat/kantoor/kies', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.kiesKantoor(key, b.kantoorId, b.rol)));
  app.post('/api/member/magnaat/werkproces/start', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.werkprocesStart(key, b.workflowId, b.apparaat)));
  app.post('/api/member/magnaat/economie/beslis', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.economieBeslis(key, b)));
  app.post('/api/member/magnaat/economie/volgende-dag', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.economieVolgendeDag(key, b.commandoId)));
  app.post('/api/member/magnaat/economie/schok', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.economieSchok(key, b.schokId)));
  app.post('/api/member/magnaat/controle/overzicht', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.controleOverzicht(key, b)));
  app.post('/api/member/magnaat/controle/zet', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.controleZet(key, b.puntId, b.wijziging)));
  app.post('/api/member/magnaat/controle/taak/maak', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.controleTaakMaak(key, b.puntId, b.invoer)));
  app.post('/api/member/magnaat/controle/taak/zet', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.controleTaakZet(key, b.taakId, b.status, b.bewijs)));
  app.post('/api/member/magnaat/controle/zelftest', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.controleZelftest(key, b.puntId)));

  const wie = req => req.boardroomKey || 'boardroom';
  app.post('/api/office/magnaat/status', boardroomAuth, (req, res) => veilig(res, () => magnaatWereld.kantoorStatus()));
  app.post('/api/office/magnaat/scan', boardroomAuth, (req, res) => veilig(res,
    () => magnaatWereld.scan(wie(req), true)));
  app.post('/api/office/magnaat/beslis', boardroomAuth, (req, res) => veilig(res,
    () => magnaatWereld.beslis(req.body.id, req.body.actie, wie(req), req.body.notitie)));
  app.post('/api/office/magnaat/controle/overzicht', boardroomAuth, (req, res) => veilig(res,
    () => magnaatWereld.boardroomControleOverzicht(wie(req), req.body || {})));
  app.post('/api/office/magnaat/controle/zet', boardroomAuth, (req, res) => veilig(res,
    () => magnaatWereld.boardroomControleZet(wie(req), req.body.puntId, req.body.wijziging || {})));
  app.post('/api/office/magnaat/controle/taak/maak', boardroomAuth, (req, res) => veilig(res,
    () => magnaatWereld.boardroomControleTaakMaak(wie(req), req.body.puntId, req.body.invoer || {})));
  app.post('/api/office/magnaat/controle/taak/zet', boardroomAuth, (req, res) => veilig(res,
    () => magnaatWereld.boardroomControleTaakZet(wie(req), req.body.taakId, req.body.status, req.body.bewijs)));
  app.post('/api/office/magnaat/controle/zelftest', boardroomAuth, (req, res) => veilig(res,
    () => magnaatWereld.boardroomControleZelftest(wie(req), req.body.puntId)));
};
