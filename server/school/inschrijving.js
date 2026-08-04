/* School (deelmodule): de leerlingadministratie -- aanmelding, wachtlijst,
   plaatsing, uitschrijving en overstap. Dit is de wortel van School Core: een
   leerling bestaat hier EEN keer, en klas, dossier, aanwezigheid, financien en
   rapport verwijzen allemaal naar dezelfde id (LAT-regel 4: nooit twee plekken
   die dezelfde waarheid vasthouden).

   Drie dingen die hier bewust zo zijn:

   - EEN PLAATSING IS EEN MENSENBESLUIT. De wachtlijst rekent uit dat een
     opleiding vol is; wie er wordt geplaatst beslist de administratie. Het
     systeem stelt hooguit voor.
   - PLAATSEN DOET HET WERK. Bij een plaatsing landt de leerling meteen in de
     klas (dezelfde lijst die de leraar al gebruikt), en bij uitschrijving gaat
     hij daar weer uit en wordt zijn toegang gesloten. Dat is de automatisering
     uit het pakket, maar dan zonder dat er een tweede leerlingenlijst ontstaat.
   - UITSCHRIJVEN WIST NIET. Het dossier blijft staan met een einddatum, want
     een school moet jaren later nog een diploma kunnen bevestigen. Wat wanneer
     echt weg mag, hoort bij de bewaartermijnen (server/bewaartermijnen.js) en
     niet bij een knop in de administratie. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, K, eigenVeld, poort, log, leerlingSleutel } = sctx;

  const STATUS = ['aanmelding', 'wachtlijst', 'ingeschreven', 'uitgeschreven', 'afgewezen'];
  function L(sch) { if (!sch.leerlingen) sch.leerlingen = {}; return sch.leerlingen; }
  function O(sch) { if (!sch.opleidingen) sch.opleidingen = {}; return sch.opleidingen; }
  const kort = (l) => ({ id: l.id, naam: l.naam, status: l.status, klasCode: l.klasCode || null,
    opleiding: l.opleiding || null, vestiging: l.vestiging || null, at: l.at,
    wachtlijstAt: l.wachtlijstAt || null, ingeschrevenAt: l.ingeschrevenAt || null, uitgeschrevenAt: l.uitgeschrevenAt || null });
  sctx.leerlingLijst = L;
  sctx.leerlingKort = kort;

  /* ---------- aanmelden ----------
     De administratie meldt aan (balie, papier, overstap van een andere school)
     of een gezin doet het zelf via de gezinsapp; in beide gevallen komt de
     leerling hier binnen met status 'aanmelding'. Een aanmelding is nog geen
     plaats: dat is precies het verschil dat ouders willen horen. */
  router.post('/school/leerling/aanmeld', (req, res) => {
    const g = poort(req, res, 'leerling.schrijf'); if (!g) return;
    const naam = schoon(req.body.naam, 60);
    if (!naam) return res.status(400).json({ error: 'Vul de naam van de leerling in.' });
    const opleiding = schoon(req.body.opleiding, 40) || null;
    if (opleiding && !eigenVeld(O(g.sch), opleiding)) return res.status(400).json({ error: 'Die opleiding staat niet in de schoolgids van deze school.' });
    const id = rid(6);
    const l = { id, naam, geboren: schoon(req.body.geboren, 10) || null,
      opleiding, vestiging: schoon(req.body.vestiging, 20) || null,
      gezinCode: schoon(req.body.gezinCode, 24) || null, profielId: schoon(req.body.profielId, 24) || null,
      status: 'aanmelding', klasCode: null, at: nu(),
      contact: { adres: null, postcode: null, plaats: null, telefoon: null, email: null, verzorgers: [] },
      documenten: [], overstappen: [], herkomst: schoon(req.body.herkomst, 80) || null };
    L(g.sch)[id] = l;
    save();
    res.json({ ok: true, leerling: kort(l), vervolg: 'De aanmelding staat genoteerd. Plaatsen of op de wachtlijst zetten doet de administratie.' });
  });

  /* De capaciteit van een opleiding bepaalt of er nog plek is. Dit rekent en
     beslist niet: het antwoord is een advies aan de administratie. */
  function ruimte(sch, opleiding) {
    const o = opleiding ? eigenVeld(O(sch), opleiding) : null;
    if (!o || !o.plaatsen) return { vol: false, bezet: null, plaatsen: null };
    const bezet = Object.values(L(sch)).filter(x => x.opleiding === opleiding && x.status === 'ingeschreven').length;
    return { vol: bezet >= o.plaatsen, bezet, plaatsen: o.plaatsen };
  }

  /* ---------- besluit: plaatsen, wachtlijst of afwijzen ---------- */
  router.post('/school/leerling/besluit', (req, res) => {
    const g = poort(req, res, 'leerling.schrijf'); if (!g) return;
    const l = eigenVeld(L(g.sch), req.body.leerlingId);
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const besluit = String(req.body.besluit || '');
    if (!['plaatsen', 'wachtlijst', 'afwijzen'].includes(besluit)) return res.status(400).json({ error: 'Kies plaatsen, wachtlijst of afwijzen.' });

    if (besluit === 'afwijzen') {
      l.status = 'afgewezen'; l.reden = schoon(req.body.reden, 200) || null;
      log(g.sch, g.p, 'leerling-afgewezen', l.id, l.reden || 'geen reden genoteerd');
      save();
      return res.json({ ok: true, leerling: kort(l) });
    }
    if (besluit === 'wachtlijst') {
      l.status = 'wachtlijst'; l.wachtlijstAt = nu();
      const rij = Object.values(L(g.sch)).filter(x => x.status === 'wachtlijst' && x.opleiding === l.opleiding)
        .sort((a, b) => String(a.wachtlijstAt).localeCompare(String(b.wachtlijstAt)));
      save();
      return res.json({ ok: true, leerling: kort(l), plek: rij.findIndex(x => x.id === l.id) + 1, vanTotaal: rij.length });
    }

    // plaatsen: klas erbij, en de leerling landt meteen in de klaslijst
    const klasCode = String(req.body.klasCode || '').trim().toUpperCase();
    const k = klasCode ? eigenVeld(K(), klasCode) : null;
    if (klasCode && (!k || k.schoolCode !== g.sch.code)) return res.status(404).json({ error: 'Die klas hoort niet bij deze school.' });
    const r = ruimte(g.sch, l.opleiding);
    if (r.vol && req.body.tochPlaatsen !== true)
      return res.status(409).json({ error: 'Deze opleiding zit vol (' + r.bezet + ' van ' + r.plaatsen + '). Zet de leerling op de wachtlijst, of plaats met tochPlaatsen als de directie ruimte maakt.', vol: true, bezet: r.bezet, plaatsen: r.plaatsen });
    l.status = 'ingeschreven'; l.ingeschrevenAt = nu(); l.uitgeschrevenAt = null;
    if (k) {
      l.klasCode = k.code;
      const sleutel = l.gezinCode && l.profielId ? leerlingSleutel(l.gezinCode, l.profielId) : 'L:' + l.id;
      l.sleutel = sleutel;
      if (!(k.leerlingen || []).some(x => x.sleutel === sleutel))
        k.leerlingen.push({ sleutel, gezinCode: l.gezinCode || null, profielId: l.profielId || null, naam: l.naam, at: nu(), leerlingId: l.id });
    }
    log(g.sch, g.p, 'leerling-geplaatst', l.id, 'plaatsing' + (k ? ' in klas ' + k.code : ''));
    save();
    res.json({ ok: true, leerling: kort(l), inKlas: k ? k.naam : null });
  });

  /* ---------- de lijst ----------
     Filteren op status, klas, opleiding en vestiging. Wie alleen 'leerling'
     mag, ziet namen en plaatsing; zorg, incidenten en geld zitten hier niet
     in -- die hebben hun eigen poort en hun eigen journaalregel. */
  router.post('/school/leerling/lijst', (req, res) => {
    const g = poort(req, res, 'leerling'); if (!g) return;
    const f = { status: schoon(req.body.status, 20), klasCode: String(req.body.klasCode || '').trim().toUpperCase(),
      opleiding: schoon(req.body.opleiding, 40), vestiging: schoon(req.body.vestiging, 20) };
    if (f.status && !STATUS.includes(f.status)) return res.status(400).json({ error: 'Onbekende status. Kies: ' + STATUS.join(', ') + '.' });
    const alle = Object.values(L(g.sch));
    const rijen = alle.filter(l => (!f.status || l.status === f.status)
      && (!f.klasCode || l.klasCode === f.klasCode)
      && (!f.opleiding || l.opleiding === f.opleiding)
      && (!f.vestiging || l.vestiging === f.vestiging)).map(kort);
    const tel = {};
    for (const s of STATUS) tel[s] = alle.filter(l => l.status === s).length;
    res.json({ ok: true, aantal: rijen.length, tellingen: tel, leerlingen: rijen });
  });

};
