/* School (deelmodule): school aanmelden, personeel (aanmelden, status, besluit) en de leraar-basis (klas maken, overzicht).
   Krijgt de gedeelde schoolcontext een keer bij het opstarten vanuit
   server/school.js. */
module.exports = (sctx) => {
  const { router, F, G, save, rid, nu, schoon, gezinVan, profielVan, crypto,
    teVaak, misluktePoging, goedePoging, ipVan, eigenVeld, K, S, schoolVan,
    personeelVan, klasVan, gezinSessie, leerlingVan, klasCode, schoolCode, leerlingSleutel, isActief } = sctx;
  const { FASEN, TRAPPEN } = require('../kern/onderwijs-ladder');
  // "mijn klas" = ik heb hem gemaakt OF ik sta vast op het lerarenteam
  const vanLeraar = (k, p) => k.leraarId === p.id || (k.leraren || []).some(x => x.id === p.id);
  router.post('/school/school/activeren', (req, res) => {
    const bucket = 'school-activeren:' + ipVan(req);
    if (teVaak(res, bucket)) return;
    const m = /^([A-Z0-9]{6})\.([a-f0-9]{48})$/i.exec(String(req.body.activatie || '').trim());
    const sch = m ? eigenVeld(S(), m[1].toUpperCase()) : null;
    const reg = sch && sch.registratie;
    const hash = m ? crypto.createHash('sha256').update(m[2]).digest('hex') : '';
    const verwacht = reg && String(reg.activatieHash || '');
    const x = Buffer.from(hash), y = Buffer.from(verwacht);
    const geldig = reg && reg.activatieStatus === 'open' && Date.parse(reg.activatieVerlooptAt) > Date.parse(nu())
      && x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
    if (!geldig) {
      misluktePoging(bucket, 6, 15);
      return res.status(403).json({ error:'Deze schoolactivatie is ongeldig, gebruikt of verlopen.' });
    }
    reg.activatieStatus = 'gebruikt'; reg.geactiveerdAt = nu(); delete reg.activatieHash; save();
    goedePoging(bucket);
    res.json({ ok:true, schoolCode:sch.code, beheerToken:sch.token,
      school:{ naam:sch.naam, plaats:sch.plaats } });
  });
  router.post('/school/school/maak', (req, res) => {
    /* Deze oude snelle deur blijft alleen bestaan voor de geïsoleerde
       testsuite die complete scholen als fixture nodig heeft. In productie
       loopt iedere nieuwe school via /registratie/aanvragen; anders zou dit
       pad alsnog vóór BRIN- en privacycontrole een beheersleutel uitgeven. */
    if (process.env.NODE_ENV !== 'test') return res.status(410).json({
      error:'Nieuwe scholen registreren via de veilige FOUNDATION-registratiebalie.' });
    /* Bewust open (scripts/poortwacht.js, PUBLIEK): een school heeft hier nog
       geen enkele login. Maar open en scheppend vraagt een rem per afzender;
       vijf aanmeldingen per tien minuten is voor een echte school ruim. */
    const bucket = 'schoolmaak:' + ipVan(req);
    if (teVaak(res, bucket)) return;
    const naam = schoon(req.body.naam, 80);
    const plaats = schoon(req.body.plaats, 60);
    if (!naam) return res.status(400).json({ error: 'Vul de naam van de school in.' });
    misluktePoging(bucket, 5, 10);
    const code = schoolCode();
    S()[code] = { code, naam, plaats: plaats || null, token: rid(16), at: nu(), status: 'wacht', personeel: {} };
    save();
    res.json({ ok: true, schoolCode: code, beheerToken: S()[code].token, naam, status: 'wacht' });
  });

  /* Oude testfixture voor personeel. In productie geeft de directie rollen en
     schoolmail vooraf op via personeelstoegang.js; een schoolcode alleen is
     nooit meer voldoende om een aanmelding of sleutel te krijgen. */
  router.post('/school/personeel/aanmeld', (req, res) => {
    if (process.env.NODE_ENV !== 'test') return res.status(410).json({
      error:'Zelf aanmelden met alleen een schoolcode is gesloten. Vraag de directie om een persoonlijke uitnodiging op uw schoolmail.' });
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
    const pv = personeelVan(req, res, { ookNietActief:true }); if (!pv) return;
    const { sch, p } = pv;
    const klassen = p.status === 'actief' && p.rol === 'leraar'
      ? Object.values(K()).filter(k => k.schoolCode === sch.code && vanLeraar(k, p)).map(klasSamenvatting)
      : [];
    const rtgMail = p.status === 'actief' && sctx.zorgPersoneelsMail
      ? sctx.zorgPersoneelsMail(sch, p) : (p.rtgMail || null);
    res.json({ ok: true, naam: p.naam, rol: p.rol, status: p.status, rtgMail,
      school: { naam: sch.naam, plaats: sch.plaats, code: sch.code, status: sch.status || 'actief' }, klassen,
      // de ladder voor het klas-maakformulier: per schoolsoort de fasen, zodat
      // het scherm nooit zelf een niveaulijst hoeft te verzinnen (een waarheid)
      ladder: {
        trappen: Object.entries(TRAPPEN).sort((a, b) => a[1].volgorde - b[1].volgorde).map(([id, t]) => ({ id, naam: t.naam })),
        fasen: FASEN.map(f => ({ id: f.id, naam: f.naam, trap: f.trap }))
      } });
  });

  /* ---------- directie: overzicht en personeelsbesluiten ---------- */
  function klasSamenvatting(k) {
    const f = k.fase ? FASEN.find(x => x.id === k.fase) : null;
    return {
      code: k.code, naam: k.naam, leraar: k.leraar,
      fase: k.fase || null, trap: k.trap || null,
      niveau: f ? f.naam + ' (' + ((TRAPPEN[f.trap] || {}).naam || f.trap) + ')' : null,
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
      personeel: Object.values(sch.personeel || {}).map(p => ({ id: p.id, naam: p.naam, rol: p.rol,
        status: p.status, at: p.at, rtgMail:p.status === 'actief' && sctx.zorgPersoneelsMail
          ? sctx.zorgPersoneelsMail(sch, p) : (p.rtgMail || null) })),
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
    if (sctx.zorgPersoneelsMail) sctx.zorgPersoneelsMail(sch, p);
    save();
    res.json({ ok: true, rtgMail:p.rtgMail || null });
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
    /* Het niveau van de klas komt van de officiele ladder, niet uit de vrije
       naam. Zonder dit veld voerde de bijles de klasnaam ("3B", "Meester
       Jan") als niveau aan de AI, en kon de toets-bibliotheek een
       basisschoolleraar academisch schrijven aanbieden. De fase is optioneel
       (bestaande klassen hebben er geen); de trap volgt uit de fase. */
    let fase = null, trap = null;
    if (req.body.fase != null && String(req.body.fase).trim()) {
      const f = FASEN.find(x => x.id === String(req.body.fase).trim());
      if (!f) return res.status(400).json({ error: 'Dat niveau staat niet op de ladder.' });
      fase = f.id; trap = f.trap;
    }
    const code = klasCode();
    K()[code] = { code, naam, fase, trap, leraar: p.naam, school: sch.naam, schoolCode: sch.code, leraarId: p.id, token: rid(16), at: nu(),
      leerlingen: [], rooster: [], huiswerk: [], cijfers: [], mededelingen: [], absenties: [], berichten: {}, berichtenOuders: {} };
    save();
    res.json({ ok: true, code, naam, fase, trap });
  });

  // de klassen van deze leraar (het multi-klas-dashboard)
  router.post('/school/leraar/overzicht', (req, res) => {
    const pv = personeelVan(req, res); if (!pv) return;
    const { sch, p } = pv;
    if (p.status !== 'actief') return res.status(403).json({ error: 'De school moet je aanmelding eerst goedkeuren.' });
    const klassen = Object.values(K()).filter(k => k.schoolCode === sch.code && vanLeraar(k, p)).map(klasSamenvatting);
    res.json({ ok: true, naam: p.naam, school: sch.naam, klassen });
  });

  // gewogen gemiddelde van een lijst cijfers (of null zonder cijfers)
  return { klasSamenvatting };
};
