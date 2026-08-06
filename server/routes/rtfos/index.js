/* Domein "rtfos": het Foundation OS van de RTFoundation.

   ALLES ACHTER DE KANTOORDEUR, EN DAARBINNEN NOG EEN KEER. `officeAuth` zegt
   alleen dat er een kantoorsessie is; WELKE stad iemand mag zien en wat hij
   daar mag doen, beslist de kern per aanroep (kern/rtfos/basis.js: poort()).
   Dat is met opzet niet in middleware gehangen: het antwoord hangt af van het
   object waar de aanroep over gaat -- de stad van dit project, van deze bron,
   van deze vrijwilliger -- en middleware die dat zou moeten uitzoeken, doet het
   werk twee keer en raakt uit de pas met de kern (LAT.md regel 4).

   WAAROM ELK PAD HIER LETTERLIJK STAAT, EN NIET OPGEBOUWD WORDT.

   In de eerste versie stond hier een hulpje: `op('project/maak', ...)` dat er
   `app.post('/api/rtfos/' + pad, officeAuth, ...)` van maakte. Dat leest
   prettig en het werkte -- en het maakte vijfenveertig routes ONZICHTBAAR voor
   vier meters van dit huis tegelijk. `scripts/schakelbaar.js`,
   `scripts/check.js` (regel 28: heeft elke route een poort, en regel 31: geen
   dubbele registratie) en de routekaart lezen allemaal de BRON met dezelfde
   regex: `app.post('...'`. Die vindt bij een opgebouwd pad alleen het stukje
   dat letterlijk in de code staat, `/api/rtfos/`, en telt dat als EEN route.

   Het gevolg was precies de klasse die keuringsregel 28 moet vangen: mijn
   routes kwamen niet door de poort-audit, ze telden niet mee in de
   schakelbaarheid, en de dekkingsmeter kon niet zien of ze ooit getoetst
   waren. Alles stond op groen omdat er niets te zien was.

   Dat is LAT.md regel 10 in de omgekeerde richting: niet de meter was kapot,
   maar mijn code was onleesbaar voor de meter. De reparatie is dan niet de
   meter slimmer maken (een AST-scanner die concatenaties uitrekent is
   opnieuw te omzeilen), maar schrijven zoals de rest van het huis schrijft:
   het pad staat er, letterlijk, met de poortwachter ernaast. Dat is een paar
   tekens meer per regel en het scheelt een blinde vlek van vijfenveertig
   routes.

   DE PUBLIEKE DEUREN staan apart, in ./portalen.js (partner, gemeente,
   ondernemer) en ./doelgroepen.js (vrijwilliger, hulpvrager, en de buurt
   zonder code). Ze hebben eigen remmen nodig en horen daarom niet tussen de
   kantoorroutes.

   De drie in portalen.js: de partnerstichting, de
   gemeente en de lokale ondernemer komen binnen op een code en hebben geen
   RTG-account. Die hebben hun eigen remmen nodig en horen daarom niet tussen
   de kantoorroutes.

   De uitvoeringslaag (vrijwilligers, geld, casussen, meldingen, rapportages,
   gemeenten, ondernemers, subsidies, voorraad, activiteiten en communicatie)
   staat in ./uitvoering.js, en het netwerk tussen steden (blauwdrukken,
   gezamenlijke inkoop, uitleen, campagnes, koppelbord) in ./netwerk.js. Dit
   bestand houdt de organisatie: de boom, de steden, de zetels, de partners en
   de projecten. */
module.exports = (kern) => {
  const { app, officeAuth, rtfos } = kern;

  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const veilig = (res, werk) => {
    try { stuur(res, werk()); }
    catch (e) { console.error('[rtfos]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };
  /* De handler-verpakking mag wel een hulpje zijn: die staat NA de poort en na
     het pad, dus geen enkele scanner struikelt erover. Wat letterlijk moet
     blijven is het pad en de poortwachter. */
  const H = werk => (req, res) => veilig(res, () => werk(req, req.body || {}));

  // wie ben ik in dit OS, en welke steden hangen eronder
  app.post('/api/rtfos/ik', officeAuth, H(req => rtfos.ik(req)));
  app.post('/api/rtfos/boom', officeAuth, H(req => rtfos.boom(req)));
  app.post('/api/rtfos/stad', officeAuth, H((req, b) => rtfos.stad(req, b.id)));

  // de landelijke knoppen: openen, activeren, modules, limieten
  app.post('/api/rtfos/stad/maak', officeAuth, H((req, b) => rtfos.stadMaak(req, b)));
  app.post('/api/rtfos/stad/status', officeAuth, H((req, b) => rtfos.stadStatus(req, b.id, b.status)));
  app.post('/api/rtfos/stad/module', officeAuth, H((req, b) => rtfos.vlagZet(req, b.id, b.vlag, b.aan === true)));
  app.post('/api/rtfos/stad/limiet', officeAuth, H((req, b) => rtfos.limietZet(req, b.id, b.rol, b.bedrag)));
  app.post('/api/rtfos/stad/kernteam', officeAuth, H((req, b) => rtfos.kernteamZet(req, b.id, b.namen)));

  // de zetels: de enige plek waar bevoegdheid wordt uitgedeeld
  app.post('/api/rtfos/zetel', officeAuth, H((req, b) => rtfos.zetelZet(req, b)));
  app.post('/api/rtfos/zetel/weg', officeAuth, H((req, b) => rtfos.zetelWeg(req, b.id)));

  // de partnerstichtingen
  app.post('/api/rtfos/partners', officeAuth, H((req, b) => rtfos.partners.lijst(req, b.stad)));
  app.post('/api/rtfos/partner/maak', officeAuth, H((req, b) => rtfos.partners.maak(req, b)));
  app.post('/api/rtfos/partner/zet', officeAuth, H((req, b) => rtfos.partners.zet(req, b.id, b)));
  app.post('/api/rtfos/partner/status', officeAuth, H((req, b) => rtfos.partners.status(req, b.id, b.status)));
  app.post('/api/rtfos/partner/document', officeAuth, H((req, b) => rtfos.partners.documentMaak(req, b.id, b)));
  app.post('/api/rtfos/partner/beoordeel', officeAuth, H((req, b) => rtfos.partners.beoordeel(req, b.id, b)));

  // de projecten
  app.post('/api/rtfos/projecten', officeAuth, H((req, b) => rtfos.projecten.lijst(req, b.stad)));
  app.post('/api/rtfos/project/maak', officeAuth, H((req, b) => rtfos.projecten.maak(req, b)));
  app.post('/api/rtfos/project/zet', officeAuth, H((req, b) => rtfos.projecten.zet(req, b.id, b)));
  app.post('/api/rtfos/project/status', officeAuth, H((req, b) => rtfos.projecten.status(req, b.id, b.status)));
  app.post('/api/rtfos/project/activiteit', officeAuth, H((req, b) => rtfos.projecten.activiteit(req, b.id, b)));
  app.post('/api/rtfos/project/indicator', officeAuth, H((req, b) => rtfos.projecten.indicatorZet(req, b.id, b)));
  app.post('/api/rtfos/project/deelnemers', officeAuth, H((req, b) => rtfos.projecten.deelnemers(req, b.id, b)));
  app.post('/api/rtfos/project/bewijs', officeAuth, H((req, b) => rtfos.projecten.bewijsMaak(req, b.id, b)));
  app.post('/api/rtfos/project/rapportage', officeAuth, H((req, b) => rtfos.projecten.rapportage(req, b.id, b)));

  // het auditspoor: landelijk, alleen lezen
  app.post('/api/rtfos/audit', officeAuth, H((req, b) => rtfos.auditlog(req, b)));

  require('./uitvoering')({ app, officeAuth, rtfos, H });
  require('./netwerk')({ app, officeAuth, rtfos, H });
  require('./doelgroepen')({ app, officeAuth, rtfos, veilig, H });
  require('./portalen')({ app, rtfos, veilig });
};
