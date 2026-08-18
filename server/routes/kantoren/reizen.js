/* Kantoren (deelmodule): DE REISBALIE -- het aanbod samenstellen en de
   aanvragen van leden afhandelen.

   Deze twee horen bij elkaar en stonden los. De aanvraag-routes zaten in
   ./index.js; het aanbod had helemaal geen routes, want er was geen schrijver
   voor db.data.partnerTrips (zie de kop van kern/reisaanbod.js). Dat gat is nu
   dicht, en dan is dit de balie: hier ontstaat een reis, en hier wordt hij
   bevestigd of afgewezen. Eén kamer, één bestand.

   ALLES ACHTER officeAuth, WANT HIER BESLIST EEN MENS. Een reis samenstellen
   zet een prijs neer waar leden op afgaan, en een aanvraag bevestigen is een
   toezegging aan een lid. De AI doet in dit huis geen van beide. */
module.exports = (ctx) => {
  const { app, officeAuth, veilig, kern } = ctx;
  const wie = (req) => String(((req.body || {}).door) || 'reisadviseur');

  /* ---- het aanbod: de samengestelde reizen van RTG ----
     Lezen doet iedereen die is ingelogd (het reisbureau, het partnerkanaal, de
     Mall); schrijven gebeurt alleen hier. Dat is met opzet één deur: twee
     plekken die reizen neerzetten lopen uiteen in veldnamen, en dan bestaat een
     reis in het ene scherm wel en in het andere niet (LAT-regel 4). */
  app.post('/api/office/reisaanbod', officeAuth, (req, res) =>
    veilig(res, () => kern.reisaanbod.reisAanbodKantoor()));
  app.post('/api/office/reisaanbod/zet', officeAuth, (req, res) =>
    veilig(res, () => kern.reisaanbod.reisAanbodZet(req.body || {}, wie(req))));
  app.post('/api/office/reisaanbod/weg', officeAuth, (req, res) =>
    veilig(res, () => kern.reisaanbod.reisAanbodWeg(String((req.body || {}).id || ''), wie(req))));

  /* ---- de aanvragen: het besluit van de reisadviseur ----
     Dat besluit ontbrak ooit: een aanvraag kon binnenkomen maar nooit ergens
     anders terechtkomen, dus een reis kwam nooit rond en het dossier van het
     lid bleef leeg. Bevestigen zet de reis in dat dossier op bevestigd,
     afwijzen haalt hem eruit (kern/lid/reisdossier.js). */
  app.post('/api/office/reisbureau', officeAuth, (req, res) =>
    veilig(res, () => kern.reisbureau.aanvragen()));
  app.post('/api/office/reisbureau/bevestig', officeAuth, (req, res) =>
    veilig(res, () => kern.reisbureau.bevestig(String((req.body || {}).ref || ''), (req.body || {}).door)));
  app.post('/api/office/reisbureau/afwijzen', officeAuth, async (req, res) => {
    try {
      const r = await kern.reisbureau.wijsAf(String((req.body || {}).ref || ''), (req.body || {}).door, (req.body || {}).reden);
      r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
    } catch (e) { console.error('[reisbureau]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
