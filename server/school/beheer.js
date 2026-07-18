/* School (deelmodule): school aanmelden, personeel (aanmelden, status, besluit) en de leraar-basis (klas maken, overzicht).
   Krijgt de gedeelde schoolcontext een keer bij het opstarten vanuit
   server/school.js. */
module.exports = (sctx) => {
  const { router, F, G, save, rid, nu, schoon, gezinVan, profielVan, crypto,
    eigenVeld, K, S, schoolVan, personeelVan, klasVan, gezinSessie, leerlingVan, klasCode, schoolCode, leerlingSleutel, isActief } = sctx;
  router.post('/school/school/maak', (req, res) => {
    const naam = schoon(req.body.naam, 80);
    const plaats = schoon(req.body.plaats, 60);
    if (!naam) return res.status(400).json({ error: 'Vul de naam van de school in.' });
    const code = schoolCode();
    S()[code] = { code, naam, plaats: plaats || null, token: rid(16), at: nu(), status: 'wacht', personeel: {} };
    save();
    res.json({ ok: true, schoolCode: code, beheerToken: S()[code].token, naam, status: 'wacht' });
  });

  /* ---------- stap 2: PERSONEEL meldt zich aan bij de school ----------
     Een leraar of ondersteuner meldt zich met de schoolcode en wacht daarna op
     goedkeuring van de directie. Pas na goedkeuring kan een leraar klassen maken. */
  router.post('/school/personeel/aanmeld', (req, res) => {
    const sch = eigenVeld(S(), String(req.body.schoolCode || '').trim().toUpperCase());
    if (!sch) return res.status(404).json({ error: 'Deze schoolcode kennen we niet. Vraag hem na bij de school.' });
    const naam = schoon(req.body.naam, 60);
    if (!naam) return res.status(400).json({ error: 'Vul je naam in.' });
    const rol = req.body.rol === 'ondersteuning' ? 'ondersteuning' : 'leraar';
    const id = rid(6);
    sch.personeel[id] = { id, naam, rol, token: rid(16), status: 'wacht', at: nu() };
    save();
    res.json({ ok: true, personeelId: id, personeelToken: sch.personeel[id].token, status: 'wacht',
      school: { naam: sch.naam, plaats: sch.plaats } });
  });

  // personeelslid: waar sta ik? (wacht/actief) + mijn klassen als ik leraar ben
  router.post('/school/personeel/status', (req, res) => {
    const pv = personeelVan(req, res); if (!pv) return;
    const { sch, p } = pv;
    const klassen = p.status === 'actief' && p.rol === 'leraar'
      ? Object.values(K()).filter(k => k.schoolCode === sch.code && k.leraarId === p.id).map(klasSamenvatting)
      : [];
    res.json({ ok: true, naam: p.naam, rol: p.rol, status: p.status,
      school: { naam: sch.naam, plaats: sch.plaats, code: sch.code, status: sch.status || 'actief' }, klassen });
  });

  /* ---------- directie: overzicht en personeelsbesluiten ---------- */
  function klasSamenvatting(k) {
    return {
      code: k.code, naam: k.naam, leraar: k.leraar,
      leerlingen: (k.leerlingen || []).length,
      openAbsenties: (k.absenties || []).filter(a => !a.afgehandeld).length,
      huiswerk: (k.huiswerk || []).length,
      berichten: Object.values(k.berichten || {}).reduce((n, d) => n + d.length, 0)
        + Object.values(k.berichtenOuders || {}).reduce((n, d) => n + d.length, 0)
    };
  }
  router.post('/school/school/overzicht', (req, res) => {
    const sch = schoolVan(req, res); if (!sch) return;
    res.json({
      ok: true, schoolCode: sch.code, naam: sch.naam, plaats: sch.plaats, status: sch.status || 'actief',
      personeel: Object.values(sch.personeel || {}).map(p => ({ id: p.id, naam: p.naam, rol: p.rol, status: p.status, at: p.at })),
      klassen: Object.values(K()).filter(k => k.schoolCode === sch.code).map(klasSamenvatting)
    });
  });
  router.post('/school/personeel/besluit', (req, res) => {
    const sch = schoolVan(req, res); if (!sch) return;
    const p = eigenVeld(sch.personeel || {}, req.body.personeelId);
    if (!p) return res.status(404).json({ error: 'Dit personeelslid is niet gevonden.' });
    // afwijzen mag altijd (spam opruimen), maar toelaten kan pas als RTG de school
    // zelf heeft goedgekeurd
    if (req.body.akkoord === false) { delete sch.personeel[p.id]; save(); return res.json({ ok: true }); }
    if (!isActief(sch)) return res.status(403).json({ error: 'De school wacht nog op goedkeuring door RTG. Zodra RTG de school activeert, kun je personeel toelaten.' });
    p.status = 'actief';
    save();
    res.json({ ok: true });
  });

  /* ---------- stap 3: een GOEDGEKEURDE leraar maakt klassen ---------- */
  router.post('/school/leraar/klas/maak', (req, res) => {
    const pv = personeelVan(req, res); if (!pv) return;
    const { sch, p } = pv;
    if (!isActief(sch)) return res.status(403).json({ error: 'De school wacht nog op goedkeuring door RTG.' });
    if (p.status !== 'actief') return res.status(403).json({ error: 'De school moet je aanmelding eerst goedkeuren.' });
    if (p.rol !== 'leraar') return res.status(403).json({ error: 'Alleen een leraar maakt klassen.' });
    const naam = schoon(req.body.naam, 60);
    if (!naam) return res.status(400).json({ error: 'Geef de klas een naam.' });
    const code = klasCode();
    K()[code] = { code, naam, leraar: p.naam, school: sch.naam, schoolCode: sch.code, leraarId: p.id, token: rid(16), at: nu(),
      leerlingen: [], rooster: [], huiswerk: [], cijfers: [], mededelingen: [], absenties: [], berichten: {}, berichtenOuders: {} };
    save();
    res.json({ ok: true, code, naam });
  });

  // de klassen van deze leraar (het multi-klas-dashboard)
  router.post('/school/leraar/overzicht', (req, res) => {
    const pv = personeelVan(req, res); if (!pv) return;
    const { sch, p } = pv;
    if (p.status !== 'actief') return res.status(403).json({ error: 'De school moet je aanmelding eerst goedkeuren.' });
    const klassen = Object.values(K()).filter(k => k.schoolCode === sch.code && k.leraarId === p.id).map(klasSamenvatting);
    res.json({ ok: true, naam: p.naam, school: sch.naam, klassen });
  });

  // gewogen gemiddelde van een lijst cijfers (of null zonder cijfers)
  return { klasSamenvatting };
};
