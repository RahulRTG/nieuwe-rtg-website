/* RTG Command, deel inrichten: de routes die iets OPZETTEN in plaats van meten.

   De koppelingen (API-poort), de landpakketten, de steden en de overname van
   een bedrijf. Ze horen bij elkaar omdat ze alle vier hetzelfde patroon hebben:
   er komt iets bij, en de uitslag zegt eerlijk wat er daarna nog mensenwerk
   blijft. Meten en uitrollen staan in ./meten.js. */
'use strict';

module.exports = ({ app, officeAuth, veilig, wie, command }) => {
  /* De API-poort. Het geheim van een sleutel gaat één keer mee terug en wordt
     nergens bewaard; hier staat alleen een hash met zout. */
  app.post('/api/command/apipoort', officeAuth, (req, res) => veilig(res, () => command.apipoort.stand()));
  app.post('/api/command/apipoort/toelaten', officeAuth, (req, res) => veilig(res, () =>
    command.apipoort.laatToe(String(req.body.pad || ''), { versie: req.body.versie,
      uitfasering: req.body.uitfasering, waarvoor: req.body.waarvoor }, wie(req))));
  app.post('/api/command/apipoort/toelating-weg', officeAuth, (req, res) => veilig(res, () =>
    command.apipoort.haalWeg(String(req.body.pad || ''), wie(req))));
  app.post('/api/command/apipoort/sleutel', officeAuth, (req, res) => veilig(res, () =>
    command.apipoort.maak(req.body.naam, req.body.scopes, { door: wie(req), eigenaar: req.body.eigenaar,
      quotaPerUur: req.body.quotaPerUur, dagen: req.body.dagen })));
  app.post('/api/command/apipoort/intrekken', officeAuth, (req, res) => veilig(res, () =>
    command.apipoort.trekIn(String(req.body.id || ''), wie(req), req.body.reden)));

  /* Landpakketten. Activeren zet alleen de per-land-standen in de schakelkast;
     de mensenwerk-lijst blijft staan en verdwijnt niet door te activeren. */
  app.post('/api/command/land', officeAuth, (req, res) => veilig(res, () =>
    command.landpakket.stand(req.body.land ? String(req.body.land) : null)));
  app.post('/api/command/land/activeer', officeAuth, (req, res) => veilig(res, () =>
    command.landpakket.activeer(String(req.body.land || ''), wie(req))));
  app.post('/api/command/land/terug', officeAuth, (req, res) => veilig(res, () =>
    command.landpakket.terug(String(req.body.land || ''), wie(req))));

  /* Stadsstart. De stand is met opzet eerlijker dan de knop: "gestart"
     betekent dat de administratie klaarstaat, niet dat de stad draait. */
  app.post('/api/command/stad', officeAuth, (req, res) => veilig(res, () =>
    command.stadstart.stand(req.body.naam ? String(req.body.naam) : null)));
  app.post('/api/command/stad/start', officeAuth, (req, res) => veilig(res, () =>
    command.stadstart.start(String(req.body.naam || ''), { land: req.body.land, sluit: req.body.sluit,
      lat: req.body.lat, lng: req.body.lng, door: wie(req) })));
  app.post('/api/command/stad/stop', officeAuth, (req, res) => veilig(res, () =>
    command.stadstart.stop(String(req.body.naam || ''), wie(req))));

  /* Overnamemodus. Vier stappen, en uitvoeren gaat alleen met het zegel van
     precies de droogloop die is bekeken. */
  app.post('/api/command/overname', officeAuth, (req, res) => veilig(res, () => command.overname.lijst()));
  app.post('/api/command/overname/lees', officeAuth, (req, res) => veilig(res, () =>
    command.overname.lees(req.body.naam, String(req.body.soort || ''), req.body.rijen, wie(req))));
  app.post('/api/command/overname/voorstel', officeAuth, (req, res) => veilig(res, () =>
    command.overname.voorstel(String(req.body.id || ''))));
  app.post('/api/command/overname/afbeelden', officeAuth, (req, res) => veilig(res, () =>
    command.overname.beeldAf(String(req.body.id || ''), req.body.afbeelding, wie(req))));
  app.post('/api/command/overname/droogloop', officeAuth, (req, res) => veilig(res, () =>
    command.overname.droogloop(String(req.body.id || ''))));
  app.post('/api/command/overname/voer', officeAuth, (req, res) => veilig(res, () =>
    command.overname.voer(String(req.body.id || ''), req.body.zegel, wie(req), req.body.reden)));
  app.post('/api/command/overname/terug', officeAuth, (req, res) => veilig(res, () =>
    command.overname.terug(String(req.body.id || ''), wie(req))));

};
