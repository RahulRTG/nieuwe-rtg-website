/* Zaak Command, deel herstel: de recepten, het droog draaien, het uitvoeren, het
   terugdraaien, de signalen en de uitzonderingenrij van de zaak.

   DROOG IS DE STANDAARD, net als aan de RTG-kant: `droog` moet expliciet op
   false om iets te veranderen. Wie het veld vergeet krijgt een droogloop.

   HERSTELLEN IS MANAGEMENT. Kijken mag iedereen in de zaak-app -- ook een
   medewerker op de PDA moet kunnen zien wat er vastzit. Iets rechtzetten,
   terugdraaien of besluiten is voor het management, met dezelfde grens die de
   rest van de app trekt. */
module.exports = ({ app, supplierAuth, managerOnly, veilig, laag, wie }) => {

  app.post('/api/supplier/command/runbooks', supplierAuth, (req, res) => veilig(res, () =>
    ({ runbooks: laag(req).runbooks.lijst() })));

  app.post('/api/supplier/command/runbook/voer', supplierAuth, (req, res) => veilig(res, () => {
    const droog = req.body.droog !== false;
    if (!droog && !managerOnly(req, res)) return null;
    return laag(req).runbooks.voer(String(req.body.id || ''), {
      droog, door: wie(req), reden: req.body.reden,
      alleen: Array.isArray(req.body.alleen) ? req.body.alleen : null,
      menselijkAkkoord: !!req.body.menselijkAkkoord
    });
  }));

  app.post('/api/supplier/command/runbook/terug', supplierAuth, (req, res) => veilig(res, () => {
    if (!managerOnly(req, res)) return null;
    return laag(req).runbooks.draaiTerug(String(req.body.run || ''), wie(req), req.body.reden);
  }));

  app.post('/api/supplier/command/runs', supplierAuth, (req, res) => veilig(res, () =>
    req.body.id ? ({ run: laag(req).runbooks.run(String(req.body.id)) })
      : ({ runs: laag(req).runbooks.runs(Number(req.body.n || 20)) })));

  /* De signalen: wat er op een mens wacht. Kijken mag iedereen; er een
     uitzondering van maken (met eigenaar en termijn) ook -- dat is juist wat je
     wilt dat een medewerker op de vloer doet in plaats van het te laten liggen. */
  app.post('/api/supplier/command/signalen', supplierAuth, (req, res) => veilig(res, () =>
    ({ signalen: laag(req).signalen.voor(req.supplier) })));

  app.post('/api/supplier/command/signaal/oppakken', supplierAuth, (req, res) => veilig(res, () =>
    laag(req).signaalOppakken(String(req.body.id || ''), wie(req))));

  app.post('/api/supplier/command/zaken', supplierAuth, (req, res) => veilig(res, () => {
    const c = laag(req);
    return { zaken: c.zaken.lijst({ status: req.body.status, domein: req.body.domein,
      eigenaar: req.body.eigenaar, max: req.body.max }),
      tellingen: c.zaken.tellingen(), leerpunten: c.zaken.leerpunten(3) };
  }));

  app.post('/api/supplier/command/zaak/neem', supplierAuth, (req, res) => veilig(res, () =>
    laag(req).zaken.neem(String(req.body.id || ''), wie(req))));

  app.post('/api/supplier/command/zaak/besluit', supplierAuth, (req, res) => veilig(res, () => {
    if (!managerOnly(req, res)) return null;
    return laag(req).zaken.besluit(String(req.body.id || ''), wie(req), req.body.keuze, req.body.reden);
  }));

  app.post('/api/supplier/command/werk', supplierAuth, (req, res) => veilig(res, () => {
    if (!managerOnly(req, res)) return null;
    const c = laag(req);
    return { bord: c.werkbesparing.bord(Number(req.body.dagen || 30)), opbrengst: c.werkbesparing.opbrengst() };
  }));
};
