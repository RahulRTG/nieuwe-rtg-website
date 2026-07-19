/* Domein "member", deelmodule gemeente: het inwoner-loket van RTG Gemeente.
   Meldingen openbare ruimte, afspraken burgerzaken, vergunningen aanvragen,
   afvalkalender, aanslagen en bekendmakingen. Alleen routes; de logica woont in
   kern/gemeente.js. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, liveCodename, gemeente } = kern;
  const lid = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Alleen voor leden.' }); return false; }
    return true;
  };
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  // pijler 1: meldingen openbare ruimte
  app.post('/api/gemeente/meld', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, gemeente.meld(req.session, liveCodename(req.session), req.body || {})); });
  app.post('/api/gemeente/meldingen/mijn', auth, (req, res) => res.json({ meldingen: gemeente.mijnMeldingen(req.session.key) }));

  // pijler 2: burgerzaken & afspraken
  app.post('/api/gemeente/burgerzaken', auth, (req, res) => res.json(gemeente.burgerzakenOverzicht()));
  app.post('/api/gemeente/burgerzaken/slots', auth, (req, res) => stuur(res, gemeente.burgerzakenSlots(String(req.body.soort || ''), req.body.datum)));
  app.post('/api/gemeente/afspraak', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, gemeente.afspraakMaak(req.session, liveCodename(req.session), req.body || {})); });
  app.post('/api/gemeente/afspraken/mijn', auth, (req, res) => res.json({ afspraken: gemeente.mijnAfspraken(req.session.key) }));
  app.post('/api/gemeente/afspraak/annuleer', auth, (req, res) => stuur(res, gemeente.afspraakAnnuleer(req.session.key, String(req.body.ref || ''))));
  app.post('/api/gemeente/verhuizing', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, gemeente.verhuizingDoorgeven(req.session, liveCodename(req.session), req.body || {})); });

  // pijler 3: vergunningen (inwoner)
  app.post('/api/gemeente/vergunning', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, gemeente.vergunningAanvraag({ key: req.session.key, codenaam: liveCodename(req.session) }, req.body || {})); });
  app.post('/api/gemeente/vergunningen/mijn', auth, (req, res) => res.json({ vergunningen: gemeente.mijnVergunningen(req.session.key) }));

  // pijler 4: afval, belasting & bestuur
  app.post('/api/gemeente/afval', auth, (req, res) => res.json(gemeente.afvalVoor(String(req.body.postcode || ''))));
  app.post('/api/gemeente/grofvuil', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, gemeente.grofvuilAanvraag(req.session, liveCodename(req.session), req.body || {})); });
  app.post('/api/gemeente/belasting/mijn', auth, (req, res) => res.json({ aanslagen: gemeente.belastingMijn(req.session.key) }));
  app.post('/api/gemeente/bekendmakingen', auth, (req, res) => res.json(gemeente.bekendmakingen()));
};
