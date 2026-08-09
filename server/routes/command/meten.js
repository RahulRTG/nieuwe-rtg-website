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

  /* De melding van buitenaf. Zie de kop hierboven voor de twee sloten. */
  app.post('/api/sonde/melding', meetpoort, (req, res) => {
    const r = command.sonde.meld(req.body || {});
    if (r && r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
};
