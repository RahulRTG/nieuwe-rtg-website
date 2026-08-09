/* Routes "overheid" (deelmodule): HET BELASTINGKANTOOR.

   De inspecteurscockpit, de aanslagen, het btw-beeld, de aansluiting met de
   aangiftes, de naheffingsaanslag en de AI-chef-inspecteur. Afgesplitst van
   ./overheid.js, dat over de 10 kB-lat ging toen de naheffing erbij kwam -- en
   het is de naad die er toch al lag: dit is EEN kantoor met een eigen scherm
   (public/apps/belastingkantoor.html), naast de rechtbank en de PDA die daar
   hun eigen blokken hebben.

   DE POORTEN KOMEN MEE UIT HET MOEDERBESTAND en worden hier niet opnieuw
   geschreven: `rijk` (is de ingelogde partner het rijk zelf), `stuur` (fout of
   antwoord) en `wie` (de NAAM van de ambtenaar uit req.actor). Ze twee keer
   opschrijven is twee plekken die dezelfde waarheid vasthouden, en dan lopen ze
   uiteen zodra er een verandert (LAT.md regel 4).

   En `wie` is hier meer dan een logregel: de naheffing hangt zijn vier ogen
   eraan op. Die naam komt uit de personeelslogin op de persoonlijke pincode en
   nooit uit het verzoek; anders stelt dezelfde inspecteur zijn eigen naheffing
   vast door een andere naam in te tikken. */
module.exports = (kern, { rijk, stuur, wie }) => {
  const { app, supplierAuth, overheid } = kern;

  /* ---- het Belastingkantoor: de inspecteurscockpit (kern/overheid/kantoor.js) ---- */
  app.post('/api/overheid/bd/cockpit', supplierAuth, rijk, (req, res) => res.json(overheid.bdCockpit()));
  app.post('/api/overheid/bd/aanslagen', supplierAuth, rijk, (req, res) => res.json(overheid.bdAanslagen(req.body || {})));
  app.post('/api/overheid/bd/btw', supplierAuth, rijk, (req, res) => res.json(overheid.bdBtwBeeld()));
  /* De aansluiting: wat het factuurregister zegt naast wat er is aangegeven.
     Zonder periode de laatst AFGESLOTEN -- over een lopend kwartaal hoort er nog
     niets te zijn ingediend, dus daarop openen zou loos alarm zijn. */
  app.post('/api/overheid/bd/btw/aansluiting', supplierAuth, rijk, (req, res) =>
    stuur(res, overheid.bdBtwAansluiting(String((req.body || {}).periode || '') || overheid.vorigeBtwPeriode())));
  /* ---- de naheffingsaanslag (kern/overheid/naheffing.js) ----
     VIER OGEN, en die hangen aan de NAAM van de ambtenaar en niet aan zijn
     token: wie(req) komt uit req.actor, dat bij de personeelslogin op de
     persoonlijke pincode is gezet. Een naam uit het lijf zou betekenen dat
     dezelfde inspecteur zijn eigen naheffing vaststelt door een andere naam in
     te tikken -- en dan zijn het twee ogen met een tweede naam ernaast. */
  app.post('/api/overheid/bd/naheffing/maak', supplierAuth, rijk, (req, res) => {
    const b = req.body || {};
    stuur(res, overheid.naheffingMaak(String(b.periode || '') || overheid.vorigeBtwPeriode(),
      String(b.code || ''), wie(req), { boetePct: b.boetePct, boeteGrond: b.boeteGrond }));
  });
  app.post('/api/overheid/bd/naheffing/stelvast', supplierAuth, rijk, (req, res) =>
    stuur(res, overheid.naheffingStelVast(String((req.body || {}).id || ''), wie(req))));
  app.post('/api/overheid/bd/naheffing/intrek', supplierAuth, rijk, (req, res) =>
    stuur(res, overheid.naheffingIntrek(String((req.body || {}).id || ''), wie(req), (req.body || {}).reden)));
  /* Het besluit op bezwaar is ASYNC: wijst hij het toe en was er al betaald, dan
     boekt hij het geld terug (kern/overheid/naheffing-betalen.js). Een besluit
     dat de aanslag vernietigt en het bedrag laat staan, doet niets. */
  app.post('/api/overheid/bd/naheffing/bezwaar/beslis', supplierAuth, rijk, async (req, res) => {
    try { stuur(res, await overheid.naheffingBeslisBezwaar(wie(req), String((req.body || {}).id || ''), req.body || {})); }
    catch (e) { console.error('[naheffing-bezwaar]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  /* ---- de invordering ----
     De keten is een kant op en elke stap wacht op de termijn van de vorige; de
     motor bewaakt dat (kern/overheid/naheffing-invordering.js). BESLAG is async
     en heeft eigen ogen: wie het dwangbevel uitvaardigde legt het niet. Ook die
     naam komt uit `wie(req)` en dus uit de personeelslogin -- een naam uit het
     lijf zou betekenen dat dezelfde ambtenaar de hele keten alleen afloopt. */
  app.post('/api/overheid/bd/naheffing/aanmaning', supplierAuth, rijk, (req, res) =>
    stuur(res, overheid.naheffingAanmaning(String((req.body || {}).id || ''), wie(req))));
  app.post('/api/overheid/bd/naheffing/dwangbevel', supplierAuth, rijk, (req, res) =>
    stuur(res, overheid.naheffingDwangbevel(String((req.body || {}).id || ''), wie(req))));
  app.post('/api/overheid/bd/naheffing/beslag', supplierAuth, rijk, async (req, res) => {
    try { stuur(res, await overheid.naheffingBeslag(String((req.body || {}).id || ''), wie(req))); }
    catch (e) { console.error('[naheffing-beslag]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/overheid/bd/naheffing/regeling', supplierAuth, rijk, (req, res) =>
    stuur(res, overheid.naheffingRegeling(String((req.body || {}).id || ''), wie(req), (req.body || {}).maanden)));
  app.post('/api/overheid/bd/naheffing/stop', supplierAuth, rijk, (req, res) =>
    stuur(res, overheid.naheffingStopInvordering(String((req.body || {}).id || ''), wie(req), (req.body || {}).reden)));

  app.post('/api/overheid/bd/naheffingen', supplierAuth, rijk, (req, res) =>
    res.json(overheid.naheffingenLijst(req.body || {})));

  app.post('/api/overheid/bd/herinnering', supplierAuth, rijk, (req, res) => stuur(res, overheid.bdHerinnering(wie(req), String(req.body.ref || ''))));
  app.post('/api/overheid/bd/regeling', supplierAuth, rijk, (req, res) => stuur(res, overheid.bdRegeling(wie(req), String(req.body.ref || ''), req.body.maanden)));
  app.post('/api/overheid/bd/kwijt', supplierAuth, rijk, (req, res) => stuur(res, overheid.bdKwijtschelding(wie(req), String(req.body.ref || ''), req.body.reden)));
  app.post('/api/overheid/bd/ai', supplierAuth, rijk, async (req, res) => {
    try { res.json(await overheid.bdAI(String(req.body.vraag || ''))); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
