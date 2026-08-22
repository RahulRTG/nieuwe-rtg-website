/* Member-submodule: Rendez-vous -- de besloten AI-datingapp van de Lifestyle Pass.
   Gated op de Lifestyle Pass (Business erft mee). De logica woont in
   kern/rendezvous.js. Gemount vanuit routes/member.js.

   HIER STAAT ALLEEN DE PAS-EIS. Welke pas toegang geeft is een productkeuze en
   verschilt per app; de ontmoetpoort (18+ met geverifieerd paspoort) is dat niet
   en staat daarom in de kern, gedeeld met Vonk -- zie kern/ontmoetpoort.js. Wie
   hier ooit ook de leeftijd zou controleren, bouwt de tweede kopie van een grens
   en dat is precies hoe deze app hem eerder helemaal misliep. */
module.exports = (kern) => {
  const { app, auth, rvProfielGet, rvProfiel, rvKandidaten, rvLike, rvPas, rvMatches, rvDate, rvAanwezigWis, rvArrange, rvAkkoord,
    rvTafels, rvTafelAntwoord, rvIntroducties, rvIntroAntwoord, rvEncounter, rvSamen, rvSamenZet } = kern;

  function eis(req, res) {
    if (['lifestyle', 'business'].includes(req.session.tier)) return true;
    res.status(403).json({ error: 'Rendez-vous is onderdeel van de Lifestyle Pass.' });
    return false;
  }
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
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
  app.post('/api/member/rendezvous/like', auth, doe((k, b) => rvLike(k, String(b.id || ''))));
  app.post('/api/member/rendezvous/pas', auth, doe((k, b) => rvPas(k, String(b.id || ''))));
  app.post('/api/member/rendezvous/matches', auth, doe((k) => rvMatches(k)));
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
