/* Permanente controlelaag: live integriteit, code-/route-inventaris en een
   herstelbare incidentstand. Alle routes zijn eigenaar-only en blijven zelf
   buiten de functieschakelaars. */
'use strict';

const path = require('path');
const functies = require('../../functies');
const maakIntegriteit = require('../../kern/integriteitswacht');
const maakInventaris = require('../../kern/code-inventaris');
const maakIncident = require('../../kern/incidentcontrole');

module.exports = function mountControle(c) {
  const { app, db, save, beveilig, av, techAuth, eigenaarAlleen } = c;
  const root = path.join(__dirname, '../../..');
  const integriteit = maakIntegriteit({ root });
  const inventaris = maakInventaris({ app, functies, integriteit });
  const incident = maakIncidentcontrole();
  let inventarisCache = null;

  function maakIncidentcontrole() {
    return maakIncident({ db, save, functies, beveilig });
  }

  function dreiging() {
    const a = av ? av.stand() : null;
    const laatste = a && Array.isArray(a.laatste) ? a.laatste : [];
    return {
      antivirus: a ? { totaal: a.totaal, besmet: a.besmet, verdacht: a.verdacht,
        laatste: laatste.slice(0, 10).map(x => {
          const f = String(x.naam || '').startsWith('/api/') ? functies.functieVoorPad(x.naam) : null;
          return Object.assign({}, x, { aanbevolenFunctie: f ? f.id : null });
        }) } : null,
      codeAfwijking: !!(integriteit.status().laatst && !integriteit.status().laatst.ok)
    };
  }

  function status() {
    if (!inventarisCache) inventarisCache = inventaris.samenvatting();
    return { incident: incident.status(), integriteit: integriteit.status(),
      inventaris: inventarisCache, dreiging: dreiging() };
  }

  app.get('/api/techniek/controle/status', techAuth, eigenaarAlleen, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(status());
  });

  app.post('/api/techniek/controle/integriteit', techAuth, eigenaarAlleen, (req, res) => {
    const uit = integriteit.controleer();
    if (uit.laatst && !uit.laatst.ok && beveilig) beveilig.meld('code-integriteit', 'kritiek',
      'De live code wijkt af van het releasebewijs (' + uit.laatst.verschillen + ' verschil(len)). Zet verdachte functies gericht uit of isoleer het platform.',
      { bron: 'releasebewijs' });
    res.set('Cache-Control', 'no-store');
    // De scan zelf is geslaagd, ook als hij een afwijking vindt. Een 200 laat
    // de controlekamer de volledige uitslag tekenen; `laatst.ok` is het oordeel.
    res.json(uit);
  });

  app.get('/api/techniek/controle/inventaris', techAuth, eigenaarAlleen, (req, res) => {
    const soort = req.query.soort === 'routes' ? 'routes' : 'bestanden';
    res.set('Cache-Control', 'no-store');
    res.json(Object.assign({ samenvatting: inventarisCache || (inventarisCache = inventaris.samenvatting()) },
      inventaris.pagina(soort, req.query)));
  });

  app.post('/api/techniek/controle/incident', techAuth, eigenaarAlleen, (req, res) => {
    const body = req.body || {};
    try {
      let uit;
      if (body.actie === 'waakzaam') uit = incident.waakzaam(body.reden, req.techUser);
      else if (body.actie === 'beperk') uit = incident.beperk(body, req.techUser);
      else if (body.actie === 'isoleer') {
        if (body.bevestiging !== 'ISOLEER RTG')
          return res.status(400).json({ error: 'Typ exact ISOLEER RTG om de hele app veilig af te sluiten.' });
        uit = incident.isoleer(body.reden, req.techUser);
      } else if (body.actie === 'herstel') {
        if (body.bevestiging !== 'HERSTEL RTG')
          return res.status(400).json({ error: 'Typ exact HERSTEL RTG om de bewaarde standen terug te zetten.' });
        uit = incident.herstel(body.reden, req.techUser);
      } else return res.status(400).json({ error: 'Actie moet waakzaam, beperk, isoleer of herstel zijn.' });
      res.json({ ok: true, incident: uit });
    } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Incidenthandeling mislukte.' }); }
  });

  return { status };
};
