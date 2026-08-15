/* Magnaat Wereld heeft twee deuren: spelers komen binnen met hun ledenpas;
   de Future Engine en testfases zitten achter de menselijke boardroom-poort. */
module.exports = (kern) => {
  const { app, auth, geenGast, boardroomAuth, supplierAuth, managerOnly, magnaatWereld, magnaatPartnerstudio } = kern;
  const stuur = (res, r) => r && r.error
    ? res.status(r.status || 400).json({ error: r.error, taak: r.taak })
    : res.json(r);
  const veilig = async (res, werk) => {
    try { stuur(res, await werk()); }
    catch (e) { console.error('[magnaat-wereld]', e); res.status(500).json({ error: 'Magnaat Wereld kon deze stap niet verwerken.' }); }
  };
  const alsLid = (req, res, werk) => {
    if (geenGast(req, res)) return;
    return veilig(res, () => werk(req.session.key, req.body || {}));
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
  app.post('/api/member/magnaat/economie/analyse', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.economieAnalyse(key, b)));
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
  app.post('/api/member/magnaat/partner/start', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.partnerTrainingStart(key, b.code)));
  app.post('/api/member/magnaat/partner/stap', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.partnerTrainingAntwoord(key, b.trainingId, b.keuze)));
  app.post('/api/member/magnaat/teamkamer/mijn', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.teamkamerMijn(key, b.id)));
  app.post('/api/member/magnaat/teamkamer/maak', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.teamkamerMaak(key, b)));
  app.post('/api/member/magnaat/teamkamer/deelnemen', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.teamkamerDeelnemen(key, b.code)));
  app.post('/api/member/magnaat/teamkamer/rol', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.teamkamerRol(key, b.id, b.rolId, b.revisie)));
  app.post('/api/member/magnaat/teamkamer/start', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.teamkamerStart(key, b.id, b.revisie, b.commandoId)));
  app.post('/api/member/magnaat/teamkamer/actie', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.teamkamerActie(key, b.id, b)));
  app.post('/api/member/magnaat/teamkamer/bedien', auth, (req, res) => alsLid(req, res,
    (key, b) => magnaatWereld.teamkamerBedien(key, b.id, b.actie, b.revisie, b.commandoId)));

  const alsPartner = (req, res, werk, manager = true) => {
    if (manager && !managerOnly(req, res)) return;
    return veilig(res, () => werk(req.supplier, req.actor, req.body || {}));
  };
  app.post('/api/supplier/magnaat/studio', supplierAuth, (req, res) =>
    alsPartner(req, res, supplier => magnaatPartnerstudio.overzicht(supplier), false));
  app.post('/api/supplier/magnaat/studio/profiel', supplierAuth, (req, res) =>
    alsPartner(req, res, (supplier, actor, b) => magnaatPartnerstudio.profielZet(supplier, actor, b)));
  app.post('/api/supplier/magnaat/studio/bouwsteen', supplierAuth, (req, res) =>
    alsPartner(req, res, (supplier, actor, b) => magnaatPartnerstudio.bouwsteenZet(supplier, actor, b.soort, b)));
  app.post('/api/supplier/magnaat/studio/bouwsteen/weg', supplierAuth, (req, res) =>
    alsPartner(req, res, (supplier, actor, b) => magnaatPartnerstudio.bouwsteenWeg(supplier, actor, b.soort, b)));
  app.post('/api/supplier/magnaat/studio/importeer', supplierAuth, (req, res) =>
    alsPartner(req, res, (supplier, actor, b) => magnaatPartnerstudio.importeer(supplier, actor, b)));
  app.post('/api/supplier/magnaat/studio/proef/start', supplierAuth, (req, res) =>
    alsPartner(req, res, (supplier, actor) => magnaatPartnerstudio.proefStart(supplier, actor)));
  app.post('/api/supplier/magnaat/studio/proef/stap', supplierAuth, (req, res) =>
    alsPartner(req, res, (supplier, actor, b) => magnaatPartnerstudio.proefAntwoord(supplier, actor, b.trainingId, b.keuze)));
  app.post('/api/supplier/magnaat/studio/relatie', supplierAuth, (req, res) =>
    alsPartner(req, res, (supplier, actor, b) => magnaatPartnerstudio.relatieVraag(supplier, actor, b)));
  app.post('/api/supplier/magnaat/studio/relatie/beslis', supplierAuth, (req, res) =>
    alsPartner(req, res, (supplier, actor, b) => magnaatPartnerstudio.relatieBeslis(supplier, actor, b)));
  app.post('/api/supplier/magnaat/studio/indienen', supplierAuth, (req, res) =>
    alsPartner(req, res, (supplier, actor, b) => magnaatPartnerstudio.indienen(supplier, actor, b)));
  app.post('/api/supplier/magnaat/studio/indienen/intrekken', supplierAuth, (req, res) =>
    alsPartner(req, res, (supplier, actor) => magnaatPartnerstudio.indieningIntrekken(supplier, actor)));

  const wie = req => req.boardroomKey || 'boardroom';
  const boardroomActor = req => ({
    sleutel: wie(req), naam: req.boardroomBaas ? 'RTG-eigenaar' : wie(req),
    rol: req.boardroomBaas ? 'publicist' : 'controleur'
  });
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
  app.post('/api/office/magnaat/controle/gaten/plan', boardroomAuth, (req, res) => veilig(res,
    () => magnaatWereld.boardroomControlePlanGaten(wie(req), req.body || {})));
  app.post('/api/office/magnaat/partners', boardroomAuth, (req, res) => veilig(res,
    () => magnaatPartnerstudio.boardroomLijst(boardroomActor(req))));
  app.post('/api/office/magnaat/partner/beslis', boardroomAuth, (req, res) => veilig(res,
    () => magnaatPartnerstudio.boardroomBeslis(req.body.code, req.body.actie, boardroomActor(req), req.body.notitie,
      { hash: req.body.hash, versie: req.body.versie })));
};
