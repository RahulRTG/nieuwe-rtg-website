/* Member-submodule: de werkende kant van de Berichten-app -- zoeken over alle
   kanalen, gesprekken vastzetten/stilzetten/archiveren, en de drie AI-taken
   (samenvatten, een antwoord opstellen, de afspraken eruit halen).

   De lijst zelf staat in ./berichten.js; dit zijn de handelingen. Alles loopt
   over de gewone leden-auth, en dus kan Rahul deze routes ook zelf aanroepen
   via het stuur (kern/stuur.js) -- daarvoor hoeft hier niets extra's te
   gebeuren: een goede route IS de AI-koppeling. Wat de AI hier NIET kan, is
   iets versturen; opstellen mag, versturen doet de mens.
   Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, geenGast, berichten } = kern;
  const fout = (res, e) => res.status(400).json({ error: (e && e.message) || 'Er ging iets mis.' });

  // Zoeken over prive-gesprekken, RTMAIL, sollicitatie-chats en de Berichtenbox.
  app.post('/api/member/berichten/zoek', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json({ ok: true, ...berichten.zoek(req.session.key, req.body.vraag) }); }
    catch (e) { fout(res, e); }
  });

  // Een gesprek vastzetten (bovenaan), stilzetten (geen meldingen) of
  // archiveren (uit de lijst). Niets wordt verwijderd.
  app.post('/api/member/berichten/vlag', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json({ ok: true, vlaggen: berichten.vlagZet(req.session.key, req.body.id, req.body.vlag, !!req.body.aan) }); }
    catch (e) { fout(res, e); }
  });

  // Vat een lang gesprek samen: waar ging het over, wat is besloten, wat ligt open.
  app.post('/api/member/berichten/samenvatting', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try {
      const r = await berichten.samenvat(req.session.key, req.body.id);
      res.status(r.ok ? 200 : (r.status || 400)).json(r);
    } catch (e) { fout(res, e); }
  });

  /* Stel een antwoord op. Het concept komt TERUG als tekst en gaat nergens
     heen -- de mens leest het, past het aan en drukt zelf op versturen. Dat is
     bewust: een AI die zelfstandig namens jou berichten stuurt is geen hulp
     maar een risico. */
  app.post('/api/member/berichten/concept', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try {
      const r = await berichten.concept(req.session.key, req.body.id, req.body.wens);
      res.status(r.ok ? 200 : (r.status || 400)).json(r);
    } catch (e) { fout(res, e); }
  });

  // Haal de afspraken en toezeggingen uit een gesprek, als lijstje dat je met
  // een tik in je agenda kunt zetten (/api/agenda/toevoegen doet dat daarna).
  app.post('/api/member/berichten/afspraken', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try {
      const r = await berichten.afspraken(req.session.key, req.body.id);
      res.status(r.ok ? 200 : (r.status || 400)).json(r);
    } catch (e) { fout(res, e); }
  });
};
