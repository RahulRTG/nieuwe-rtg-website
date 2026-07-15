/* Domein "supplier" (deelmodule): de AI-bedrijfsagent (kern/agent.js).
   De zaak koppelt een vaste leverancier (groothandel); de AI stelt inkoop-
   lijsten voor (verkoop + mise en place + verwachte drukte) en een week-
   rooster op de verwachte drukte. De gemachtigde (manager) keurt goed,
   past aan of wijst af; pas dan wordt er echt besteld of vastgesteld. */
module.exports = (kern) => {
  const { app, supplierAuth, managerOnly,
    agentKoppel, agentPubliek, agentVoorstel, agentBeslis, roosterVoorstel, roosterBeslis } = kern;

  // de agent-toestand: koppeling, voorstellen en het roostervoorstel
  app.post('/api/supplier/agent', supplierAuth, (req, res) => res.json({ agent: agentPubliek(req.supplier) }));

  // de vaste leverancier koppelen (alleen de gemachtigde)
  app.post('/api/supplier/agent/koppel', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = agentKoppel(req.supplier, String(req.body.groothandelCode || ''), req.body.auto);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });

  // een inkoopvoorstel maken (elke medewerker mag het aanvragen; bestellen kan alleen de gemachtigde)
  app.post('/api/supplier/agent/voorstel', supplierAuth, (req, res) => {
    const r = agentVoorstel(req.supplier, req.actor);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });

  // de gemachtigde beslist: akkoord (eventueel met aangepaste regels) of afwijzen
  app.post('/api/supplier/agent/beslis', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = agentBeslis(req.supplier, String(req.body.id || ''), String(req.body.actie || 'akkoord'), req.body.regels, req.actor);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });

  // het AI-weekrooster: voorstellen en vaststellen (alleen de gemachtigde)
  app.post('/api/supplier/rooster/voorstel', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = roosterVoorstel(req.supplier);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/supplier/rooster/beslis', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = roosterBeslis(req.supplier, String(req.body.actie || 'akkoord'), req.actor);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
};
