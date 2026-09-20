/* Routes voor RTG Studio. Alles achter de leden-inlog en alles op de sleutel uit
   de sessie: een stuk-id uit de body wordt altijd tegen de eigenaar getoetst, in
   de kern, zodat een geraden id niets oplevert. */
module.exports = (kern) => {
  const { app, express, auth, muziekMaak, muziekMijn, muziekOpen, muziekBewaar, muziekWeg,
    muziekRahul, anthropic } = kern;
  const bestanden = muziekMaak && muziekMaak.bestanden;
  if (!muziekMaak) return;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG Studio is voor leden.' }); return true; }
    return false;
  };
  const k = (req) => req.session.key;

  /* De persoonlijke bibliotheek van RTG Sound. De upload is rauw, zodat 60 MB
     muziek niet als base64 door JSON en db.data reist. Afspelen gaat met een
     korte luisterkaart; daardoor staat het permanente ledentoken nooit in src. */
  if (bestanden) {
    app.post('/api/muziek/bestand', auth, express.raw({ type: () => true, limit: '61mb' }), async (req, res) => {
      if (geenGast(req, res)) return;
      const kop = naam => { const v = String(req.get(naam) || ''); try { return decodeURIComponent(v); } catch (e) { return v; } };
      try { stuur(res, await bestanden.upload(k(req), req.body,
        req.get('Content-Type') || '', kop('X-RTG-Bestandsnaam') || 'Muziek', req.get('X-RTG-Duur'),
        kop('X-RTG-Titel'), kop('X-RTG-Beschrijving'), req.get('X-RTG-Eigenwerk') === 'ja',
        req.get('Idempotency-Key'))); }
      catch (e) { res.status(500).json({ error: 'Het muziekbestand kon niet worden bewaard.' }); }
    });
    app.post('/api/muziek/bestanden', auth, (req, res) => {
      if (geenGast(req, res)) return;
      stuur(res, bestanden.mijn(k(req)));
    });
    app.post('/api/muziek/feed', auth, (req, res) => {
      if (geenGast(req, res)) return;
      stuur(res, bestanden.feed(k(req)));
    });
    app.post('/api/muziek/bestand-ticket', auth, (req, res) => {
      if (geenGast(req, res)) return;
      stuur(res, bestanden.ticket(k(req), req.body && req.body.id));
    });
    app.post('/api/muziek/bestand-weg', auth, (req, res) => {
      if (geenGast(req, res)) return;
      stuur(res, bestanden.weg(k(req), req.body && req.body.id));
    });
    app.post('/api/muziek/mooi', auth, (req, res) => {
      if (geenGast(req, res)) return;
      stuur(res, bestanden.mooi(k(req), req.body && req.body.id, req.body && req.body.aan));
    });
    app.get('/api/muziek/luister/:ticket', async (req, res) => {
      try {
        const item = await bestanden.luister(req.params.ticket);
        if (!item) return res.status(404).end();
        res.set('Content-Disposition', "inline; filename*=UTF-8''" + encodeURIComponent(item.naam));
        require('../media/bestand').stuurBuffer(req, res, item.bytes, item.mime, 'private, no-store');
      } catch (e) { if (!res.headersSent) res.status(500).end(); }
    });
  }

  app.post('/api/muziek/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekMijn(k(req)));
  });
  app.post('/api/muziek/maak', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekMaak(k(req), req.body || {}));
  });
  app.post('/api/muziek/open', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekOpen(k(req), req.body && req.body.id));
  });
  app.post('/api/muziek/bewaar', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekBewaar(k(req), req.body && req.body.id, req.body || {}));
  });
  app.post('/api/muziek/weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, muziekWeg(k(req), req.body && req.body.id));
  });

  /* Rahul zet iets neer. Het antwoord is een VOORSTEL: het wordt niet bewaard en
     niet toegepast -- de client laat het zien, en de maker beslist of het zijn
     raster in gaat. Zonder AI-sleutel komt het voorstel uit de tabellen van
     kern/muziek-rahul.js; dat is geen terugval maar de gewone werking.

     Claude mag alleen KIEZEN en VARIEREN binnen de instrumenten die bestaan, en
     zijn antwoord gaat langs dezelfde keuring als handwerk. */
  app.post('/api/muziek/rahul', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    if (!muziekRahul) return res.status(503).json({ error: 'De studio-assistent draait niet.' });
    const b = req.body || {};
    const vraag = String(b.vraag || '').slice(0, 300);
    /* Twee smaken, en het verschil is groot genoeg om expliciet te zijn: een
       FIGUUR (een lus om mee te beginnen) of een LIED (vorm, coupletten,
       refreinen en een zanglijn). De tekst die iemand meestuurt wordt op de
       melodie gelegd -- niet geschreven. Rahul verzint uw woorden niet. */
    const lied = b.lied === true;
    const tekst = String(b.tekst || '').slice(0, 600);
    const basis = muziekRahul.voorstel(vraag, { maten: b.maten, zaad: b.zaad, lied, tekst });
    /* Bij een LIED doet Claude niet mee, en dat is geen zuinigheid. Vorm, zang
       en begeleiding moeten over 26 maten bij elkaar horen: het refrein ligt
       hoger dan het couplet, de trap valt weg in de intro, de lettergrepen
       staan op de tel. Een voorstel dat daar de helft van overdoet levert een
       slechter lied op dan de tabellen. Voor een figuur ligt dat anders --
       daar is variatie juist de winst. */
    if (!anthropic || lied) return res.json({ status: 200, ok: true, voorstel: basis, ai: false });
    try {
      const namen = Object.keys(require('../kern/muziek-instrumenten').INSTRUMENTEN);
      const r = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 1200,
        system: 'Je bent Rahul, de studio-assistent van RTG. Je stelt een muzikaal patroon voor als JSON en verder niets.\n' +
          'Vorm: {"bpm":number,"maten":number,"uitleg":string,"kanalen":[{"instrument":string,"stappen":[number],"noten":[{"stap":number,"toon":number,"lengte":number}]}]}\n' +
          'Instrumenten die bestaan: ' + namen.join(', ') + '. Andere namen worden weggegooid.\n' +
          'kick, snare, clap, hihat en tom gebruiken "stappen"; bas, toets, snaar, pluk en lead gebruiken "noten".\n' +
          'Een maat heeft 16 stappen; stap 0 is de eerste tel. "toon" is een MIDI-nootnummer tussen 24 en 96.\n' +
          'Houd het speelbaar en muzikaal: een herkenbare puls, een bas die de akkoorden volgt. Geen uitleg buiten de JSON.',
        messages: [{ role: 'user', content: 'Vraag van de maker: ' + (vraag || 'iets waar ik mee verder kan') +
          '\nAantal maten: ' + basis.maten + '\nAls voorbeeld van de vorm, dit is een geldig antwoord:\n' +
          JSON.stringify({ bpm: basis.bpm, maten: basis.maten, uitleg: basis.uitleg, kanalen: basis.kanalen.slice(0, 2) }) }]
      });
      const tekst = r && r.content && r.content[0] && r.content[0].text;
      const uit = muziekRahul.keurAntwoord(pakJson(tekst), basis, {});
      res.json({ status: 200, ok: true, voorstel: uit, ai: true });
    } catch (e) {
      res.json({ status: 200, ok: true, voorstel: basis, ai: false });
    }
  });

  // Claude zet zijn JSON soms in een codeblok; hier halen we het eruit zonder te
  // gokken: het eerste accolade-paar dat als geheel ontleedt, wint.
  function pakJson(tekst) {
    const s = String(tekst || '');
    const eerst = s.indexOf('{'), laatst = s.lastIndexOf('}');
    if (eerst < 0 || laatst <= eerst) return null;
    return s.slice(eerst, laatst + 1);
  }
};
