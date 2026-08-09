/* RTG Command, deel toezicht: de agents met hun budgetten en grenzen, en de
   rechten die vanzelf weer weggaan.

   WAAROM DIT ÉÉN DEEL IS. Een agent-budget en een tijdelijk mensenrecht zijn
   dezelfde vraag in twee vormen: wie mag nu hoeveel, en tot wanneer? Ze in twee
   schermen zetten zou betekenen dat je bij een incident op twee plekken moet
   kijken om te weten wie er aan de knoppen zat. */
module.exports = ({ app, officeAuth, veilig, wie, command }) => {

  app.post('/api/command/agents', officeAuth, (req, res) => veilig(res, () =>
    ({ agents: command.toezicht.alle() })));

  app.post('/api/command/agent/stop', officeAuth, (req, res) => veilig(res, () =>
    command.toezicht.stop(String(req.body.naam || ''), wie(req), req.body.reden)));

  app.post('/api/command/agent/hervat', officeAuth, (req, res) => veilig(res, () =>
    command.toezicht.hervat(String(req.body.naam || ''), wie(req), req.body.reden)));

  app.post('/api/command/agent/rechten', officeAuth, (req, res) => veilig(res, () =>
    command.toezicht.zetGrenzen(String(req.body.naam || ''), req.body.mag, wie(req), req.body.reden)));

  /* De rechtengraaf: wie heeft nu welk zwaar recht, van wie gekregen, waarom en
     tot wanneer. Bij een audit is dat de eerste vraag. */
  app.post('/api/command/rechten', officeAuth, (req, res) => veilig(res, () =>
    command.toegang.graaf()));

  app.post('/api/command/recht/geef', officeAuth, (req, res) => veilig(res, () =>
    command.toegang.geef(String(req.body.recht || ''), req.body.aan, wie(req), req.body.reden, req.body.minuten)));

  /* De nooddeur. Hij bestaat, hij is kort, en hij is luid: de kern eist een
     volledige reden en zet hem in het journaal met risico 95. */
  app.post('/api/command/recht/nood', officeAuth, (req, res) => veilig(res, () =>
    command.toegang.breekGlas(String(req.body.recht || ''), wie(req), req.body.reden)));

  app.post('/api/command/recht/introk', officeAuth, (req, res) => veilig(res, () =>
    command.toegang.trekIn(String(req.body.id || ''), wie(req), req.body.reden)));

  app.post('/api/command/mandaat', officeAuth, (req, res) => veilig(res, () =>
    command.toegang.mandaat(req.body.van, req.body.aan, req.body.terrein, wie(req), req.body.tot, req.body.reden)));
};
