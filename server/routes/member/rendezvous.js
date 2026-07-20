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
  function route(pad, werk) {
    app.post('/api/member/rendezvous/' + pad, auth, (req, res) => {
      if (!eis(req, res)) return;
      try { stuur(res, werk(req.session.key, req.body || {})); }
      catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
    });
  }

  route('profiel', (k) => rvProfielGet(k));
  route('profiel/zet', (k, b) => rvProfiel(k, b));
  route('kandidaten', (k) => rvKandidaten(k));
  route('like', (k, b) => rvLike(k, String(b.id || '')));
  route('pas', (k, b) => rvPas(k, String(b.id || '')));
  route('matches', (k) => rvMatches(k));

  // de AI-date is async (Rahul de koppelaar), dus een eigen handler
  app.post('/api/member/rendezvous/date', auth, async (req, res) => {
    if (!eis(req, res)) return;
    try { stuur(res, await rvDate(req.session.key, String((req.body || {}).id || ''), (req.body || {}).vraag)); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
