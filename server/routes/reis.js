/* Routes van de Reiswijzer: alle reisregels van elk land van de wereld, voor
   iedereen met een sessie (ook de gratis app -- veilig reizen is voor
   iedereen). Het reisbureau en het partnerkanaal reiken de wijzer daarnaast
   AUTOMATISCH uit bij een boeking (zie winkel.js en partnerkanaal.js). */
module.exports = (kern) => {
  const { app, auth, reiswijzer, reisLanden } = kern;

  app.post('/api/reis/wijzer', auth, (req, res) => {
    const r = reiswijzer(req.body.land || req.body.bestemming);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  app.post('/api/reis/landen', auth, (req, res) => res.json({ landen: reisLanden() }));

  /* RTG Reizen, de samenhanglaag: uw komende reis uit alle reisdomeinen bij
     elkaar. Alleen lezen -- boeken, wijzigen en annuleren blijft in de
     gespecialiseerde app, en deze route heeft er geen tegenhanger voor. */
  app.post('/api/reis/wereld', auth, (req, res) => res.json(kern.reiswereld.komend(req.session.key)));

  /* DE REIS: dezelfde regels, maar gegroepeerd tot reizen (REIZEN.md fase 1).
     Ook alleen lezen, en om dezelfde reden: hier ontstaat geen boeking. Wat
     niet te plaatsen was komt mee terug in `los`, met de reden. */
  app.post('/api/reis/reizen', auth, (req, res) => res.json(kern.reizen.mijn(req.session.key)));

  /* DE REISWACHT (REIZEN.md fase 3): de signalen rond de komende reizen, met
     per bron of hij gemeten is, stilviel of simpelweg niet bestaat. Alleen
     lezen; en het antwoord zegt zelf dat het een momentopname is. */
  app.post('/api/reis/wacht', auth, (req, res) => {
    const r = kern.reiswacht.wacht(req.session.key);
    r.ok ? res.json(r) : res.status(r.status || 503).json(r);
  });

  /* DE INVOERBALIE (REIZEN.md fase 2). Twee stappen, en dat is de kern van het
     ontwerp: LEZEN maakt een voorstel, BEVESTIGEN maakt er pas een onderdeel
     van. Een extractie die zichzelf in uw reisplan zet, zet daar vroeg of laat
     een verkeerde datum in.

     Wat de client stuurt is het document en de tekst -- nooit de zekerheden.
     Die komen uit de lezer en worden bij het voorstel bewaard; een bewijsstuk
     dat de aanvrager zelf invult is geen bewijsstuk. Bij het bevestigen mag hij
     wel CORRIGEREN, en dan staat er `door u ingevuld` bij dat veld. */
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  app.post('/api/reis/invoer/lees', auth, async (req, res) => {
    try { stuur(res, await kern.invoer.lees(req.session.key, req.body || {})); }
    catch (e) { console.error('[invoer]', e); res.status(500).json({ error: 'Er ging iets mis bij het lezen. Probeer het opnieuw.' }); }
  });
  app.post('/api/reis/invoer/bevestig', auth, (req, res) =>
    stuur(res, kern.invoer.bevestig(req.session.key, (req.body || {}).id, (req.body || {}).velden || {})));
  app.post('/api/reis/invoer/mijn', auth, (req, res) =>
    res.json({ ok: true, onderdelen: kern.invoer.mijn(req.session.key), soorten: kern.invoer.SOORTEN }));
  app.post('/api/reis/invoer/weg', auth, (req, res) =>
    stuur(res, kern.invoer.weg(req.session.key, (req.body || {}).id)));

  /* ---- DE REISUITNODIGING ----

     EEN PUBLIEKE DEUR, met reden. Wie een klaargezette reis opent is per
     definitie nog geen lid -- dat is de hele opzet. Wat hij te zien krijgt is
     bewust mager (bestemming, periode, hoeveel onderdelen), zodat een
     doorgestuurde link geen boekingsnummers lekt; zie de kop van
     kern/reisuitnodiging.js. Het slot is de entropie van de code (128 bits);
     de rem hieronder houdt ruis tegen en is uitdrukkelijk geen slot. */
  app.post('/api/reis/uitnodiging/open', (req, res) => {
    if (kern.tooManyTries && kern.tooManyTries(res, 'reisuitnodiging:' + req.ip)) return;
    stuur(res, kern.reisuitnodiging.open((req.body || {}).code));
  });
  // opeisen kan alleen met een account: vanaf hier is er een mens met een sessie
  app.post('/api/reis/uitnodiging/eisop', auth, (req, res) =>
    stuur(res, kern.reisuitnodiging.eisOp(req.session, (req.body || {}).code)));
  /* Een lid nodigt zijn reisgenoot uit. Hij deelt ONDERDELEN uit zijn eigen
     reis; de kern schoont die en laat er geen bewijsstukken of sleutels in. */
  app.post('/api/reis/uitnodiging/nodig-uit', auth, (req, res) =>
    stuur(res, kern.reisuitnodiging.nodigUit(req.session.key, kern.liveCodename(req.session), (req.body || {}).onderdelen)));
  app.post('/api/reis/uitnodiging/mijn', auth, (req, res) =>
    res.json({ ok: true, uitnodigingen: kern.reisuitnodiging.lijst(req.session.key) }));
  app.post('/api/reis/uitnodiging/weg', auth, (req, res) =>
    stuur(res, kern.reisuitnodiging.trekIn(req.session.key, (req.body || {}).id)));
};
