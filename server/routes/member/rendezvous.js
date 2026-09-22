/* Member-submodule: Rendez-vous -- de besloten AI-datingapp voor Signature.
   Lifestyle en Business zijn beide Signature. De logica woont in
   kern/rendezvous.js. Gemount vanuit routes/member.js.

   HIER STAAT ALLEEN DE PAS-EIS. Welke pas toegang geeft is een productkeuze en
   verschilt per app; de ontmoetpoort (18+ met geverifieerd paspoort) is dat niet
   en staat daarom in de kern, gedeeld met Vonk -- zie kern/ontmoetpoort.js. Wie
   hier ooit ook de leeftijd zou controleren, bouwt de tweede kopie van een grens
   en dat is precies hoe deze app hem eerder helemaal misliep. */
module.exports = (kern) => {
  const { app, auth, officeAuth, accounts, leeftijdVan, rvProfielGet, rvProfiel, rvKandidaten, rvKies, rvMatches, rvMeldingen,
    rvDate, rvAanwezigWis, rvArrange, rvAkkoord,
    rvTafels, rvTafelAntwoord, rvIntroducties, rvIntroAntwoord, rvEncounter, rvSamen, rvSamenZet } = kern;
  const { eis: eisCapability } = require('../connection-policy')({ product: 'rendezvous', accounts, leeftijdVan });

  /* Twee lagen, met opzet: de HANDHAVER is kern/ontmoetpoort.js (elke
     kernfunctie draagt hem), en deze eis() is de voordeur die er nette
     foutCODES bij geeft -- de schermen tonen op IDENTITY_REQUIRED en
     AGE_REQUIRED elk hun eigen deur. Drift faalt veilig: wie hier per ongeluk
     doorkomt, strandt alsnog op de kernpoort. */
  const stuur = (res, r) => r && r.error
    ? res.status(r.status || 400).json({ error: r.error, ...(r.code ? { code: r.code } : {}) })
    : res.json(r);
  /* De paden staan voluit en niet als '/api/member/rendezvous/' + pad. Een opgebouwd pad
     ziet scripts/schakelbaar.js niet, en wat die census niet ziet is vanuit de
     boardroom niet uit te zetten en niet per stad te sluiten (scripts/check.js
     regel 45). De pas-eis en het vangnet blijven op EEN plek; alleen de
     registratie is uitgeschreven. */
  const doe = (capability, werk, actor) => (req, res) => {
    if (!eisCapability(req, res, capability, actor)) return;
    try { stuur(res, werk(req.session.key, req.body || {})); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };

  app.post('/api/member/rendezvous/profiel', auth, doe('connection.profile.read', (k) => rvProfielGet(k)));
  app.post('/api/member/rendezvous/profiel/zet', auth, doe('connection.profile.manage', (k, b) => rvProfiel(k, b)));
  app.post('/api/member/rendezvous/kandidaten', auth, doe('connection.discover', (k) => rvKandidaten(k)));
  app.post('/api/member/rendezvous/like', auth, doe('connection.match.choose', (k, b) => rvKies(k, String(b.id || ''), 'like')));
  app.post('/api/member/rendezvous/pas', auth, doe('connection.match.choose', (k, b) => rvKies(k, String(b.id || ''), 'pas')));
  app.post('/api/member/rendezvous/matches', auth, doe('connection.match.read', (k) => rvMatches(k)));
  app.post('/api/member/rendezvous/blokkeer', auth, doe('connection.safety.block', (k, b) => rvKies(k, String(b.id || ''), 'blokkeer', b.meld)));
  app.post('/api/office/rendezvous/meldingen', officeAuth, (req, res) => {
    if (!eisCapability(req, res, 'connection.safety.report.read', 'office')) return;
    stuur(res, rvMeldingen());
  });
  app.post('/api/member/rendezvous/aanwezig/wis', auth, doe('connection.presence.manage', (k) => rvAanwezigWis(k)));
  app.post('/api/member/rendezvous/arrange', auth, doe('connection.meet.plan', (k, b) => rvArrange(k, String(b.id || ''), b.setting)));
  app.post('/api/member/rendezvous/akkoord', auth, doe('connection.meet.accept', (k, b) => rvAkkoord(k, String(b.id || ''), b.ja)));
  app.post('/api/member/rendezvous/tafels', auth, doe('connection.table.read', (k) => rvTafels(k)));
  app.post('/api/member/rendezvous/tafel/antwoord', auth, doe('connection.table.accept', (k, b) => rvTafelAntwoord(k, String(b.id || ''), b.ja)));
  app.post('/api/member/rendezvous/introducties', auth, doe('connection.introduction.read', (k) => rvIntroducties(k)));
  app.post('/api/member/rendezvous/introductie/antwoord', auth, doe('connection.introduction.answer', (k, b) => rvIntroAntwoord(k, String(b.id || ''), b.ja)));
  app.post('/api/member/rendezvous/encounter', auth, doe('connection.encounter.confirm', (k, b) => rvEncounter(k, b.pin)));
  app.post('/api/member/rendezvous/samen', auth, doe('connection.relationship.declare', (k) => rvSamen(k)));
  app.post('/api/member/rendezvous/samen/zet', auth, doe('connection.relationship.declare', (k, b) => rvSamenZet(k, String(b.met || ''), b.ja)));

  // de AI-date is async (Rahul de koppelaar), dus een eigen handler
  app.post('/api/member/rendezvous/date', auth, async (req, res) => {
    /* Rahul is hier de actor, maar de policy eist eerst exact dezelfde toegang
       van het lid. Een modelprovider kan deze voordeur dus nooit verruimen. */
    if (!eisCapability(req, res, 'connection.meet.plan', 'rahul')) return;
    try { stuur(res, await rvDate(req.session.key, String((req.body || {}).id || ''), (req.body || {}).vraag)); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
