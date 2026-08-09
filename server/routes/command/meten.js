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

module.exports = ({ app, officeAuth, veilig, wie, command }) => {

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

  /* De melding van buitenaf. Zie de kop hierboven voor de twee sloten. */
  app.post('/api/sonde/melding', meetpoort, (req, res) => {
    const r = command.sonde.meld(req.body || {});
    if (r && r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
};
