/* RTG Command, deel bestuur: het beleidsregister, de vier-ogen-voorstellen, de
   terugzetknop en de simulatie die vóór een wijziging hoort te komen.

   DE VOLGORDE DIE DEZE ROUTES AANMOEDIGEN: eerst /simulatie/beleid (wat doet
   deze waarde met de routering?), dan /beleid/zet. De server dwingt die
   volgorde niet af -- dat zou betekenen dat je zonder simulatie geen spoedfix
   meer kunt doen -- maar het scherm zet ze wel in die volgorde, en de simulatie
   raakt gegarandeerd niets aan omdat hij met een schaduw-beleid rekent. */
const klok = require('../../lib/klok');

module.exports = ({ app, officeAuth, veilig, wie, command, apiSpoor }) => {

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

  /* HET API-SPOOR: dezelfde vraag, een laag lager. Het journaal hierboven gaat
     over BESLUITEN (met een reden, een oude en een nieuwe toestand); dit gaat
     over HANDELINGEN: elke geslaagde schrijfaanroep op de API, met wie, wat,
     wanneer en welke status. Twee aparte ketens, want een breuk in het ene zegt
     iets anders dan een breuk in het andere -- zie server/opzet/auditspoor.js.

     `keten` staat er ook hier bij, en om dezelfde reden: een spoor waarvan je
     de heelheid niet kunt nakijken, is een lijst die je op je woord moet
     geloven. Dit is de route waarmee scripts/auditproef-route.js meet of een
     schrijfroute werkelijk een spoor nalaat. */
  app.post('/api/command/apispoor', officeAuth, (req, res) => veilig(res, () => {
    const spoor = apiSpoor;
    if (!spoor) return { status: 503, error: 'Het API-spoor is niet opgezet in dit proces.' };
    return {
      regels: spoor.recent(Math.min(Number(req.body.n || 50) || 50, 500), {
        actor: req.body.actor, actie: req.body.actie }),
      aantal: spoor.aantal(),
      venster: spoor.venster(),
      keten: spoor.controleer()
    };
  }));

  /* De gegevenskwaliteit: wat er in de gegevens zelf kapot is. Apart van de
     runbooks, want dat gaat over toestanden die verkeerd zijn en dit over
     rijen die niet kloppen -- een dubbele sleutel is geen bedrijfsprobleem
     maar een administratieprobleem, en het valt zelden op. */
  app.post('/api/command/kwaliteit', officeAuth, (req, res) => veilig(res, () => command.kwaliteit.meet()));

  /* De kennisgraaf: hoe hangt het geheel samen, en wat ligt er twee stappen
     verderop. De randen zijn gemeten uit de gegevens, niet uit een schema. */
  app.post('/api/command/graaf', officeAuth, (req, res) => veilig(res, () => command.graaf.vorm()));
  app.post('/api/command/graaf/wandel', officeAuth, (req, res) => veilig(res, () =>
    command.graaf.wandel(String(req.body.type || ''), String(req.body.id || ''), req.body.diepte)));

  /* De herkomst: waar komt een gegeven vandaan en wie hangt ervan af. Derde
     vraag op dezelfde meting, en het enige scherm waar naast elk antwoord staat
     hoe hard het is: gemeten, aangegeven of daaruit gerekend. */
  app.post('/api/command/herkomst', officeAuth, (req, res) => veilig(res, () => command.herkomst.kaart()));
  app.post('/api/command/herkomst/spoor', officeAuth, (req, res) => veilig(res, () =>
    command.herkomst.spoor(String(req.body.type || ''), String(req.body.id || ''))));

  /* Forensic replay: achteraf reconstrueren wat er tussen twee momenten
     gebeurde, met per stap de toestand ervoor en erna. */
  app.post('/api/command/journaal/herbeleef', officeAuth, (req, res) => veilig(res, () =>
    command.journaal.herbeleef(req.body.van, req.body.tot,
      { objectType: req.body.type, objectId: req.body.id })));

  /* DE CONFIGURATIETIJDLIJN. `rondom` is de vraag waar hij voor bestaat: wat is
     er vlak vóór dit moment veranderd. Het antwoord draagt altijd de zin mee dat
     volgorde geen oorzaak is -- een tijdlijn zonder die zin wordt binnen een
     week gelezen als een oorzakenlijst. */
  app.post('/api/command/tijdlijn', officeAuth, (req, res) => veilig(res, () =>
    command.tijdlijn.lijst({ bron: req.body.bron, vanaf: req.body.vanaf, tot: req.body.tot, max: req.body.max })));
  app.post('/api/command/tijdlijn/rondom', officeAuth, (req, res) => veilig(res, () =>
    command.tijdlijn.rondom(String(req.body.moment || klok.datum().toISOString()), req.body.minuten)));
};
