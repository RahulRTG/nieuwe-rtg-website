/* Kantoren, deel "weefsel3": de bestuurlijke kant van het stadsweefsel.

   De organen en hun mandaat, de weg van voorstel naar besluit, de
   inwonersraadpleging en het rekenkameronderzoek.

   ALLES WAT HIER GEBEURT IS EEN BESLUIT VAN MENSEN, en dat is de reden dat elke
   handeling met naam in het auditlog landt. Er staat hier geen enkele route die
   namens een orgaan iets vaststelt: stemmen doet een fractie, sluiten doet een
   griffier, en het systeem telt alleen. */
module.exports = (ctx) => {
  const { app, officeAuth, veilig, afdelingen, kern } = ctx;
  const w = kern.weefsel;
  const naam = req => (req.body && req.body.naam ? String(req.body.naam) : 'boardroom');

  app.post('/api/office/weefsel/organen', officeAuth, (req, res) => veilig(res, () => w.weefselOrganen()));
  app.post('/api/office/weefsel/mandaat', officeAuth, (req, res) => veilig(res, () => w.weefselMandaat({
    bedrag: req.body.bedrag, kritiek: req.body.kritiek === true })));
  app.post('/api/office/weefsel/besluiten', officeAuth, (req, res) => veilig(res, () => w.weefselBesluiten({
    orgaan: req.body.orgaan, status: req.body.status, projectId: req.body.projectId })));
  app.post('/api/office/weefsel/besluit', officeAuth, (req, res) => veilig(res, () => w.weefselBesluit({ id: req.body.id })));

  app.post('/api/office/weefsel/voorstel', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselVoorstel({ orgaan: req.body.orgaan, titel: req.body.titel, toelichting: req.body.toelichting,
      bedrag: req.body.bedrag, projectId: req.body.projectId, doelId: req.body.doelId, gebied: req.body.gebied, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Voorstel ' + r.besluit.ref + ' ingediend bij ' + r.besluit.orgaanNaam + ': ' + r.besluit.titel);
    return r;
  }));
  app.post('/api/office/weefsel/advies', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselAdvies({ besluitId: req.body.besluitId, orgaan: req.body.orgaan,
      standpunt: req.body.standpunt, toelichting: req.body.toelichting, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Advies bij ' + r.besluit.ref + ': ' + req.body.orgaan + ' is ' + req.body.standpunt);
    return r;
  }));
  app.post('/api/office/weefsel/stem', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselStem({ besluitId: req.body.besluitId, fractie: req.body.fractie, voor: req.body.voor === true, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Stem bij ' + r.besluit.ref + ': ' + req.body.fractie + ' ' + (req.body.voor === true ? 'VOOR' : 'TEGEN'));
    return r;
  }));
  app.post('/api/office/weefsel/besluit/sluit', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselBesluitSluit({ besluitId: req.body.besluitId, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Besluit ' + r.besluit.ref + ' ' + r.besluit.status.toUpperCase() +
      ' (' + r.besluit.uitslag.voor + ' voor, ' + r.besluit.uitslag.tegen + ' tegen)' +
      (r.besluit.tegenAdvies.length ? ' -- TEGEN het advies van ' + r.besluit.tegenAdvies.join(' en ') : ''));
    return r;
  }));

  // ---- inwonersraadpleging: uitzetten en sluiten door het kantoor ----
  app.post('/api/office/weefsel/raadplegingen', officeAuth, (req, res) => veilig(res, () => w.weefselRaadplegingen({})));
  app.post('/api/office/weefsel/raadpleging/maak', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselRaadplegingMaak({ vraag: req.body.vraag, toelichting: req.body.toelichting, gebied: req.body.gebied,
      dagen: req.body.dagen, opties: req.body.opties, besluitId: req.body.besluitId, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Raadpleging uitgezet in ' + r.raadpleging.gebiedNaam + ': ' + r.raadpleging.vraag);
    return r;
  }));
  app.post('/api/office/weefsel/raadpleging/sluit', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselRaadplegingSluit({ raadplegingId: req.body.id, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Raadpleging gesloten: ' + r.raadpleging.vraag +
      ' (' + r.raadpleging.uitslag.reacties + ' reacties, ' + r.raadpleging.uitslag.uitHetGebied + ' uit het gebied)');
    return r;
  }));

  /* De rekenkamer. Kijken kost niets en verandert niets, dus geen auditregel --
     en met opzet geen "goedkeuring": wat eruit komt is een feitenblad. */
  app.post('/api/office/weefsel/onderzoek', officeAuth, (req, res) => veilig(res, () => w.weefselOnderzoek({ projectId: req.body.projectId })));
  app.post('/api/office/weefsel/jaarbeeld', officeAuth, (req, res) => veilig(res, () => w.weefselJaarbeeld({ jaar: req.body.jaar })));
};
