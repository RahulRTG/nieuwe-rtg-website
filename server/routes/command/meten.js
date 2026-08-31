/* RTG Command, deel meten: de servicedoelen met hun foutbudget, en de sonde die
   van buitenaf aanklopt.

   WAAROM DE SONDE MAG SCHRIJVEN EN DE SLO-METER NIET. De SLO-meter leest alleen
   (de tellers van server/meting.js en de norm uit SLO.json); de sonde legt
   monsters vast, want een meting die niet blijft liggen kan niets zeggen over
   een herstart. Dat is de reden dat /sonde/draai een POST is die iets doet en
   niet een GET die iets toont.

   /sonde/melding IS DE ENIGE INGANG HIER DIE NIET ACHTER DE KANTOOR-INLOG ZIT,
   en dat is met opzet: hij bestaat juist voor een sonde die op een ANDERE
   machine draait, waar geen kantoorsessie is. Hij zit achter dezelfde
   RTG_METRICS_TOKEN als /api/metrics, met dezelfde regel: geen token gezet, dan
   alleen vanaf een intern adres. Zonder die twee sloten zou iedereen die het
   pad kent een groene maand kunnen inspuiten, en dan meet dit scherm de
   goedgelovigheid van de server. */
'use strict';

const { meetpoort } = require('../../meetpoort');

module.exports = (ctx) => {
  const { app, officeAuth, veilig, wie, command } = ctx;
  /* bezitsbewijs en doelpoort staan hier niet meer: die twee zijn met de
     schaduwmeters mee verhuisd naar ./schaduwmeters.js, en een naam pakken die
     je niet gebruikt is precies wat regel 39 van de keuring tegenhoudt. */
  /* De routes die iets INRICHTEN (koppelingen, landen, steden, overname) staan
     in ./inrichten.js: dit bestand gaat over meten en uitrollen. Ze zijn uit
     elkaar gehaald toen dit bestand over de 10 kB-grens ging, op de naad die er
     al lag. */
  require('./inrichten')(ctx);

  /* De stand van de doelen: gehaald, niet gehaald, of eerlijk gezegd nog te
     weinig gemeten om er iets over te zeggen. */
  app.post('/api/command/slo', officeAuth, (req, res) => veilig(res, () => command.slo.stand()));

  /* De sonde: wat er gelopen is en wat eruit kwam. */
  app.post('/api/command/sonde', officeAuth, (req, res) => veilig(res, () =>
    command.sonde.stand(Number(req.body.uren || 24))));

  /* Een ronde nu draaien. Vanaf de server zelf, dus dit is de kant 'binnen' en
     het antwoord zegt dat er ook bij. */
  app.post('/api/command/sonde/draai', officeAuth, async (req, res) => {
    try {
      const r = await command.sonde.draai({ reis: req.body.reis ? String(req.body.reis) : null });
      if (r && r.error) return res.status(r.status || 400).json({ error: r.error });
      command.journaal.noteer({ actie: 'sonde ronde', actor: wie(req), niveau: 'hand',
        reden: r.gelukt + ' van ' + r.van_totaal + ' reizen gelukt, kant ' + r.van });
      res.json(r);
    } catch (e) {
      console.error('[command/sonde]', e);
      res.status(500).json({ error: 'De sonde kon deze ronde niet lopen.' });
    }
  });

  /* De canary. Zit bij "besturen" in de schakelkast en niet bij "zien": dit
     verandert wie een functie krijgt, en dat is een uitrolbesluit. */
  app.post('/api/command/canary', officeAuth, (req, res) => veilig(res, () => command.canary.stand()));
  app.post('/api/command/canary/start', officeAuth, (req, res) => veilig(res, () =>
    command.canary.start(String(req.body.id || ''), req.body.deel,
      { door: wie(req), drempel: req.body.drempel, minimum: req.body.minimum })));
  app.post('/api/command/canary/breder', officeAuth, (req, res) => veilig(res, () =>
    command.canary.breder(String(req.body.id || ''), req.body.deel, wie(req))));
  app.post('/api/command/canary/terug', officeAuth, (req, res) => veilig(res, () =>
    command.canary.terug(String(req.body.id || ''), req.body.reden, wie(req), false)));
  app.post('/api/command/canary/af', officeAuth, (req, res) => veilig(res, () =>
    command.canary.af(String(req.body.id || ''), wie(req))));

  /* DE UITROLREGIE. Waar de canary EEN functie over de mensen verdeelt, loopt
     deze de hele trap af: live op de smalste trede, en verder zolang het houdt.
     Staat om dezelfde reden bij "besturen" en niet bij "zien".

     'bevestig' is de enige die een trede met de mensrem opent -- geld en het
     kanaal tussen twee leden gaan nooit vanzelf open. Zie de kop van
     server/kern/command/uitrolregie.js; die grens komt uit GELD.md en LIFE.md
     en is met opzet geen instelling. */
  app.post('/api/command/uitrol', officeAuth, (req, res) => veilig(res, () => command.uitrolregie.stand()));
  app.post('/api/command/uitrol/zet', officeAuth, (req, res) => veilig(res, () =>
    command.uitrolregie.zet(String(req.body.trede || ''), wie(req), 'hand')));
  app.post('/api/command/uitrol/klim', officeAuth, (req, res) => veilig(res, () =>
    command.uitrolregie.klim(wie(req))));
  app.post('/api/command/uitrol/pauze', officeAuth, (req, res) => veilig(res, () =>
    command.uitrolregie.pauze(wie(req), req.body.reden ? String(req.body.reden) : null)));
  app.post('/api/command/uitrol/bevestig', officeAuth, (req, res) => veilig(res, () =>
    command.uitrolregie.bevestig(wie(req))));

  /* De zandbak. Zoeken en recepten draaien hier op een DB-VENSTER met
     zaaigegevens; er is geen pad waarlangs zo'n handeling bij een
     productiecollectie komt. De uitslag draagt altijd `zandbak: true`, zodat
     een scherm hem nooit als productie kan tonen. */
  app.post('/api/command/zandbak', officeAuth, (req, res) => veilig(res, () => command.zandbak.lijst()));
  app.post('/api/command/zandbak/maak', officeAuth, (req, res) => veilig(res, () =>
    command.zandbak.maak(String(req.body.naam || ''), { door: wie(req), dagen: req.body.dagen,
      waarvoor: req.body.waarvoor })));
  app.post('/api/command/zandbak/weg', officeAuth, (req, res) => veilig(res, () =>
    command.zandbak.weg(String(req.body.naam || ''), wie(req))));

  app.post('/api/command/zandbak/zoek', officeAuth, (req, res) => veilig(res, () => {
    const l = command.zandbak.laag(String(req.body.naam || ''));
    if (!l) return { error: 'Die zandbak bestaat niet.', status: 404 };
    return Object.assign({ zandbak: l.naam }, l.zoek(req.body.q, { type: req.body.type }));
  }));

  app.post('/api/command/zandbak/runbook', officeAuth, (req, res) => veilig(res, () => {
    const l = command.zandbak.laag(String(req.body.naam || ''));
    if (!l) return { error: 'Die zandbak bestaat niet.', status: 404 };
    /* Droog is hier de KEUZE van de bediener en niet de veiligheid: nat draaien
       raakt alleen de zandbak. Dat is het hele punt ervan. */
    return Object.assign({ zandbak: l.naam }, l.runbooks.voer(String(req.body.runbook || ''),
      { droog: req.body.droog !== false, door: wie(req), reden: req.body.reden, alleen: req.body.alleen }));
  }));

  app.post('/api/command/zandbak/kwaliteit', officeAuth, (req, res) => veilig(res, () => {
    const l = command.zandbak.laag(String(req.body.naam || ''));
    if (!l) return { error: 'Die zandbak bestaat niet.', status: 404 };
    return Object.assign({ zandbak: l.naam }, l.kwaliteit.meet());
  }));

  /* Master data. Meten mag altijd; samenvoegen is mensenwerk en gaat door het
     journaal, met de oude waarde erin zodat terugdraaien dezelfde handeling
     omgekeerd is. */
  app.post('/api/command/mdm', officeAuth, (req, res) => veilig(res, () => command.mdm.meet()));
  app.post('/api/command/mdm/gouden', officeAuth, (req, res) => veilig(res, () =>
    command.mdm.gouden(String(req.body.sleutel || ''))));
  app.post('/api/command/mdm/samen', officeAuth, (req, res) => veilig(res, () =>
    command.mdm.voegSamen(req.body.doel, req.body.verliezers, wie(req), req.body.reden)));
  app.post('/api/command/mdm/terug', officeAuth, (req, res) => veilig(res, () =>
    command.mdm.terug(req.body.verliezers, wie(req))));

  /* DE GEZONDHEIDSKAART. `stand` is lezen; `controleer` DOET iets (een
     sonderonde, een hashketen narekenen, een back-up openmaken) en is daarom
     een POST die schrijft: de uitslag blijft liggen als bewijsstuk met een
     datum, en gaat het journaal in met de naam van wie hem draaide. Hij is
     async om dezelfde reden als /sonde/draai -- de sonde klopt echt aan. */
  app.post('/api/command/gezondheid', officeAuth, (req, res) => veilig(res, () =>
    command.gezondheid.stand()));
  app.post('/api/command/gezondheid/vermogen', officeAuth, (req, res) => veilig(res, () =>
    command.gezondheid.vermogen(String(req.body.id || ''))));
  app.post('/api/command/gezondheid/controleer', officeAuth, async (req, res) => {
    try {
      const r = await command.gezondheid.controleer(String(req.body.id || ''), wie(req));
      if (r && r.error) return res.status(r.status || 400).json({ error: r.error });
      res.json(r);
    } catch (e) {
      console.error('[command/gezondheid]', e);
      res.status(500).json({ error: 'Deze controleronde kon niet draaien.' });
    }
  });

  /* Het alarm. Piept op verandering en niet elke ronde; stilzetten kan, met een
     einde eraan en een reden in het journaal. */
  app.post('/api/command/alarm', officeAuth, (req, res) => veilig(res, () => command.alarm.stand()));
  app.post('/api/command/alarm/stil', officeAuth, (req, res) => veilig(res, () =>
    command.alarm.stilzetten(String(req.body.id || ''), req.body.uren, wie(req), req.body.reden)));

  /* De melding van buitenaf. Zie de kop hierboven voor de twee sloten. */
  app.post('/api/sonde/melding', meetpoort, (req, res) => {
    const r = command.sonde.meld(req.body || {});
    if (r && r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  require('./schaduwmeters')(ctx);
};
