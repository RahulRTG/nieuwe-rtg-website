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

  /* ---- noodbediening: wat doet de stad als wij er niet zijn ----
     De noodkaart is bewust ook hier een gewone kijk-route: hij rekent niets uit
     en is bedoeld om afgedrukt te worden. */
  app.post('/api/office/weefsel/noodkaart', officeAuth, (req, res) => veilig(res, () => w.weefselNoodkaart()));
  app.post('/api/office/weefsel/vertrouwenszones', officeAuth, (req, res) => veilig(res, () => w.weefselVertrouwenszones()));
  app.post('/api/office/weefsel/terugval/zet', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselTerugvalZet({ soort: req.body.soort, terugval: req.body.terugval, lokaal: req.body.lokaal,
      papier: req.body.papier, notitie: req.body.notitie, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Terugvalstand voor ' + r.terugval.soort + ' vastgelegd');
    return r;
  }));
  app.post('/api/office/weefsel/oefening', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselOefening({ soort: req.body.soort, wie: naam(req), notitie: req.body.notitie, gelukt: req.body.gelukt });
    if (r.ok) afdelingen.audit(naam(req), 'Noodoefening ' + r.terugval.soort + ': ' +
      (req.body.gelukt === false ? 'MISLUKT -- telt niet als geoefend' : 'geslaagd'));
    return r;
  }));

  /* ---- het sociaal domein: voorzieningen en tellingen, nooit personen ---- */
  app.post('/api/office/weefsel/voorzieningen', officeAuth, (req, res) => veilig(res, () => w.weefselVoorzieningen({ maanden: req.body.maanden })));
  app.post('/api/office/weefsel/voorziening/maak', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselVoorzieningMaak({ soort: req.body.soort, naam: req.body.voorzieningNaam, lat: req.body.lat, lng: req.body.lng,
      plekken: req.body.plekken, wachtDagen: req.body.wachtDagen, doelgroep: req.body.doelgroep, organisatie: req.body.organisatie, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Voorziening toegevoegd: ' + r.voorziening.naam + ' (' + r.voorziening.soortLabel + ')');
    return r;
  }));
  app.post('/api/office/weefsel/voorziening/zet', officeAuth, (req, res) => veilig(res, () => w.weefselVoorzieningZet({
    id: req.body.id, plekken: req.body.plekken, wachtDagen: req.body.wachtDagen, open: req.body.open, wie: naam(req) })));
  app.post('/api/office/weefsel/telling', officeAuth, (req, res) => veilig(res, () => w.weefselTelling({
    stroom: req.body.stroom, gebied: req.body.gebied, aantal: req.body.aantal, maand: req.body.maand, wie: naam(req) })));
  app.post('/api/office/weefsel/sociaalgrenzen', officeAuth, (req, res) => veilig(res, () => w.weefselSociaalGrenzen()));
};
