/* Domein "command": RTG Command, de bestuurslaag van het RTG- en RTF-kantoor.

   Alles achter de kantoor-inlog (officeAuth) -- dit is de laag die het hele
   platform kan zien en besturen, en er is geen enkele ingang hier die zonder
   sessie werkt.

   WIE HANDELT, KOMT UIT DE SESSIE EN NOOIT UIT DE BODY. `wie(req)` is de enige
   plek waar de actor wordt bepaald; elke route geeft hem door aan de kern. Een
   auditspoor waarin de beller zijn eigen naam mag zetten, is geen auditspoor --
   dezelfde reden waarom routes/kantoren/index.js dat bij de kluis-inzage zo
   doet.

   EN DE GEDEELDE CODE IS GEEN MENS. Wie met de gedeelde kantoorcode binnenkomt
   krijgt hier de actor 'kantoor (gedeelde code)'. Dat is met opzet één naam
   voor iedereen die zo binnenkomt: vier-ogen-goedkeuringen en zware rechten
   vallen daarmee vanzelf om, want de kern eist twee VERSCHILLENDE actoren. Wie
   die dingen wil doen, logt in met zijn eigen RTG-account.

   De routes staan verdeeld over vier delen: het beeld en het zoeken hier, het
   herstel in ./herstel.js, het bestuur in ./bestuur.js en het toezicht in
   ./toezicht.js. */
module.exports = (kern) => {
  const { app, officeAuth, boardroomWie, command } = kern;

  const stuur = (res, r) => (r && r.error) ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const veilig = (res, werk) => {
    try { stuur(res, werk()); }
    catch (e) { console.error('[command]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };
  const wie = (req) => boardroomWie(req) || 'kantoor (gedeelde code)';
  const ctx = { stuur, veilig, wie, officeAuth, app, command };

  /* HET BEGINSCHERM IN ÉÉN VERZOEK. Vier losse verzoeken op een beginscherm
     zijn vier momenten waarop het scherm half gevuld kan blijven staan; dit is
     er één, en hij faalt in zijn geheel of hij slaagt in zijn geheel. */
  app.post('/api/command/start', officeAuth, (req, res) => veilig(res, () => command.start()));
  app.post('/api/command/puls', officeAuth, (req, res) => veilig(res, () => command.puls.beeld()));

  /* De zoekbalk over alle domeinen. `bereik` vertelt waar hij kijkt, zodat
     "niets gevonden" een uitslag is en geen stilte. */
  app.post('/api/command/zoek', officeAuth, (req, res) => veilig(res, () =>
    Object.assign(command.zoek(req.body.q, { type: req.body.type }), { bereik: command.bereik() })));

  /* Universal object control: ieder object platformbreed openen. */
  app.post('/api/command/object', officeAuth, (req, res) => veilig(res, () =>
    command.dossier(String(req.body.type || ''), String(req.body.id || ''))));

  /* De operator: een opdracht in gewone taal wordt een plan. De AI verwoordt
     hooguit; wat er in het plan staat is gerekend. Daarom is dit de enige
     route hier die async is, en daarom staat de eigen zin er al in voordat de
     AI erbij komt. */
  app.post('/api/command/operator/plan', officeAuth, async (req, res) => {
    try {
      const p = command.operator.plan(req.body.q, wie(req));
      p.tekst = await command.operator.verwoord(p);
      res.json({ plan: p });
    } catch (e) {
      console.error('[command/operator]', e);
      res.status(500).json({ error: 'De operator kon dit plan niet maken.' });
    }
  });

  app.post('/api/command/operator/uitvoeren', officeAuth, (req, res) => veilig(res, () =>
    command.operator.voerVeilig(String(req.body.plan || ''), wie(req), req.body.reden)));

  app.post('/api/command/operator/recent', officeAuth, (req, res) => veilig(res, () =>
    ({ plannen: command.operator.recent(Number(req.body.n || 10)) })));

  require('./herstel')(ctx);
  require('./bestuur')(ctx);
  require('./toezicht')(ctx);
};
