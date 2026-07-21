/* Routes "sportclub": het stadion- en clubsysteem (kern/sportclub.js).
   - De club zelf (supplier type sportclub, roster-login): cockpit, de eigen
     plattegrond, teams van jeugd tot eerste, wedstrijden en uitslagen, de
     ticketscan bij de poort, veldbeheer, kampen, sponsors, momenten en de
     financien. De kantine draait op de bestaande kassa; hr op het rooster.
   - Het RTG-kantoor: de reisdesk beslist over trainingskampen (een mens).
   - Leden: het sportbord (EEN app met alle uitslagen en standen), tickets
     kopen op de plattegrond, mijn tickets en sponsor-interesse. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, officeAuth, liveCodename, sport } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  function poort(req, res, next) {
    if (!sport.isSportclub(req.supplier)) return res.status(403).json({ error: 'Alleen voor de sportclub.' });
    next();
  }
  const code = req => req.supplier.code;
  const wie = req => (req.actor && req.actor.name) || 'de club';

  /* ---- de club ---- */
  app.post('/api/sport/cockpit', supplierAuth, poort, (req, res) => res.json(sport.cockpit(code(req))));
  app.post('/api/sport/plattegrond', supplierAuth, poort, (req, res) => res.json(sport.plattegrond(code(req))));
  app.post('/api/sport/plattegrond/zet', supplierAuth, poort, (req, res) => stuur(res, sport.plattegrondZet(code(req), req.body || {})));
  app.post('/api/sport/teams', supplierAuth, poort, (req, res) => res.json(sport.teams(code(req))));
  app.post('/api/sport/team/maak', supplierAuth, poort, (req, res) => stuur(res, sport.teamMaak(code(req), req.body || {})));
  app.post('/api/sport/speler', supplierAuth, poort, (req, res) => stuur(res, sport.spelerVoeg(code(req), String(req.body.teamId || ''), String(req.body.codenaam || ''))));
  app.post('/api/sport/programma', supplierAuth, poort, (req, res) => {
    const b = sport.bord();
    res.json({ ok: true, wedstrijden: b.wedstrijden.filter(w => w.clubCode === code(req)) });
  });
  app.post('/api/sport/wedstrijd/maak', supplierAuth, poort, (req, res) => stuur(res, sport.wedstrijdMaak(code(req), req.body || {})));
  app.post('/api/sport/uitslag', supplierAuth, poort, (req, res) => stuur(res, sport.uitslagZet(code(req), String(req.body.wedstrijdId || ''), req.body.voor, req.body.tegen)));
  app.post('/api/sport/scan', supplierAuth, poort, (req, res) => res.json(sport.ticketScan(code(req), String(req.body.code || ''))));
  app.post('/api/sport/stand', supplierAuth, poort, (req, res) => res.json(sport.stand(code(req), String(req.body.teamId || ''))));
  app.post('/api/sport/velden', supplierAuth, poort, (req, res) => res.json(sport.velden(code(req))));
  app.post('/api/sport/veld/zet', supplierAuth, poort, (req, res) => stuur(res, sport.veldZet(code(req), String(req.body.veldId || ''), req.body || {})));
  app.post('/api/sport/kampen', supplierAuth, poort, (req, res) => res.json(sport.kampen(code(req))));
  app.post('/api/sport/kamp/vraag', supplierAuth, poort, (req, res) => stuur(res, sport.kampVraag(code(req), req.body || {})));
  app.post('/api/sport/sponsors', supplierAuth, poort, (req, res) => res.json(sport.sponsors(code(req))));
  app.post('/api/sport/sponsor/maak', supplierAuth, poort, (req, res) => stuur(res, sport.sponsorMaak(code(req), req.body || {})));
  app.post('/api/sport/sponsor/beslis', supplierAuth, poort, (req, res) => stuur(res, sport.sponsorBeslis(code(req), String(req.body.id || ''), String(req.body.codenaam || ''))));
  app.post('/api/sport/momenten', supplierAuth, poort, (req, res) => res.json(sport.momenten(code(req))));
  app.post('/api/sport/moment/maak', supplierAuth, poort, (req, res) => stuur(res, sport.momentMaak(code(req), { ...req.body, door: wie(req) })));
  app.post('/api/sport/financien', supplierAuth, poort, (req, res) => res.json(sport.financien(code(req))));
  app.post('/api/sport/ai', supplierAuth, poort, async (req, res) => {
    try { res.json(await sport.sportAI(code(req), String(req.body.vraag || ''))); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* ---- het RTG-kantoor: de reisdesk beslist over trainingskampen ---- */
  app.post('/api/office/sport/kampen', officeAuth, (req, res) => res.json(sport.kampen(String(req.body.club || 'FCRTG'))));
  app.post('/api/office/sport/kamp/beslis', officeAuth, (req, res) => stuur(res,
    sport.kampBeslis(String(req.body.naam || 'RTG reisdesk'), String(req.body.club || 'FCRTG'),
      String(req.body.id || ''), req.body.akkoord === true, req.body || {})));

  /* ---- de leden: het sportbord, tickets en sponsor-interesse ---- */
  const lid = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Alleen voor leden.' }); return false; }
    return true;
  };
  app.post('/api/member/sport/bord', auth, (req, res) => res.json(sport.bord()));
  app.post('/api/member/sport/plattegrond', auth, (req, res) => res.json(sport.plattegrond(String(req.body.club || 'FCRTG'))));
  app.post('/api/member/sport/stand', auth, (req, res) => res.json(sport.stand(String(req.body.club || 'FCRTG'), String(req.body.teamId || ''))));
  app.post('/api/member/sport/momenten', auth, (req, res) => res.json(sport.momenten(String(req.body.club || 'FCRTG'))));
  app.post('/api/member/sport/ticket/koop', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, sport.ticketKoop(String(req.body.club || 'FCRTG'), req.session, liveCodename(req.session), req.body || {})); });
  app.post('/api/member/sport/tickets', auth, (req, res) => res.json(sport.mijnTickets(req.session.key)));
  app.post('/api/member/sport/sponsors', auth, (req, res) => {
    const r = sport.sponsors(String(req.body.club || 'FCRTG'));
    res.json({ ok: true, sponsors: (r.sponsors || []).filter(s => s.status === 'open')
      .map(s => ({ id: s.id, pakket: s.pakket, prijsCenten: s.prijsCenten, tekst: s.tekst })) });
  });
  app.post('/api/member/sport/sponsor', auth, (req, res) => { if (!lid(req, res)) return; stuur(res, sport.sponsorInteresse(String(req.body.club || 'FCRTG'), String(req.body.id || ''), liveCodename(req.session))); });
};
