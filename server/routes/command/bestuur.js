/* RTG Command, deel bestuur: het beleidsregister, de vier-ogen-voorstellen, de
   terugzetknop en de simulatie die vóór een wijziging hoort te komen.

   DE VOLGORDE DIE DEZE ROUTES AANMOEDIGEN: eerst /simulatie/beleid (wat doet
   deze waarde met de routering?), dan /beleid/zet. De server dwingt die
   volgorde niet af -- dat zou betekenen dat je zonder simulatie geen spoedfix
   meer kunt doen -- maar het scherm zet ze wel in die volgorde, en de simulatie
   raakt gegarandeerd niets aan omdat hij met een schaduw-beleid rekent. */
module.exports = ({ app, officeAuth, veilig, wie, command }) => {

  app.post('/api/command/beleid', officeAuth, (req, res) => veilig(res, () => ({
    regels: command.beleid.alles(),
    voorstellen: command.beleid.voorstellen(),
    open: command.beleid.openVoorstellen().length
  })));

  app.post('/api/command/beleid/zet', officeAuth, (req, res) => veilig(res, () =>
    command.beleid.zet(String(req.body.id || ''), req.body.waarde, wie(req), req.body.reden, req.body.bereik)));

  /* Het tweede paar ogen. Dat 'wie' uit de sessie komt is hier niet
     administratief maar functioneel: de kern weigert een goedkeuring van
     dezelfde actor als de indiener, en dat werkt alleen als de actor niet uit
     de body komt. */
  app.post('/api/command/beleid/keur', officeAuth, (req, res) => veilig(res, () =>
    command.beleid.keur(String(req.body.voorstel || ''), wie(req), !!req.body.akkoord, req.body.reden)));

  app.post('/api/command/beleid/terug', officeAuth, (req, res) => veilig(res, () =>
    command.beleid.terug(String(req.body.id || ''), wie(req), req.body.reden)));

  app.post('/api/command/beleid/geschiedenis', officeAuth, (req, res) => veilig(res, () =>
    command.beleid.geschiedenis(String(req.body.id || ''))));

  /* De digitale tweeling. Beide proeven raken niets aan: watAls rekent op
     kopieën van de aantallen, beleidsproef op een schaduw-beleid. */
  app.post('/api/command/simulatie/watals', officeAuth, (req, res) => veilig(res, () =>
    command.simulatie.watAls({ groeiProcent: req.body.groei, plaats: req.body.plaats,
      capaciteitErbij: req.body.capaciteit })));

  app.post('/api/command/simulatie/beleid', officeAuth, (req, res) => veilig(res, () =>
    command.simulatie.beleidsproef(String(req.body.id || ''), req.body.waarde)));

  /* Het journaal: onveranderlijk, met de ketencontrole erbij. Dat laatste is
     geen sier -- een auditspoor waarvan je de heelheid niet kunt nakijken, is
     een lijst die je op zijn woord moet geloven. */
  app.post('/api/command/journaal', officeAuth, (req, res) => veilig(res, () => ({
    regels: command.journaal.recent(Number(req.body.n || 60), {
      actor: req.body.actor, actie: req.body.actie, niveau: req.body.niveau }),
    aantal: command.journaal.aantal(),
    venster: command.journaal.venster(),
    keten: command.journaal.controleer()
  })));

  /* Forensic replay: achteraf reconstrueren wat er tussen twee momenten
     gebeurde, met per stap de toestand ervoor en erna. */
  app.post('/api/command/journaal/herbeleef', officeAuth, (req, res) => veilig(res, () =>
    command.journaal.herbeleef(req.body.van, req.body.tot,
      { objectType: req.body.type, objectId: req.body.id })));
};
