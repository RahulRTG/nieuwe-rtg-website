/* Member-submodule: Rendez-vous -- de besloten AI-datingapp van de Lifestyle Pass.
   Gated op de Lifestyle Pass (Business erft mee). De logica woont in
   kern/rendezvous.js. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, rvProfielGet, rvProfiel, rvKandidaten, rvLike, rvPas, rvMatches, rvDate } = kern;

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

  // de AI-date is async (Rahul de koppelaar), dus een eigen handler
  app.post('/api/member/rendezvous/date', auth, async (req, res) => {
    if (!eis(req, res)) return;
    try { stuur(res, await rvDate(req.session.key, String((req.body || {}).id || ''), (req.body || {}).vraag)); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
