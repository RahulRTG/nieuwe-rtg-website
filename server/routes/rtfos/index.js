/* Domein "rtfos": het Foundation OS van de RTFoundation.

   ALLES ACHTER DE KANTOORDEUR, EN DAARBINNEN NOG EEN KEER. `officeAuth` zegt
   alleen dat er een kantoorsessie is; WELKE stad iemand mag zien en wat hij
   daar mag doen, beslist de kern per aanroep (kern/rtfos/basis.js: poort()).
   Dat is met opzet niet in middleware gehangen: het antwoord hangt af van het
   object waar de aanroep over gaat -- de stad van dit project, van deze bron,
   van deze vrijwilliger -- en middleware die dat zou moeten uitzoeken, doet het
   werk twee keer en raakt uit de pas met de kern (LAT.md regel 4).

   DRIE PUBLIEKE DEUREN staan apart in ./portalen.js: de partnerstichting, de
   gemeente en de lokale ondernemer komen binnen op een code en hebben geen
   RTG-account. Die hebben hun eigen remmen nodig en horen daarom niet tussen
   de kantoorroutes.

   De uitvoeringslaag (vrijwilligers, geld, casussen, meldingen, rapportages,
   gemeenten en ondernemers) staat in ./uitvoering.js; dit bestand houdt de
   organisatie: de boom, de steden, de zetels, de partners en de projecten. */
module.exports = (kern) => {
  const { app, officeAuth, rtfos } = kern;

  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const veilig = (res, werk) => {
    try { stuur(res, werk()); }
    catch (e) { console.error('[rtfos]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };
  const op = (pad, werk) => app.post('/api/rtfos/' + pad, officeAuth, (req, res) => veilig(res, () => werk(req, req.body || {})));

  // wie ben ik in dit OS, en welke steden hangen eronder
  op('ik', req => rtfos.ik(req));
  op('boom', req => rtfos.boom(req));
  op('stad', (req, b) => rtfos.stad(req, b.id));

  // de landelijke knoppen: openen, activeren, modules, limieten
  op('stad/maak', (req, b) => rtfos.stadMaak(req, b));
  op('stad/status', (req, b) => rtfos.stadStatus(req, b.id, b.status));
  op('stad/module', (req, b) => rtfos.vlagZet(req, b.id, b.vlag, b.aan === true));
  op('stad/limiet', (req, b) => rtfos.limietZet(req, b.id, b.rol, b.bedrag));
  op('stad/kernteam', (req, b) => rtfos.kernteamZet(req, b.id, b.namen));

  // de zetels: de enige plek waar bevoegdheid wordt uitgedeeld
  op('zetel', (req, b) => rtfos.zetelZet(req, b));
  op('zetel/weg', (req, b) => rtfos.zetelWeg(req, b.id));

  // de partnerstichtingen
  op('partners', (req, b) => rtfos.partners.lijst(req, b.stad));
  op('partner/maak', (req, b) => rtfos.partners.maak(req, b));
  op('partner/zet', (req, b) => rtfos.partners.zet(req, b.id, b));
  op('partner/status', (req, b) => rtfos.partners.status(req, b.id, b.status));
  op('partner/document', (req, b) => rtfos.partners.documentMaak(req, b.id, b));
  op('partner/beoordeel', (req, b) => rtfos.partners.beoordeel(req, b.id, b));

  // de projecten
  op('projecten', (req, b) => rtfos.projecten.lijst(req, b.stad));
  op('project/maak', (req, b) => rtfos.projecten.maak(req, b));
  op('project/zet', (req, b) => rtfos.projecten.zet(req, b.id, b));
  op('project/status', (req, b) => rtfos.projecten.status(req, b.id, b.status));
  op('project/activiteit', (req, b) => rtfos.projecten.activiteit(req, b.id, b));
  op('project/indicator', (req, b) => rtfos.projecten.indicatorZet(req, b.id, b));
  op('project/deelnemers', (req, b) => rtfos.projecten.deelnemers(req, b.id, b));
  op('project/bewijs', (req, b) => rtfos.projecten.bewijsMaak(req, b.id, b));
  op('project/rapportage', (req, b) => rtfos.projecten.rapportage(req, b.id, b));

  // het auditspoor: landelijk, alleen lezen
  op('audit', (req, b) => rtfos.auditlog(req, b));

  require('./uitvoering')({ app, officeAuth, rtfos, veilig, op });
  require('./portalen')({ app, rtfos, veilig });
};
