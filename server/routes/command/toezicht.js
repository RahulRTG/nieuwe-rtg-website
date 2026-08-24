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

  /* ---------- RTG BIJSTAND, de RTG-kant ----------

     ER STAAT HIER GEEN ROUTE DIE EEN SESSIE AANMAAKT, en dat is geen omissie
     maar de belofte: een sessie ontstaat aan de KLANTKANT
     (routes/tenant/bijstand.js). Wie dat wil veranderen, moet daar bijbouwen --
     en dat valt op.

     `wie(req)` is ook hier de enige bron van de actor, en de kern weigert een
     gedeelde kantoorcode: die naam kan niet in een herstelverslag staan als
     degene die het deed. */
  app.post('/api/command/bijstand', officeAuth, (req, res) => veilig(res, () => ({
    sessies: command.bijstand.lijst({ alleenLevend: !req.body.alles, max: req.body.max }),
    tel: command.bijstand.tel(), niveaus: command.bijstand.NIVEAUS
  })));
  /* Ook `sessie` geeft `{ sessie: ... }` terug en niet het dossier kaal: elke
     ingang hier levert dezelfde vorm, zodat het scherm er één lezer voor heeft.
     Een route die als enige iets anders teruggeeft, is de route waar een
     frontend op stukloopt. */
  app.post('/api/command/bijstand/sessie', officeAuth, (req, res) => veilig(res, () => {
    const d = command.bijstand.dossier(String(req.body.id || ''));
    return d.error ? d : { sessie: d };
  }));
  app.post('/api/command/bijstand/betreed', officeAuth, (req, res) => veilig(res, () =>
    command.bijstand.betreed(String(req.body.id || ''), wie(req))));
  app.post('/api/command/bijstand/kijk', officeAuth, (req, res) => veilig(res, () =>
    command.bijstand.kijk(String(req.body.id || ''), wie(req), req.body.wat)));
  app.post('/api/command/bijstand/voorstel', officeAuth, (req, res) => veilig(res, () =>
    command.bijstand.stelVoor(String(req.body.id || ''), wie(req),
      { wat: req.body.wat, waarom: req.body.waarom })));
  app.post('/api/command/bijstand/uitvoeren', officeAuth, (req, res) => veilig(res, () =>
    command.bijstand.voerUit(String(req.body.id || ''), wie(req), req.body.index, req.body.uitslag)));
  app.post('/api/command/bijstand/inhoud', officeAuth, (req, res) => veilig(res, () =>
    command.bijstand.vraagInhoud(String(req.body.id || ''), wie(req), req.body.reden)));
  app.post('/api/command/bijstand/sluit', officeAuth, (req, res) => veilig(res, () =>
    command.bijstand.sluit(String(req.body.id || ''), wie(req), req.body.verslag)));

  /* ---------- HET VLOOTBEELD ----------
     Alle organisaties in één beeld, en de afdaling naar er één. Verder dan dat
     gaat het niet: `dieper.mag` staat op false met de reden erbij, en die reden
     is geen tekst maar de bouw -- er is geen route die dieper kijkt. */
  app.post('/api/command/vloot', officeAuth, (req, res) => veilig(res, () =>
    command.vlootbeeld.beeld()));
  app.post('/api/command/vloot/organisatie', officeAuth, (req, res) => veilig(res, () =>
    command.vlootbeeld.organisatie(String(req.body.org || ''))));
};
