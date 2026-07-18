/* De Zaakdoos-vloot: de sleutelwacht en de /api/doos/-eindpunten (kloon,
   status, meting, buurmelding, rapport) plus de satelliet-ping. De proxy- en
   journaal-lagen die elke aanvraag omhullen blijven in server.js; hier staan
   alleen de losse routes achter de gedeelde sleutel. Altijd-aan gemount. */
module.exports = (kern) => {
  const { app, db, save, crypto, beveilig, zaakdoos } = kern;

  // de rondreistijd peilen voor de satellietmodus; zonder inloggen, zonder poespas.
  app.get('/api/sat/ping', (req, res) => res.json({ ok: 1, t: Date.now() }));

  /* ---------- de sleutelwacht van de doos-vloot ----------
     Elke /api/doos/-route zit achter de gedeelde sleutel (RTG_DOOS_SLEUTEL),
     in constante tijd vergeleken. Wie te vaak een verkeerde sleutel probeert
     (brute force), wordt per IP een kwartier buitengesloten: ook een DAARNA
     juiste sleutel krijgt dan 429. Elke afketser komt in het veiligheidslog
     en telt mee op het Veiligheid-bord van de kantoren. */
  const doosAfketsers = new Map(); // ip -> [tijdstippen]
  const DOOS_AFKETS_MAX = 8, DOOS_AFKETS_VENSTER = 15 * 60 * 1000;
  function doosSleutelOk(req, res) {
    const ip = req.ip || 'onbekend';
    const rij = (doosAfketsers.get(ip) || []).filter(t => Date.now() - t < DOOS_AFKETS_VENSTER);
    if (rij.length >= DOOS_AFKETS_MAX) {
      doosAfketsers.set(ip, rij);
      res.status(429).json({ error: 'Te veel mislukte pogingen; probeer het over een kwartier opnieuw.' });
      return false;
    }
    const s = process.env.RTG_DOOS_SLEUTEL || '';
    const g = String(req.get('x-doos-sleutel') || '');
    if (!s || g.length !== s.length || !crypto.timingSafeEqual(Buffer.from(g), Buffer.from(s))) {
      rij.push(Date.now());
      doosAfketsers.set(ip, rij);
      if (!Array.isArray(db.data.doosAfketsers)) db.data.doosAfketsers = [];
      db.data.doosAfketsers.unshift({ at: Date.now() });
      db.data.doosAfketsers = db.data.doosAfketsers.slice(0, 500);
      save();
      try { if (beveilig && rij.length >= DOOS_AFKETS_MAX) beveilig.meld('doos-sleutel', 'hoog', 'IP na ' + rij.length + ' verkeerde doos-sleutels een kwartier buitengesloten.', { ip }); } catch (e) {}
      res.status(403).json({ error: 'Geen toegang.' });
      return false;
    }
    doosAfketsers.delete(ip); // een goede sleutel wist de teller
    return true;
  }

  /* De Zaakdoos: een verse kloon van de data voor het kastje in de zaak.
     De doos zelf meldt zijn status onbeschermd op het eigen net. */
  app.get('/api/doos/kloon', (req, res) => {
    if (!doosSleutelOk(req, res)) return;
    res.json({ data: db.data });
  });
  app.get('/api/doos/status', (req, res) => res.json(zaakdoos.status()));
  /* Het meetstation van de doos-vloot: dozen die met instemming van de partner
     meedoen (RTG_DOOS_NETWERK=1) melden hier hun lijnmeting. Compact en anoniem
     van aard: naam, rondreistijd, modus en journaalstand; geen zaakdata. */
  app.post('/api/doos/meting', (req, res) => {
    if (!doosSleutelOk(req, res)) return;
    if (!Array.isArray(db.data.doosMetingen)) db.data.doosMetingen = [];
    const b = req.body || {};
    const meting = {
      doos: String(b.doos || 'doos').replace(/[<>]/g, '').slice(0, 40),
      rtt: Math.max(0, Math.min(60000, Math.round(Number(b.rtt) || 0))),
      modus: b.modus === 'lokaal' ? 'lokaal' : 'cloud',
      journaal: Math.max(0, Math.round(Number(b.journaal) || 0)), at: Date.now()
    };
    // een buurdoos die de melding doorgaf, laat zijn via-stempel achter
    if (b.via) meting.via = String(b.via).replace(/[<>]/g, '').slice(0, 40);
    // de plek van de doos (met instemming meegegeven) voor de wereldkaart
    if (b.plek && Number.isFinite(Number(b.plek.lat)) && Number.isFinite(Number(b.plek.lon))) {
      meting.plek = { lat: Math.max(-90, Math.min(90, Number(b.plek.lat))), lon: Math.max(-180, Math.min(180, Number(b.plek.lon))) };
    }
    db.data.doosMetingen.unshift(meting);
    db.data.doosMetingen = db.data.doosMetingen.slice(0, 2000);
    save();
    // staat er vanaf het wereldbord een opdracht klaar (reset/hulp), geef hem mee
    const opdracht = kern.afdelingen ? kern.afdelingen.opdrachtVoorDoos(meting.doos) : null;
    res.json(opdracht ? { ok: true, opdracht } : { ok: true });
  });
  /* De buurtfailover: een buurdoos zonder eigen lijn geeft zijn melding hier
     (op een doos die de lijn nog wel heeft) af; deze doos stuurt hem door naar
     de cloud met een via-stempel. Alleen op een doos, alleen met de sleutel. */
  app.post('/api/doos/buurmelding', async (req, res) => {
    if (!doosSleutelOk(req, res)) return;
    if (!zaakdoos.actief) return res.status(404).json({ error: 'Dit is geen doos.' });
    const doorgegeven = await zaakdoos.buurDoorgeven(req.body || {});
    res.json({ ok: true, doorgegeven });
  });
  /* Het nachtwerk van de doos-vloot: elke doos die meedoet, stuurt om vier uur
     in de nacht een dagrapport over de lijn: pings, gemiddelde rondreistijd,
     uitval en naspeelwerk. Compact en zonder zaakdata, achter de sleutel. */
  app.post('/api/doos/rapport', (req, res) => {
    if (!doosSleutelOk(req, res)) return;
    if (!Array.isArray(db.data.doosRapporten)) db.data.doosRapporten = [];
    const b = req.body || {};
    db.data.doosRapporten.unshift({
      doos: String(b.doos || 'doos').replace(/[<>]/g, '').slice(0, 40),
      datum: /^\d{4}-\d{2}-\d{2}$/.test(String(b.datum)) ? String(b.datum) : new Date().toISOString().slice(0, 10),
      pings: Math.max(0, Math.round(Number(b.pings) || 0)),
      rttGem: Math.max(0, Math.min(60000, Math.round(Number(b.rttGem) || 0))),
      uitval: Math.max(0, Math.round(Number(b.uitval) || 0)),
      lokaalMin: Math.max(0, Math.round(Number(b.lokaalMin) || 0)),
      nagespeeld: Math.max(0, Math.round(Number(b.nagespeeld) || 0)),
      kloonLeeftijdMin: b.kloonLeeftijdMin == null ? null : Math.max(0, Math.round(Number(b.kloonLeeftijdMin) || 0)),
      kasStuks: Math.max(0, Math.round(Number(b.kasStuks) || 0)),
      journaalNu: Math.max(0, Math.round(Number(b.journaalNu) || 0)), at: Date.now()
    });
    db.data.doosRapporten = db.data.doosRapporten.slice(0, 1000);
    save();
    res.json({ ok: true });
  });
  // het dagrapport van deze doos zelf (lokaal, voor het zaak-scherm en de tests)
  app.get('/api/doos/rapport', (req, res) => res.json(zaakdoos.dagrapport()));
};
