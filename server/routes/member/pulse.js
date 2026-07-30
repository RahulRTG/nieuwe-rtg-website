/* Member-submodule: RTG Pulse, het eigen 9+-microblog (kern/pulse.js). Voor alle
   ingelogde leden, op codenaam; gasten kijken niet mee (het is een ledenfeed).
   Alleen de routes; de logica woont in de kern. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, geenGast, liveCodename,
    pulsePost, pulseWeg, pulseLike, pulseReactie, pulseVolg, pulseMeld, pulseFeed, pulseProfiel,
    pulseBewerk, pulseVersies, pulseBewaar, pulseBewaard } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  function route(pad, werk) {
    app.post('/api/member/pulse/' + pad, auth, (req, res) => {
      if (geenGast(req, res)) return;
      try { stuur(res, werk(req.session.key, req.body || {}, liveCodename(req.session))); }
      catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
    });
  }

  route('feed', (k, b) => pulseFeed(k, String(b.soort || 'volgend'), b.cursor ? String(b.cursor) : null));
  route('post', (k, b, naam) => pulsePost(k, naam, b.tekst));
  route('weg', (k, b) => pulseWeg(k, String(b.id || '')));
  route('like', (k, b) => pulseLike(k, String(b.id || '')));
  route('reactie', (k, b, naam) => pulseReactie(k, naam, String(b.id || ''), b.tekst));
  route('volg', (k, b) => pulseVolg(k, String(b.key || '')));
  route('meld', (k, b) => pulseMeld(k, String(b.id || ''), b.reden));
  route('profiel', (k, b) => pulseProfiel(k, b.key ? String(b.key) : null));

  /* Bewerken en bewaren: elders de betaalde functies van een microblog.
     De geschiedenis van een bewerking staat open voor iedereen die het bericht
     mag zien -- dat is de voorwaarde waaronder bewerken eerlijk blijft, en die
     regel staat in de kern, niet hier. */
  route('bewerk', (k, b) => pulseBewerk(k, String(b.id || ''), b.tekst));
  route('versies', (k, b) => pulseVersies(k, String(b.id || '')));
  route('bewaar', (k, b) => pulseBewaar(k, String(b.id || ''), b.map));
  route('bewaard', (k, b) => pulseBewaard(k, b.map ? String(b.map) : null));
};
