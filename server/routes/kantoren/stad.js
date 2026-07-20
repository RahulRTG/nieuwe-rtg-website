/* Kantoren, deel "stad": RTG Stad vanuit de boardroom. Het stadsbeeld, de
   scenario-knop (een druk zet de hele stad in een stand), losse regimes per
   domein, het beheer van de Stadsdoos-vloot (eigen hardware) en de
   AI-stadsregisseur. Alles achter de office-inlog en in het auditlog; de twee
   /api/stad/doos-poorten zijn voor de hardware zelf en lopen op de
   apparaat-sleutel van de doos. Afgesplitst uit kantoren/index.js. */
module.exports = (ctx) => {
  const { app, officeAuth, veilig, afdelingen, kern } = ctx;
  const stad = kern.stad;
  const naam = req => (req.body && req.body.naam ? String(req.body.naam) : 'boardroom');

  // het bord: scenario, domeinen met stand + regime, waarschuwingen, de vloot
  app.post('/api/office/stad', officeAuth, (req, res) => veilig(res, () => stad.stadBeeld()));

  // de scenario-knop: een druk verzet alle regimes; nood meldt ook de meldkamer
  app.post('/api/office/stad/scenario', officeAuth, (req, res) => veilig(res, () => {
    const r = stad.stadScenarioZet({ naam: String(req.body.scenario || ''), wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'RTG Stad-scenario "' + r.scenario + '"' + (r.scenario === 'nood' ? ' -- NOOD, meldkamer gemeld' : ''));
    return r;
  }));

  // een los regime verzetten (naast de knop), altijd met een naam in het log
  app.post('/api/office/stad/regime', officeAuth, (req, res) => veilig(res, () => {
    const r = stad.stadRegimeZet({ domein: req.body.domein, regime: req.body.regime, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'RTG Stad-regime ' + r.domein + ' -> "' + r.regime + '"');
    return r;
  }));

  /* De vloot: een echte Stadsdoos aanmelden (de sleutel wordt EEN keer
     getoond) of uit dienst nemen. */
  app.post('/api/office/stad/node/aanmeld', officeAuth, (req, res) => veilig(res, () => {
    const r = stad.stadNodeAanmeld({ naam: req.body.doosNaam, zone: req.body.zone, sensoren: req.body.sensoren, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Stadsdoos ' + r.serial + ' aangemeld');
    return r;
  }));
  app.post('/api/office/stad/node/stop', officeAuth, (req, res) => veilig(res, () => {
    const r = stad.stadNodeStop({ serial: req.body.serial, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Stadsdoos ' + r.serial + ' uit dienst');
    return r;
  }));

  // de AI-stadsregisseur: adviseert, beslist niet
  app.post('/api/office/stad/advies', officeAuth, async (req, res) => {
    try { const r = await stad.stadAdvies({ vraag: req.body.vraag });
      r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
    } catch (e) { console.error('[stad]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* De hardware-poorten: de Stadsdoos zelf meldt zich met serienummer +
     apparaat-sleutel. Geen office-inlog (het kastje hangt buiten), wel een
     eigen sleutel per doos; alles wat niet klopt wordt geweigerd. */
  app.post('/api/stad/doos/hartslag', (req, res) => veilig(res, () =>
    stad.stadDoosHartslag({ serial: req.body.serial, sleutel: String(req.body.sleutel || '') })));
  app.post('/api/stad/doos/meting', (req, res) => veilig(res, () =>
    stad.stadDoosMeting({ serial: req.body.serial, sleutel: String(req.body.sleutel || ''), metingen: req.body.metingen })));
};
