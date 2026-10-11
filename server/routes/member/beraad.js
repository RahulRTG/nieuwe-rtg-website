/* Het beraad (B3, kern/beraad/): samen overleggen en besluiten in een genootschap.

   Alle routes zijn leden-routes (auth + geenGast) en NIET een van die paden staat
   op een lijst in kern/stuur/beleid-lijsten.js: de AI kan hier niet stemmen, niet
   inbrengen en niet besluiten (beleidVoor() zegt `verboden`). De schrijvende
   routes weigeren daarnaast zelf een verzoek dat het agentkenmerk van Rahul
   draagt -- twee sloten, zodat een vergissing op de lijst niet genoeg is.
   Rahul komt alleen binnen via /api/beraad/hulp, en die LEEST.

   Het beraad-id staat in `beraad`; de actor komt altijd uit de sessie.
   Gemount vanuit routes/member.js. */
'use strict';
const { veiligeFout } = require('../../kern/util');
const { agentVan } = require('../../kern/agentteken');

module.exports = (kern) => {
  const { app, auth, geenGast, beraad, beraadAI } = kern;
  const fout = (res, e) => res.status(400).json({ error: veiligeFout(e) });
  const uit = (res, r) => (r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r));
  const id = (req) => (req.body || {}).beraad;

  /* Een mens handelt hier, nooit een agent namens hem. */
  function mens(req, res) {
    if (geenGast(req, res)) return false;
    if (agentVan(req)) {
      res.status(403).json({ error: 'In een beraad handelt een mens zelf. Rahul kan samenvatten en een concept klaarzetten, niet inbrengen, stemmen of besluiten.' });
      return false;
    }
    return true;
  }
  /* Elke route staat VOLUIT als app.post(...): een pad dat via een hulpje wordt
     opgebouwd, ziet de schakelkast en de routemeters niet. */
  const doe = (req, res, f) => { if (!mens(req, res)) return; try { uit(res, f()); } catch (e) { fout(res, e); } };

  app.post('/api/beraad/open', auth, (req, res) => doe(req, res, () => beraad.open(req.session, req.body || {})));
  app.post('/api/beraad/inbreng', auth, (req, res) => doe(req, res, () => beraad.inbreng(req.session, id(req), req.body || {})));
  app.post('/api/beraad/voorstel', auth, (req, res) => doe(req, res, () => beraad.voorstel(req.session, id(req), req.body || {})));
  app.post('/api/beraad/naar-stemmen', auth, (req, res) => doe(req, res, () => beraad.naarStemmen(req.session, id(req))));
  app.post('/api/beraad/stem', auth, (req, res) => doe(req, res, () => beraad.stem(req.session, id(req), (req.body || {}).keuze)));
  app.post('/api/beraad/sluit', auth, (req, res) => doe(req, res, () => beraad.sluit(req.session, id(req), req.body || {})));
  app.post('/api/beraad/heropen', auth, (req, res) => doe(req, res, () => beraad.heropen(req.session, id(req), req.body || {})));
  app.post('/api/beraad/terugkoppeling-gezien', auth, (req, res) => doe(req, res, () => beraad.gezien(req.session, id(req))));

  app.post('/api/beraad/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json(beraad.mijn(req.session)); } catch (e) { fout(res, e); }
  });

  app.post('/api/beraad/lees', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, beraad.lees(req.session, id(req))); } catch (e) { fout(res, e); }
  });

  /* Rahul: drie lezende taken. Niets wordt bewaard; het concept gaat terug naar
     het invoerveld van het lid. */
  const TAKEN = { samenvatting: 'samenvatting', perspectieven: 'perspectieven', concept: 'concept' };
  app.post('/api/beraad/hulp', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try {
      const taak = TAKEN[String((req.body || {}).taak || '')];
      if (!taak) return res.status(400).json({ error: 'Kies een taak: samenvatting, perspectieven of concept.' });
      const r = beraadAI[taak](req.session, id(req));
      res.status(r.ok ? 200 : (r.status || 400)).json(r.ok ? r : { error: r.reden });
    } catch (e) { fout(res, e); }
  });
};
