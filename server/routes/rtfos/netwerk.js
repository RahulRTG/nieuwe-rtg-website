/* Domein "rtfos", deel "netwerk": het netwerkeffect tussen steden.

   Blauwdrukken delen, samen inkopen, vrijwilligers uitwisselen, landelijk
   werven, en het koppelbord met RTG. Zelfde vorm als de rest: `officeAuth` op
   de deur, de echte bevoegdheidsvraag in de kern.

   ELK PAD STAAT LETTERLIJK -- zie de kop van ./index.js. Een opgebouwd pad maakt
   een route onzichtbaar voor de poort-audit, de schakelbaarheid, de
   dubbele-routecontrole en de dekking; dat is hier een keer misgegaan en het
   staat daar met naam.

   WAT HIER OPVALT ALS JE DE ROUTES LEEST: er is geen enkele landelijke route
   die namens een stad geld vastlegt of een project goedkeurt. Delen, inkopen en
   uitlenen gaan allemaal via de stad zelf; het landelijke bestuur zet de
   sleutel van een campagne en verdeelt binnengekomen geld, en dat is precies
   wat een landelijk bestuur hoort te doen. */
module.exports = ({ app, officeAuth, rtfos, H }) => {

  // ---------- blauwdrukken: wat hier werkte, daar overnemen ----------
  app.post('/api/rtfos/blauwdrukken', officeAuth, H(req => rtfos.netwerk.catalogus(req)));
  app.post('/api/rtfos/blauwdruk/deel', officeAuth, H((req, b) => rtfos.netwerk.deel(req, b.projectId, b)));
  app.post('/api/rtfos/blauwdruk/overnemen', officeAuth, H((req, b) => rtfos.netwerk.neemOver(req, b.id, b.stad)));

  // ---------- benchmark: naast elkaar, niet op volgorde ----------
  app.post('/api/rtfos/benchmark', officeAuth, H(req => rtfos.netwerk.benchmark(req)));

  // ---------- gezamenlijke inkoop ----------
  // Sluiten maakt per stad een gewone uitgave-aanvraag; die loopt daarna door
  // de vier ogen en de limiet van die stad (kern/rtfos/inkoop.js).
  app.post('/api/rtfos/inkoop', officeAuth, H(req => rtfos.inkoop.lijst(req)));
  app.post('/api/rtfos/inkoop/maak', officeAuth, H((req, b) => rtfos.inkoop.maak(req, b)));
  app.post('/api/rtfos/inkoop/inschrijven', officeAuth, H((req, b) => rtfos.inkoop.schrijfIn(req, b.id, b)));
  app.post('/api/rtfos/inkoop/sluit', officeAuth, H((req, b) => rtfos.inkoop.sluit(req, b.id, b)));
  app.post('/api/rtfos/inkoop/status', officeAuth, H((req, b) => rtfos.inkoop.status(req, b.id, b.status)));

  // ---------- vrijwilligers tussen steden ----------
  app.post('/api/rtfos/uitleen', officeAuth, H((req, b) => rtfos.uitwisseling.lijst(req, b.stad)));
  app.post('/api/rtfos/uitleen/vraag', officeAuth, H((req, b) => rtfos.uitwisseling.vraag(req, b)));
  app.post('/api/rtfos/uitleen/toestemming', officeAuth, H((req, b) => rtfos.uitwisseling.toestemming(req, b.id, b)));
  app.post('/api/rtfos/uitleen/beeindig', officeAuth, H((req, b) => rtfos.uitwisseling.beeindig(req, b.id)));

  // ---------- landelijke campagnes ----------
  app.post('/api/rtfos/campagnes', officeAuth, H(req => rtfos.campagnes.lijst(req)));
  app.post('/api/rtfos/campagne/maak', officeAuth, H((req, b) => rtfos.campagnes.maak(req, b)));
  app.post('/api/rtfos/campagne/sleutel', officeAuth, H((req, b) => rtfos.campagnes.sleutelZet(req, b.id, b.delen)));
  app.post('/api/rtfos/campagne/status', officeAuth, H((req, b) => rtfos.campagnes.status(req, b.id, b.status)));
  app.post('/api/rtfos/campagne/ronde', officeAuth, H((req, b) => rtfos.campagnes.ronde(req, b.id, b)));

  // ---------- het koppelbord met RTG ----------
  // Het bord zegt wat WERKT en wat niet, met de reden erbij; alleen de agenda
  // doet vandaag echt iets (kern/rtfos/koppeling.js).
  app.post('/api/rtfos/koppelbord', officeAuth, H(req => rtfos.koppeling.bord(req)));
  app.post('/api/rtfos/koppel/agenda', officeAuth, H((req, b) => rtfos.koppeling.naarAgenda(req, b.id)));
  app.post('/api/rtfos/koppel/nog-niet', officeAuth, H((req, b) => rtfos.koppeling.nietGekoppeld(req, b.welke)));
};
