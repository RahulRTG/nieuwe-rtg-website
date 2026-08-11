/* Member-submodule: RTG Pulse, het eigen 9+-microblog (kern/pulse.js). Voor alle
   ingelogde leden, op codenaam; gasten kijken niet mee (het is een ledenfeed).
   Alleen de routes; de logica woont in de kern. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, geenGast, liveCodename,
    pulsePost, pulseWeg, pulseLike, pulseReactie, pulseVolg, pulseMeld, pulseFeed, pulseProfiel,
    pulseBewerk, pulseVersies, pulseBewaar, pulseBewaard } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  /* De paden staan voluit en niet als '/api/member/pulse/' + pad. Een
     opgebouwd pad ziet scripts/schakelbaar.js niet, en wat die census niet
     ziet is vanuit de boardroom niet uit te zetten en niet per stad te
     sluiten (scripts/check.js regel 45). De poort en het vangnet blijven op
     EEN plek; alleen de registratie is uitgeschreven. */
  const doe = (werk) => (req, res) => {
    if (geenGast(req, res)) return;
    try { stuur(res, werk(req.session.key, req.body || {}, liveCodename(req.session))); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };

  app.post('/api/member/pulse/feed', auth, doe((k, b) => pulseFeed(k, String(b.soort || 'volgend'), b.cursor ? String(b.cursor) : null)));
  app.post('/api/member/pulse/post', auth, doe((k, b, naam) => pulsePost(k, naam, b.tekst)));
  app.post('/api/member/pulse/weg', auth, doe((k, b) => pulseWeg(k, String(b.id || ''))));
  app.post('/api/member/pulse/like', auth, doe((k, b) => pulseLike(k, String(b.id || ''))));
  app.post('/api/member/pulse/reactie', auth, doe((k, b, naam) => pulseReactie(k, naam, String(b.id || ''), b.tekst)));
  app.post('/api/member/pulse/volg', auth, doe((k, b) => pulseVolg(k, String(b.key || ''))));
  app.post('/api/member/pulse/meld', auth, doe((k, b) => pulseMeld(k, String(b.id || ''), b.reden)));
  app.post('/api/member/pulse/profiel', auth, doe((k, b) => pulseProfiel(k, b.key ? String(b.key) : null)));

  /* Bewerken en bewaren: elders de betaalde functies van een microblog.
     De geschiedenis van een bewerking staat open voor iedereen die het bericht
     mag zien -- dat is de voorwaarde waaronder bewerken eerlijk blijft, en die
     regel staat in de kern, niet hier. */
  app.post('/api/member/pulse/bewerk', auth, doe((k, b) => pulseBewerk(k, String(b.id || ''), b.tekst)));
  app.post('/api/member/pulse/versies', auth, doe((k, b) => pulseVersies(k, String(b.id || ''))));
  app.post('/api/member/pulse/bewaar', auth, doe((k, b) => pulseBewaar(k, String(b.id || ''), b.map)));
  app.post('/api/member/pulse/bewaard', auth, doe((k, b) => pulseBewaard(k, b.map ? String(b.map) : null)));
};
