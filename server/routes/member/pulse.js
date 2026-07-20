/* Member-submodule: RTG Pulse, het eigen 9+-microblog (kern/pulse.js). Voor alle
   ingelogde leden, op codenaam; gasten kijken niet mee (het is een ledenfeed).
   Alleen de routes; de logica woont in de kern. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, geenGast, liveCodename,
    pulsePost, pulseWeg, pulseLike, pulseReactie, pulseVolg, pulseMeld, pulseFeed, pulseProfiel } = kern;
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
};
