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
  app.post('/api/reis/reizen', auth, (req, res) => res.json(kern.mijnReizen(req.session.key)));

  /* HET REISGEZELSCHAP (kern/reisgezelschap.js). Alles hier loopt over dezelfde
     poort: wat een ander van uw reis ziet, bepaalt `zicht()` en niet de route.
     Een route die zelf zou filteren, is de tweede plek waar dat gebeurt -- en
     dan lekt er ooit een boekingsnummer via de ene terwijl de andere dichtzit. */
  const gez = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  app.post('/api/reis/gezelschap', auth, (req, res) =>
    gez(res, kern.reisgezelschap.gezelschap(req.session.key, String((req.body || {}).reis || ''))));
  app.post('/api/reis/gezelschap/nodig-uit', auth, async (req, res) => {
    const b = req.body || {};
    gez(res, await kern.reisgezelschap.nodigUit(req.session.key, String(b.reis || ''), b.codenaam, b.rol));
  });
  app.post('/api/reis/gezelschap/antwoord', auth, (req, res) => {
    const b = req.body || {};
    gez(res, kern.reisgezelschap.antwoord(req.session.key, String(b.id || ''), b.ja === true));
  });
  app.post('/api/reis/gezelschap/weg', auth, async (req, res) =>
    gez(res, await kern.reisgezelschap.verwijder(req.session.key, String((req.body || {}).id || ''))));
  app.post('/api/reis/gezelschap/kring', auth, (req, res) =>
    gez(res, kern.reisgezelschap.mijnKring(req.session.key)));
  /* De reis zoals DEZE lezer hem mag zien -- de eigenaar zijn eigen reis, een
     reisgenoot of meekijker de uitgeklede vorm, met erbij wat hij niet ziet. */
  app.post('/api/reis/gezelschap/reis', auth, (req, res) =>
    gez(res, kern.reisgezelschap.reisVoor(req.session.key, String((req.body || {}).reis || ''))));
  app.post('/api/reis/gezelschap/tijdlijn', auth, (req, res) =>
    gez(res, kern.reisgezelschap.tijdlijn(req.session.key, String((req.body || {}).reis || ''))));
  app.post('/api/reis/gezelschap/schrijf', auth, (req, res) => {
    const b = req.body || {};
    gez(res, kern.reisgezelschap.schrijf(req.session.key, String(b.reis || ''), b.tekst));
  });
  /* WAT U DEELT. De schakelaar bepaalt niet of de reiziger iets mag melden,
     maar of een MEEKIJKER het te zien krijgt; wie meereist ziet het altijd. */
  app.post('/api/reis/gezelschap/beleid', auth, (req, res) =>
    gez(res, kern.reisgezelschap.beleid(req.session.key, String((req.body || {}).reis || ''))));
  app.post('/api/reis/gezelschap/beleid/zet', auth, (req, res) => {
    const b = req.body || {};
    gez(res, kern.reisgezelschap.zetBeleid(req.session.key, String(b.reis || ''), String(b.veld || ''), b.aan === true));
  });
  /* Het aankomstmoment is een HANDELING van de reiziger, geen meting: RTG heeft
     geen externe vluchtbron, en een stand die vanzelf doorloopt zou volgen zijn. */
  /* Beeld delen: een VERWIJZING naar een bestand dat in de kluis van de
     reiziger blijft. De deellaag van die kluis regelt de toegang; hier komt
     geen tweede opslag en geen tweede uploadweg bij. */
  app.post('/api/reis/gezelschap/beeld', auth, async (req, res) => {
    const b = req.body || {};
    gez(res, await kern.reisgezelschap.deelBeeld(req.session.key, String(b.reis || ''), b.bestand, b.tekst));
  });
  app.post('/api/reis/gezelschap/aangekomen', auth, (req, res) =>
    gez(res, kern.reisgezelschap.meldAankomst(req.session.key, String((req.body || {}).reis || ''))));

  /* DE REISWACHT (REIZEN.md fase 3): de signalen rond de komende reizen, met
     per bron of hij gemeten is, stilviel of simpelweg niet bestaat. Alleen
     lezen; en het antwoord zegt zelf dat het een momentopname is. */
  app.post('/api/reis/wacht', auth, (req, res) => {
    const r = kern.reiswacht.wacht(req.session.key);
    r.ok ? res.json(r) : res.status(r.status || 503).json(r);
  });

  /* DE OPLOSSER (REIZEN.md fase 5). `los` leest en stelt voor; `doe` voert
     uitsluitend een TAAK-voorstel uit, en zoekt dat voorstel server-side
     opnieuw op -- wat de client stuurt is een verwijzing, nooit inhoud. */
  app.post('/api/reis/los', auth, (req, res) => {
    const r = kern.reisoplosser.los(req.session.key, (req.body || {}).reisId);
    r.ok ? res.json(r) : res.status(r.status || 503).json(r);
  });
  app.post('/api/reis/los/doe', auth, async (req, res) => {
    try {
      const r = await kern.reisoplosser.doe(req.session.key, (req.body || {}).reisId, (req.body || {}).voorstel);
      r.ok ? res.json(r) : res.status(r.status || 503).json(r);
    } catch (e) { console.error('[reisoplosser]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
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
