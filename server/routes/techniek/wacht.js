/* Domein-submodule "De Wacht": de boardroom-kant van het immuunsysteem + de
   raadkamer. Gemount vanuit routes/techniek.js op de gedeelde tech-context; alle
   routes zitten achter techAuth (alleen wie het techniek-bord mag zien), en de
   handelingen achter eigenaarAlleen (alleen de gemachtigde beslist en snijdt af).

   De AI "kauwt uit" met /analyseer (heuristiek nu; een echte-AI-verrijking mag
   later de tekst mooier maken), maar voert NIETS zelf uit: elk voorstel wacht op
   een besluit accepteren / afwijzen / inconclaaf, en zelfs "accepteren" draait
   alleen een actie uit de vaste veilige lijst in kern/wacht.js. */
module.exports = (tctx) => {
  const { app, techAuth, eigenaarAlleen, accounts } = tctx;
  const wacht = tctx.wacht;
  const av = tctx.av; // De Ontsmetter (malware-scanner)
  if (!wacht) return; // niet gebouwd (bijv. losse test-context): niets te mounten

  // Het bord: meters + grafiek + quarantaine + open voorstellen + hygiëne-stand +
  // de stand van De Ontsmetter (gescande/geweigerde uploads, definitie-versie).
  app.get('/api/techniek/wacht/bord', techAuth, (req, res) => {
    res.json(Object.assign(wacht.bord(), { av: av ? av.stand() : null }));
  });

  // Een testbestand door De Ontsmetter halen (bijv. de EICAR-teststring), zodat
  // de eigenaar de scanner live kan verifiëren zonder echte malware.
  app.post('/api/techniek/wacht/av-test', techAuth, eigenaarAlleen, (req, res) => {
    if (!av) return res.status(404).json({ error: 'Scanner niet actief.' });
    const inhoud = String((req.body && req.body.inhoud) || '');
    const r = av.scan(Buffer.from(inhoud, 'latin1'), { naam: String((req.body && req.body.naam) || 'test.txt'), mime: String((req.body && req.body.mime) || 'text/plain') });
    res.json({ ok: true, resultaat: r });
  });

  // De AI kauwt de live-signalen uit tot concrete voorstellen (geen uitvoering).
  app.post('/api/techniek/wacht/analyseer', techAuth, eigenaarAlleen, (req, res) => {
    const nieuw = wacht.analyseer();
    res.json({ ok: true, nieuw: nieuw.length, bord: wacht.bord() });
  });

  // De gemachtigde beslist over een voorstel.
  app.post('/api/techniek/wacht/beslis', techAuth, eigenaarAlleen, (req, res) => {
    const { id, verdict, notitie } = req.body || {};
    const wie = req.techUser ? accounts.realNameOf(req.techUser) : 'eigenaar';
    const r = wacht.beslis(String(id || ''), String(verdict || ''), notitie, wie);
    if (!r.ok) return res.status(400).json(r);
    res.json(Object.assign(r, { bord: wacht.bord() }));
  });

  // Rechtstreeks een indringer afsnijden of vrijgeven (zonder de raadkamer-omweg).
  app.post('/api/techniek/wacht/quarantaine', techAuth, eigenaarAlleen, (req, res) => {
    const bron = String((req.body && req.body.bron) || '').trim();
    const actie = String((req.body && req.body.actie) || 'isoleer');
    if (!bron) return res.status(400).json({ error: 'Geen bron opgegeven.' });
    if (actie === 'vrij') { const had = wacht.vrij(bron); return res.json({ ok: true, vrijgegeven: had, bord: wacht.bord() }); }
    wacht.isoleer(bron, (req.body && req.body.reden) || 'handmatig via de boardroom');
    res.json({ ok: true, bord: wacht.bord() });
  });

  // Nu zelf opruimen (hygiëne-veegbeurt).
  app.post('/api/techniek/wacht/opruimen', techAuth, eigenaarAlleen, (req, res) => {
    const r = wacht.opruimen();
    res.json({ ok: true, resultaat: r, bord: wacht.bord() });
  });

  // De automatische lastafworp (L7-zekering) handmatig opheffen of aanzetten.
  // De zekering trip zichzelf bij een piek en dooft vanzelf; hiermee kan de
  // boardroom hem eerder opheffen (of, zeldzaam, bewust dichtzetten).
  app.post('/api/techniek/wacht/lastafworp', techAuth, eigenaarAlleen, (req, res) => {
    const aan = !!(req.body && req.body.aan);
    const r = wacht.zetLastafworp(aan);
    res.json(Object.assign({ ok: true }, r, { bord: wacht.bord() }));
  });
};
