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

  /* Twee lagen, met opzet: de HANDHAVER is kern/ontmoetpoort.js (elke
     kernfunctie draagt hem), en deze eis() is de voordeur die er nette
     foutCODES bij geeft -- de schermen tonen op IDENTITY_REQUIRED en
     AGE_REQUIRED elk hun eigen deur. Drift faalt veilig: wie hier per ongeluk
     doorkomt, strandt alsnog op de kernpoort. */
  function eis(req, res) {
    if (!['lifestyle', 'business'].includes(req.session.tier)) {
      res.status(403).json({ code: 'PASS_REQUIRED', error: 'Rendez-vous is voor Signature-members met een Lifestyle Pass of Business Pass.' });
      return false;
    }
    const account = req.session.account && accounts.getUserById(req.session.account.id);
    if (!account || account.verified !== 'verified') {
      res.status(403).json({ code: 'IDENTITY_REQUIRED', error: 'Verifieer eerst uw identiteit. Zo weet ieder lid dat de ander echt is.' });
      return false;
    }
    const md = accounts.getMemberState(account.id) || {};
    const leeftijd = md.geboren ? leeftijdVan(md.geboren) : null;
    if (leeftijd == null || leeftijd < 18) {
      res.status(403).json({ code: 'AGE_REQUIRED', error: 'Rendez-vous is uitsluitend voor geverifieerde leden van 18 jaar en ouder.' });
      return false;
    }
    return true;
  }
  const stuur = (res, r) => r && r.error
    ? res.status(r.status || 400).json({ error: r.error, ...(r.code ? { code: r.code } : {}) })
    : res.json(r);
  /* De paden staan voluit en niet als '/api/member/rendezvous/' + pad. Een opgebouwd pad
     ziet scripts/schakelbaar.js niet, en wat die census niet ziet is vanuit de
     boardroom niet uit te zetten en niet per stad te sluiten (scripts/check.js
     regel 45). De pas-eis en het vangnet blijven op EEN plek; alleen de
     registratie is uitgeschreven. */
  const doe = (werk) => (req, res) => {
    if (!eis(req, res)) return;
    try { stuur(res, werk(req.session.key, req.body || {})); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };

  app.post('/api/member/rendezvous/profiel', auth, doe((k) => rvProfielGet(k)));
  app.post('/api/member/rendezvous/profiel/zet', auth, doe((k, b) => rvProfiel(k, b)));
  app.post('/api/member/rendezvous/kandidaten', auth, doe((k) => rvKandidaten(k)));
  app.post('/api/member/rendezvous/like', auth, doe((k, b) => rvKies(k, String(b.id || ''), 'like')));
  app.post('/api/member/rendezvous/pas', auth, doe((k, b) => rvKies(k, String(b.id || ''), 'pas')));
  app.post('/api/member/rendezvous/matches', auth, doe((k) => rvMatches(k)));
  app.post('/api/member/rendezvous/blokkeer', auth, doe((k, b) => rvKies(k, String(b.id || ''), 'blokkeer', b.meld)));
  app.post('/api/office/rendezvous/meldingen', officeAuth, (req, res) => stuur(res, rvMeldingen()));
  app.post('/api/member/rendezvous/aanwezig/wis', auth, doe((k) => rvAanwezigWis(k)));
  app.post('/api/member/rendezvous/arrange', auth, doe((k, b) => rvArrange(k, String(b.id || ''), b.setting)));
  app.post('/api/member/rendezvous/akkoord', auth, doe((k, b) => rvAkkoord(k, String(b.id || ''), b.ja)));
  app.post('/api/member/rendezvous/tafels', auth, doe((k) => rvTafels(k)));
  app.post('/api/member/rendezvous/tafel/antwoord', auth, doe((k, b) => rvTafelAntwoord(k, String(b.id || ''), b.ja)));
  app.post('/api/member/rendezvous/introducties', auth, doe((k) => rvIntroducties(k)));
  app.post('/api/member/rendezvous/introductie/antwoord', auth, doe((k, b) => rvIntroAntwoord(k, String(b.id || ''), b.ja)));
  app.post('/api/member/rendezvous/encounter', auth, doe((k, b) => rvEncounter(k, b.pin)));
  app.post('/api/member/rendezvous/samen', auth, doe((k) => rvSamen(k)));
  app.post('/api/member/rendezvous/samen/zet', auth, doe((k, b) => rvSamenZet(k, String(b.met || ''), b.ja)));

  // de AI-date is async (Rahul de koppelaar), dus een eigen handler
  app.post('/api/member/rendezvous/date', auth, async (req, res) => {
    if (!eis(req, res)) return;
    try { stuur(res, await rvDate(req.session.key, String((req.body || {}).id || ''), (req.body || {}).vraag)); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
