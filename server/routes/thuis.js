/* Routes van RTG Thuis (thuisverhuur, ons antwoord op Airbnb). Zoeken en
   kijken mag iedereen met een sessie (ook de gratis app); boeken, hosten,
   reviewen en berichten zijn voor leden (op codenaam -- privacy by design).
   De kern woont in kern/thuis/. */
module.exports = (kern) => {
  const { app, auth, liveCodename, thuis } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const gast = (req, res) => { if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG Thuis boeken en hosten is voor leden.' }); return true; } return false; };
  const cn = req => liveCodename(req.session);

  // kijken: zoeken, detail (met prijsopbouw + reiswijzer), reviews, typen
  app.post('/api/thuis/zoek', auth, (req, res) => res.json(thuis.thuisZoek(req.session.tier === 'guest' ? null : cn(req), req.body || {})));
  app.post('/api/thuis/detail', auth, (req, res) => stuur(res, thuis.thuisDetail(String(req.body.id || ''), req.body.van, req.body.tot)));
  app.post('/api/thuis/reviews', auth, (req, res) => res.json(thuis.thuisHuisReviews(String(req.body.id || ''))));
  app.post('/api/thuis/typen', auth, (req, res) => res.json(thuis.thuisTypes()));

  // gast (lid): boeken, annuleren, check-in/uit, mijn reizen, wenslijst
  app.post('/api/thuis/boek', auth, (req, res) => { if (gast(req, res)) return; stuur(res, thuis.thuisBoek(cn(req), req.body || {})); });
  app.post('/api/thuis/annuleer', auth, (req, res) => { if (gast(req, res)) return; stuur(res, thuis.thuisAnnuleer(cn(req), req.body.ref)); });
  app.post('/api/thuis/checkin', auth, (req, res) => { if (gast(req, res)) return; stuur(res, thuis.thuisCheckin(cn(req), req.body.ref)); });
  app.post('/api/thuis/checkuit', auth, (req, res) => { if (gast(req, res)) return; stuur(res, thuis.thuisCheckuit(cn(req), req.body.ref)); });
  app.post('/api/thuis/mijn', auth, (req, res) => { if (gast(req, res)) return; res.json(thuis.thuisMijnReizen(cn(req))); });
  app.post('/api/thuis/wens', auth, (req, res) => { if (gast(req, res)) return; stuur(res, thuis.thuisWensToggle(cn(req), String(req.body.id || ''))); });
  app.post('/api/thuis/wenslijst', auth, (req, res) => { if (gast(req, res)) return; res.json(thuis.thuisWensLijst(cn(req))); });

  // beide kanten: review en berichten op de boeking
  app.post('/api/thuis/review', auth, (req, res) => { if (gast(req, res)) return; stuur(res, thuis.thuisReview(cn(req), req.body || {})); });
  app.post('/api/thuis/bericht', auth, (req, res) => { if (gast(req, res)) return; stuur(res, thuis.thuisBericht(cn(req), req.body.ref, req.body.tekst)); });
  app.post('/api/thuis/berichten', auth, (req, res) => { if (gast(req, res)) return; stuur(res, thuis.thuisBerichten(cn(req), req.body.ref)); });

  // host (lid): aanbod, kalender, co-hosts, prijsadvies, aanvragen, dashboard
  app.post('/api/thuis/huis', auth, (req, res) => { if (gast(req, res)) return; stuur(res, thuis.thuisHuisZet(cn(req), req.body.huis || {}, req.body.id ? String(req.body.id) : null)); });
  app.post('/api/thuis/huizen', auth, (req, res) => { if (gast(req, res)) return; res.json(thuis.thuisMijnHuizen(cn(req))); });
  app.post('/api/thuis/blokkeer', auth, (req, res) => { if (gast(req, res)) return; stuur(res, thuis.thuisBlokkeer(cn(req), String(req.body.id || ''), req.body.van, req.body.tot, req.body.weg === true)); });
  app.post('/api/thuis/cohost', auth, (req, res) => { if (gast(req, res)) return; stuur(res, thuis.thuisCoHost(cn(req), String(req.body.id || ''), req.body.wie, req.body.weg === true)); });
  app.post('/api/thuis/prijsadvies', auth, (req, res) => { if (gast(req, res)) return; stuur(res, thuis.thuisSlimmePrijs(cn(req), String(req.body.id || ''))); });
  app.post('/api/thuis/beslis', auth, (req, res) => { if (gast(req, res)) return; stuur(res, thuis.thuisBeslis(cn(req), req.body.ref, req.body.akkoord === true)); });
  app.post('/api/thuis/bord', auth, (req, res) => { if (gast(req, res)) return; res.json(thuis.thuisHostBord(cn(req))); });
};
