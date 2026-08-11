/* RTG Command, deel herstel: de runbooks, het droog draaien, het uitvoeren,
   het terugdraaien en de uitzonderingenrij.

   DROOG IS DE STANDAARD. `droog` moet expliciet op false om iets te veranderen;
   wie het veld vergeet, krijgt een droogloop en geen wijziging. Een schrijfpad
   dat standaard schrijft, is een schrijfpad waar je per ongeluk op komt. */
module.exports = ({ app, officeAuth, veilig, wie, command }) => {

  app.post('/api/command/runbooks', officeAuth, (req, res) => veilig(res, () =>
    ({ runbooks: command.runbooks.lijst() })));

  app.post('/api/command/runbook/voer', officeAuth, (req, res) => veilig(res, () =>
    command.runbooks.voer(String(req.body.id || ''), {
      droog: req.body.droog !== false,
      door: wie(req),
      reden: req.body.reden,
      alleen: Array.isArray(req.body.alleen) ? req.body.alleen : null,
      max: req.body.max,
      /* Het menselijk akkoord is geen vinkje dat de grendel opheft: de kern
         eist het pas als de routering op 'hand' uitkomt, en dan is het de
         handtekening van degene die het scherm bediende. */
      menselijkAkkoord: !!req.body.menselijkAkkoord
    })));

  app.post('/api/command/runbook/terug', officeAuth, (req, res) => veilig(res, () =>
    command.runbooks.draaiTerug(String(req.body.run || ''), wie(req), req.body.reden)));

  app.post('/api/command/runs', officeAuth, (req, res) => veilig(res, () =>
    req.body.id ? ({ run: command.runbooks.run(String(req.body.id)) })
      : ({ runs: command.runbooks.runs(Number(req.body.n || 25)) })));

  /* De uitzonderingenrij: alleen wat de automatisering écht niet zelf kon. */
  app.post('/api/command/zaken', officeAuth, (req, res) => veilig(res, () => ({
    zaken: command.zaken.lijst({ status: req.body.status, domein: req.body.domein,
      eigenaar: req.body.eigenaar, oorzaak: req.body.oorzaak, max: req.body.max }),
    tellingen: command.zaken.tellingen(),
    leerpunten: command.zaken.leerpunten(3)
  })));

  app.post('/api/command/zaak/open', officeAuth, (req, res) => veilig(res, () =>
    ({ zaak: command.zaken.open({
      titel: req.body.titel, domein: req.body.domein, objectType: req.body.objectType,
      objectId: req.body.objectId, oorzaak: req.body.oorzaak, bron: 'kantoor',
      door: wie(req), niveau: 'hand', reden: req.body.reden,
      bewijs: req.body.bewijs || null }) })));

  app.post('/api/command/zaak/neem', officeAuth, (req, res) => veilig(res, () =>
    command.zaken.neem(String(req.body.id || ''), wie(req))));

  app.post('/api/command/zaak/besluit', officeAuth, (req, res) => veilig(res, () =>
    command.zaken.besluit(String(req.body.id || ''), wie(req), req.body.keuze, req.body.reden)));

  /* Het werkbesparingsbord: hoeveel handwerk kost dit platform nog, en waar
     zit het volgende lek. Dit is de meter waarop deze hele laag zichzelf kan
     tegenspreken -- daarom staat hij in dezelfde app en niet in een rapport. */
  app.post('/api/command/werk', officeAuth, (req, res) => veilig(res, () => ({
    bord: command.werkbesparing.bord(Number(req.body.dagen || 30)),
    opbrengst: command.werkbesparing.opbrengst()
  })));
};
