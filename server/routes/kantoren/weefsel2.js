/* Kantoren, deel "weefsel2": de bestuurskant van het stadsweefsel.

   Waar kantoren/weefsel.js de operatie bedient (objecten, zaken, werk), gaat
   dit over wat je ermee STUURT: onderhoudsplanning, contracten en hun SLA's,
   stedelijke indicatoren, de begroting van doel tot uitkomst, energie, klimaat
   en de wat-als-vragen.

   Twee dingen die hier anders zijn dan in het eerste deel.

   1. HET GUNNEN VAN WERK EN HET GEVEN VAN EEN ENERGIE-OPDRACHT ZIJN BESLUITEN.
      Ze dragen een naam, en bij zware gevallen twee namen (vier ogen), en ze
      staan allebei in het auditlog met wat er is besloten en waarom.
   2. HET ALGORITMEREGISTER IS OPENBAAR. Dat is geen vergissing: een register
      dat alleen achter een kantoorinlog te lezen is, geeft een inwoner precies
      niets. Hij staat daarom in routes/stad.js bij de bewonerskant, en niet
      hier. */
module.exports = (ctx) => {
  const { app, officeAuth, veilig, afdelingen, kern } = ctx;
  const w = kern.weefsel;
  const naam = req => (req.body && req.body.naam ? String(req.body.naam) : 'boardroom');

  // ---- onderhoud: kijken, plannen, en met naam gunnen ----
  app.post('/api/office/weefsel/onderhoud', officeAuth, (req, res) => veilig(res, () => w.weefselOnderhoud({
    gebied: req.body.gebied, soort: req.body.soort, minScore: req.body.minScore })));
  app.post('/api/office/weefsel/onderhoud/plan', officeAuth, (req, res) => veilig(res, () => w.weefselOnderhoudPlan({
    gebied: req.body.gebied, soort: req.body.soort, max: req.body.max })));
  app.post('/api/office/weefsel/onderhoud/gun', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselOnderhoudGun({ objectIds: req.body.objectIds, wie: naam(req), tweede: req.body.tweede, notitie: req.body.notitie });
    if (r.ok) afdelingen.audit(naam(req), 'Onderhoudsronde gegund: ' + r.gemaakt + ' werkorder(s)' +
      (r.tweede ? ' (vier ogen met ' + r.tweede + ')' : '') +
      (r.overgeslagen.length ? '; ' + r.overgeslagen.length + ' overgeslagen' : ''));
    return r;
  }));

  // ---- contracten en prestatie ----
  app.post('/api/office/weefsel/contracten', officeAuth, (req, res) => veilig(res, () => w.weefselContracten()));
  app.post('/api/office/weefsel/contract/maak', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselContractMaak({ partij: req.body.partij, soorten: req.body.soorten, gebied: req.body.gebied,
      sla: req.body.sla, tariefUur: req.body.tariefUur, tariefVoorrijden: req.body.tariefVoorrijden, eind: req.body.eind, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Contract met ' + r.contract.partij + ' voor ' + r.contract.soorten.join(', ') + ' in ' + r.contract.gebiedNaam);
    return r;
  }));
  app.post('/api/office/weefsel/contract/zet', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselContractZet({ id: req.body.id, actief: req.body.actief, eind: req.body.eind,
      tariefUur: req.body.tariefUur, sla: req.body.sla, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Contract ' + r.contract.id + ' bijgewerkt (' + (r.contract.loopt ? 'loopt' : 'gestopt') + ')');
    return r;
  }));
  app.post('/api/office/weefsel/prestatie', officeAuth, (req, res) => veilig(res, () => w.weefselPrestatie({
    contractId: req.body.contractId, vanaf: req.body.vanaf, tot: req.body.tot })));

  // ---- indicatoren: de bestuurstafel ----
  app.post('/api/office/weefsel/indicatoren', officeAuth, (req, res) => veilig(res, () => w.weefselIndicatoren({
    dagen: req.body.dagen, vanaf: req.body.vanaf, tot: req.body.tot, gebied: req.body.gebied })));
  app.post('/api/office/weefsel/wijken', officeAuth, (req, res) => veilig(res, () => w.weefselPerWijk({ dagen: req.body.dagen })));
  app.post('/api/office/weefsel/leefomgeving', officeAuth, (req, res) => veilig(res, () => w.weefselLeefomgeving({
    dagen: req.body.dagen, gebied: req.body.gebied })));

  // ---- begroting: doel, budget, project, uitkomst ----
  app.post('/api/office/weefsel/begroting', officeAuth, (req, res) => veilig(res, () => w.weefselBegroting({ jaar: req.body.jaar })));
  app.post('/api/office/weefsel/doel/maak', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselDoelMaak({ naam: req.body.doelNaam, omschrijving: req.body.omschrijving,
      jaar: req.body.jaar, indicator: req.body.indicator, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Beleidsdoel toegevoegd: ' + r.doel.naam + ' (' + r.doel.jaar + ')');
    return r;
  }));
  app.post('/api/office/weefsel/project/maak', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselProjectMaak({ doelId: req.body.doelId, naam: req.body.projectNaam, budget: req.body.budget,
      gebied: req.body.gebied, indicator: req.body.indicator, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Project "' + r.project.naam + '" met budget EUR ' + r.project.budget +
      (r.project.nulmeting ? ' (nulmeting ' + r.project.indicator + ': ' + r.project.nulmeting.waarde + ')' : ' (zonder nulmeting)'));
    return r;
  }));
  app.post('/api/office/weefsel/project', officeAuth, (req, res) => veilig(res, () => w.weefselProject({ id: req.body.id })));
  app.post('/api/office/weefsel/project/koppel', officeAuth, (req, res) => veilig(res, () => w.weefselProjectKoppel({
    projectId: req.body.projectId, werkorderId: req.body.werkorderId })));
  app.post('/api/office/weefsel/project/sluit', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselProjectSluit({ projectId: req.body.projectId, wie: naam(req), evaluatie: req.body.evaluatie });
    if (r.ok) afdelingen.audit(naam(req), 'Project "' + r.project.naam + '" afgesloten: EUR ' + r.project.uitgegeven +
      ' van EUR ' + r.project.budget + '; effect ' + (r.effect.gemeten ? r.effect.van + ' -> ' + r.effect.naar : 'niet gemeten'));
    return r;
  }));

  // ---- energie: adviseren en vastleggen, nooit schakelen ----
  app.post('/api/office/weefsel/energie', officeAuth, (req, res) => veilig(res, () => w.weefselEnergie()));
  app.post('/api/office/weefsel/energie/advies', officeAuth, (req, res) => veilig(res, () => w.weefselEnergieAdvies()));
  app.post('/api/office/weefsel/energie/opdracht', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselEnergieOpdracht({ gebied: req.body.gebied, maatregel: req.body.maatregel,
      wie: naam(req), tweede: req.body.tweede, redenTekst: req.body.reden });
    if (r.ok) afdelingen.audit(naam(req), 'Energiemaatregel "' + r.opdracht.maatregel + '" in ' + r.opdracht.gebiedNaam +
      (r.opdracht.tweede ? ' (vier ogen met ' + r.opdracht.tweede + ')' : '') + '; vervalt vanzelf');
    return r;
  }));
  app.post('/api/office/weefsel/energie/intrek', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselEnergieIntrek({ id: req.body.id, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Energiemaatregel ' + r.opdracht.id + ' ingetrokken; terugvalstand: ' + r.terugvalstand);
    return r;
  }));

  // ---- klimaat en de wat-als-vragen ----
  app.post('/api/office/weefsel/klimaat', officeAuth, (req, res) => veilig(res, () => w.weefselKlimaat()));
  app.post('/api/office/weefsel/klimaat/kenmerk', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselKlimaatKenmerk({ gebied: req.body.gebied, lijst: req.body.lijst, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Risicokenmerken van ' + r.naam + ': ' + (r.kenmerken.join(', ') || 'geen'));
    return r;
  }));
  // ---- de kansenlaag: onderwijs, werk en de lokale economie ----
  app.post('/api/office/weefsel/kansen', officeAuth, (req, res) => veilig(res, () => w.weefselKansen()));
  app.post('/api/office/weefsel/tekorten', officeAuth, (req, res) => veilig(res, () => w.weefselTekorten()));
  app.post('/api/office/weefsel/leegstand', officeAuth, (req, res) => veilig(res, () => w.weefselLeegstand()));
  app.post('/api/office/weefsel/pand/zet', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselPandZet({ objectId: req.body.objectId, leeg: req.body.leeg, m2: req.body.m2, huur: req.body.huur, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Pand ' + r.pand.naam + ' staat nu ' + (r.pand.leeg ? 'LEEG' : 'in gebruik'));
    return r;
  }));
  app.post('/api/office/weefsel/hinder', officeAuth, (req, res) => veilig(res, () => w.weefselHinder({ gebied: req.body.gebied })));
  app.post('/api/office/weefsel/opdrachten', officeAuth, (req, res) => veilig(res, () => w.weefselOpdrachten()));
  app.post('/api/office/weefsel/drukte', officeAuth, (req, res) => veilig(res, () => w.weefselDrukte({
    gebied: req.body.gebied, bezoekers: req.body.bezoekers, uren: req.body.uren })));

  app.post('/api/office/weefsel/simulaties', officeAuth, (req, res) => veilig(res, () => w.weefselSimulaties()));
  app.post('/api/office/weefsel/simuleer', officeAuth, (req, res) => veilig(res, () => w.weefselSimuleer({
    soort: req.body.soort, id: req.body.id, gebied: req.body.gebied, minuten: req.body.minuten,
    dagen: req.body.dagen, bezoekers: req.body.bezoekers, uren: req.body.uren,
    naam: req.body.scenario, ernst: req.body.ernst })));
};
