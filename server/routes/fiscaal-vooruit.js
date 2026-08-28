/* Routes voor VOORUITKIJKEN en voor AANSLUITEN ZONDER ALLES TE LATEN ZIEN.

   Twee dingen die niets met elkaar te maken hebben behalve dat ze allebei bij
   de zaak horen en allebei klein zijn:

   - de scenario-engine (kern/fiscaal/scenario.js): wat gebeurt er als ik dit
     doe. Muteert niets, en kan dat structureel niet.
   - de verbintenis (kern/fiscaal/verbintenis.js): een wortel over de getelde
     feiten, zodat een inspecteur kan aansluiten zonder het hele factuurregister
     te lezen.

   BEIDE ALLEEN VOOR EEN MANAGER, en de zaak komt uit het token. Een scenario
   verklapt wat een onderneming overweegt, en een verbintenis hangt aan de
   omzet van een periode; dat is geen van beide iets voor de buurman. */
module.exports = (kern) => {
  const { app, supplierAuth, scenario, verbintenis, btwAangifte, schoon } = kern;
  if (!scenario && !verbintenis) return;

  const stuur = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);
  const managerOf = (req, res) => {
    if (!req.actor || !req.actor.manager) { res.status(403).json({ error: 'Alleen voor management.' }); return null; }
    return req.actor.name || 'manager';
  };

  /* ---- vooruitkijken ---- */
  app.post('/api/supplier/scenario/personeel', supplierAuth, (req, res) => {
    if (!managerOf(req, res)) return;
    if (!scenario) return res.status(503).json({ error: 'De scenario-engine draait niet.' });
    const b = req.body || {};
    stuur(res, scenario.personeel({ land: schoon(b.land, 3), aantal: b.aantal,
      brutoPerMaandCenten: b.brutoPerMaandCenten, datum: schoon(b.datum, 10) }));
  });

  app.post('/api/supplier/scenario/omzet', supplierAuth, (req, res) => {
    if (!managerOf(req, res)) return;
    if (!scenario) return res.status(503).json({ error: 'De scenario-engine draait niet.' });
    const b = req.body || {};
    stuur(res, scenario.omzet({ land: schoon(b.land, 3), omzetCenten: b.omzetCenten,
      categorie: schoon(b.categorie, 20), datum: schoon(b.datum, 10) }));
  });

  /* ---- de verbintenis over een periode ----
     De feiten komen uit de telling die de aangifte ook gebruikt; hier gaat
     alleen de WORTEL en het totaal naar buiten. Wat er niet uit gaat, is de
     lijst facturen -- dat is het hele punt. */
  app.post('/api/supplier/verbintenis', supplierAuth, (req, res) => {
    if (!managerOf(req, res)) return;
    if (!verbintenis || !btwAangifte) return res.status(503).json({ error: 'De verbintenis draait niet.' });
    const vak = btwAangifte.periodeVak(schoon((req.body || {}).periode, 10));
    if (!vak) return res.status(400).json({ error: 'Geef een periode als 2026K3 of 2026-07.' });
    const t = btwAangifte.tel(req.supplier.code, vak);
    if (t.zonderRegels.length) return res.status(422).json({
      error: 'Er staan facturen zonder regels in deze periode; die zijn aan geen tarief toe te wijzen.',
      nummers: t.zonderRegels.slice(0, 5) });
    const feiten = Object.values(t.verkoop).map(p => ({ tarief: p.tarief, btwCenten: p.btwCenten }));
    stuur(res, Object.assign({ periode: vak.periode, van: vak.van, tot: vak.tot },
      verbintenis.leg(feiten, t.verkoopSom)));
  });
};
