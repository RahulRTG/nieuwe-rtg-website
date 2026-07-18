/* Zakelijk (deelmodule): het netwerk: het eigen profiel (met cv-suggestie),
   profiel zetten, de gids met gedeelde connecties, professioneel verbinden
   en aanbevelingen per vaardigheid. Krijgt de gedeelde context een keer bij
   het opstarten vanuit routes/zakelijk.js. */
module.exports = (zctx) => {
  const { app, auth, crypto, db, save, schoon, liveCodename, openVacatures, gidsHaal, talen,
    socialVerbind, connectieTussen, statusVan, zijnVrienden, verbActief, codenaamVan, sseToCustomer,
    Z, nu, rid, PRO, pro, mijnProfiel, pasVan, connectiesVan, gedeeldeConnecties, publiek } = zctx;
  /* ---------- mijn profiel ---------- */
  app.post('/api/zakelijk/profiel', auth, pro, (req, res) => {
    const p = mijnProfiel(req);
    // cv-suggestie: wie zijn cv al heeft, vult zijn zakelijke profiel in een tik
    const cv = db.data.cvs[req.session.key] || null;
    const suggestie = cv ? {
      kop: String(cv.headline || '').slice(0, 80),
      vaardigheden: (Array.isArray(cv.skills) ? cv.skills : []).slice(0, 15).map(x => String(x).slice(0, 30)),
      ervaring: (Array.isArray(cv.experience) ? cv.experience : []).slice(0, 8).map(x => String(x).slice(0, 120)),
      bio: String(cv.about || '').slice(0, 400)
    } : null;
    res.json({ profiel: p ? publiek(p, null) : null, zichtbaar: p ? p.zichtbaar !== false : true, cvSuggestie: suggestie });
  });

  app.post('/api/zakelijk/profiel/zet', auth, pro, (req, res) => {
    const z = Z();
    const codenaam = liveCodename(req.session);
    const naam = schoon(req.body.naam, 60) || codenaam;
    const kop = schoon(req.body.kop, 80);
    if (!kop) return res.status(400).json({ error: 'Vul een kop in (bijv. "Oprichter" of "Fotograaf").' });
    const oud = z.profielen[req.session.key] || {};
    const vaardigheden = (Array.isArray(req.body.vaardigheden) ? req.body.vaardigheden : [])
      .map(v => schoon(v, 30)).filter(Boolean).slice(0, 15);
    // aanbevelingen op vaardigheden die verdwijnen, vervallen mee
    const aanb = {};
    for (const v of vaardigheden) if ((oud.aanbevelingen || {})[v]) aanb[v] = oud.aanbevelingen[v];
    z.profielen[req.session.key] = {
      key: req.session.key, codenaam, naam, kop,
      sector: schoon(req.body.sector, 40), plaats: schoon(req.body.plaats, 40),
      bio: schoon(req.body.bio, 400),
      vaardigheden,
      ervaring: (Array.isArray(req.body.ervaring) ? req.body.ervaring : []).map(e => schoon(e, 120)).filter(Boolean).slice(0, 8),
      openVoorWerk: !!req.body.openVoorWerk,
      zichtbaar: req.body.zichtbaar !== false,
      aanbevelingen: aanb,
      at: oud.at || nu(), bijgewerkt: nu()
    };
    save();
    res.json({ ok: true, profiel: publiek(z.profielen[req.session.key], null) });
  });

  /* ---------- de gids: professionals vinden ---------- */
  app.post('/api/zakelijk/gids', auth, pro, (req, res) => {
    const mij = req.session.key;
    const q = String(req.body.q || '').trim().toLowerCase();
    const alles = Object.values(Z().profielen)
      .filter(p => p.key !== mij && p.zichtbaar !== false)
      .filter(p => !req.body.openVoorWerk || p.openVoorWerk)
      .filter(p => !q || [p.naam, p.kop, p.sector, p.plaats, (p.vaardigheden || []).join(' ')]
        .join(' ').toLowerCase().includes(q))
      .map(p => publiek(p, mij))
      // wie je via je netwerk al "kent" komt bovenaan; daarna de nieuwste
      .sort((a, b) => (b.gedeeld - a.gedeeld) || String(b.key).localeCompare(String(a.key)));
    res.json({ resultaten: alles.slice(0, 30), totaal: alles.length });
  });

  /* professioneel verbinden: hetzelfde vriendschapsverzoek als in de Salon, dus
     na acceptatie werken DM en bellen meteen. Accepteren gaat via de bestaande
     Contacten (/api/member/connect/respond). */
  app.post('/api/zakelijk/connect', auth, pro, (req, res) => {
    const doel = Z().profielen[String(req.body.key || '')];
    if (!doel || doel.zichtbaar === false) return res.status(404).json({ error: 'Dit profiel staat niet (meer) in de gids.' });
    const r = socialVerbind(req.session.key, doel.key);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, status: r.st });
  });

  /* ---------- aanbevelingen: een verbonden lid beveelt een vaardigheid aan ---------- */
  app.post('/api/zakelijk/aanbevelen', auth, pro, (req, res) => {
    const mij = req.session.key;
    const doel = Z().profielen[String(req.body.key || '')];
    if (!doel) return res.status(404).json({ error: 'Profiel niet gevonden.' });
    if (doel.key === mij) return res.status(400).json({ error: 'Jezelf aanbevelen telt niet.' });
    if (!zijnVrienden(mij, doel.key)) return res.status(403).json({ error: 'Verbind eerst met dit lid; daarna kun je een vaardigheid aanbevelen.' });
    const v = schoon(req.body.vaardigheid, 30);
    if (!(doel.vaardigheden || []).includes(v)) return res.status(404).json({ error: 'Deze vaardigheid staat niet op het profiel.' });
    doel.aanbevelingen = doel.aanbevelingen || {};
    const lijst = (doel.aanbevelingen[v] = doel.aanbevelingen[v] || []);
    const idx = lijst.indexOf(mij);
    if (idx >= 0) lijst.splice(idx, 1); else lijst.push(mij); // nogmaals klikken = intrekken
    save();
    if (idx < 0) sseToCustomer(doel.key, 'social', { kind: 'aanbeveling', van: codenaamVan(mij), vaardigheid: v });
    res.json({ ok: true, aanbevolen: idx < 0, aantal: lijst.length });
  });

};
