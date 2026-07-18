/* Zakelijk (deelmodule): het prikbord: de zakelijke feed (posts, likes,
   reacties) en het kansenbord (opdrachten, samenwerkingen, investeringen,
   met de open partnervacatures er automatisch in mee). Krijgt de gedeelde
   context een keer bij het opstarten vanuit routes/zakelijk.js. */
module.exports = (zctx) => {
  const { app, auth, crypto, db, save, schoon, liveCodename, openVacatures, gidsHaal, talen,
    socialVerbind, connectieTussen, statusVan, zijnVrienden, verbActief, codenaamVan, sseToCustomer,
    Z, nu, rid, PRO, pro, mijnProfiel, pasVan, connectiesVan, gedeeldeConnecties, publiek } = zctx;
  /* ---------- de zakelijke feed ---------- */
  app.post('/api/zakelijk/post', auth, pro, (req, res) => {
    const p = mijnProfiel(req);
    if (!p) return res.status(409).json({ error: 'Maak eerst je zakelijke profiel aan; dan post je onder je professionele naam.', needProfiel: true });
    const tekst = schoon(req.body.tekst, 600);
    if (!tekst) return res.status(400).json({ error: 'Schrijf eerst iets.' });
    const z = Z();
    z.posts.unshift({ id: rid(), key: p.key, naam: p.naam, kop: p.kop, tekst, lang: talen.taalVan(req.body.lang), at: nu(), likes: [], reacties: [] });
    z.posts = z.posts.slice(0, 500);
    save();
    res.json({ ok: true, id: z.posts[0].id });
  });

  app.post('/api/zakelijk/feed', auth, pro, (req, res) => {
    const mij = req.session.key;
    const profielen = Z().profielen;
    res.json({
      mijnProfiel: !!profielen[mij],
      posts: Z().posts.slice(0, 40).map(x => ({
        id: x.id, key: x.key, naam: x.naam, kop: x.kop, tekst: x.tekst, lang: x.lang || 'nl', at: x.at,
        likes: x.likes.length, mijnLike: x.likes.includes(mij),
        reacties: x.reacties.slice(-6), reactiesTotaal: x.reacties.length,
        openVoorWerk: !!(profielen[x.key] && profielen[x.key].openVoorWerk)
      }))
    });
  });

  app.post('/api/zakelijk/like', auth, pro, (req, res) => {
    const post = Z().posts.find(x => x.id === String(req.body.id || ''));
    if (!post) return res.status(404).json({ error: 'Post niet gevonden.' });
    const idx = post.likes.indexOf(req.session.key);
    if (idx >= 0) post.likes.splice(idx, 1); else post.likes.push(req.session.key);
    save();
    res.json({ ok: true, likes: post.likes.length, mijnLike: idx < 0 });
  });

  app.post('/api/zakelijk/reactie', auth, pro, (req, res) => {
    const p = mijnProfiel(req);
    if (!p) return res.status(409).json({ error: 'Maak eerst je zakelijke profiel aan.', needProfiel: true });
    const post = Z().posts.find(x => x.id === String(req.body.id || ''));
    if (!post) return res.status(404).json({ error: 'Post niet gevonden.' });
    const tekst = schoon(req.body.tekst, 300);
    if (!tekst) return res.status(400).json({ error: 'Schrijf eerst iets.' });
    post.reacties.push({ naam: p.naam, key: p.key, tekst, lang: talen.taalVan(req.body.lang), at: nu() });
    if (post.reacties.length > 60) post.reacties.splice(0, post.reacties.length - 60);
    save();
    res.json({ ok: true, reacties: post.reacties.slice(-6), reactiesTotaal: post.reacties.length });
  });

  /* ---------- het kansenbord ----------
     Leden plaatsen hier wat ze ZOEKEN of BIEDEN: een opdracht, een
     samenwerking, een vacature in hun eigen zaak, of een investeringsvraag.
     De open vacatures van de RTG-partners lopen automatisch mee, zodat het
     bord altijd leeft. Reageren kan met een profiel; de plaatser sluit de
     kans zodra hij vervuld is. */
  const KANS_SOORTEN = ['opdracht', 'samenwerking', 'vacature', 'investering', 'anders'];

  app.post('/api/zakelijk/kans', auth, pro, (req, res) => {
    const p = mijnProfiel(req);
    if (!p) return res.status(409).json({ error: 'Maak eerst je zakelijke profiel aan.', needProfiel: true });
    const titel = schoon(req.body.titel, 90);
    if (!titel) return res.status(400).json({ error: 'Geef de kans een titel.' });
    const soort = KANS_SOORTEN.includes(req.body.soort) ? req.body.soort : 'anders';
    const z = Z();
    z.kansen.unshift({
      id: rid(), key: p.key, naam: p.naam, kop: p.kop, soort, titel,
      omschrijving: schoon(req.body.omschrijving, 600), plaats: schoon(req.body.plaats, 40),
      skills: (Array.isArray(req.body.skills) ? req.body.skills : []).map(v => schoon(v, 30)).filter(Boolean).slice(0, 8),
      open: true, at: nu(), reacties: []
    });
    z.kansen = z.kansen.slice(0, 200);
    save();
    res.json({ ok: true, id: z.kansen[0].id });
  });

  app.post('/api/zakelijk/kansen', auth, pro, (req, res) => {
    const mij = req.session.key;
    const q = String(req.body.q || '').trim().toLowerCase();
    const soort = KANS_SOORTEN.includes(req.body.soort) ? req.body.soort : null;
    const past = (k) => (!soort || k.soort === soort) &&
      (!q || [k.titel, k.omschrijving, k.plaats, (k.skills || []).join(' '), k.naam].join(' ').toLowerCase().includes(q));
    const leden = Z().kansen
      .filter(k => (k.open || k.key === mij) && past(k))
      .map(k => ({ id: k.id, bron: 'lid', soort: k.soort, titel: k.titel, omschrijving: k.omschrijving,
        plaats: k.plaats, skills: k.skills || [], naam: k.naam, kop: k.kop, key: k.key, at: k.at,
        open: k.open, vanMij: k.key === mij,
        reacties: k.key === mij ? k.reacties.slice(-10) : k.reacties.slice(-3),
        reactiesTotaal: k.reacties.length }));
    // de open vacatures van de partners lopen mee als kansen (bron: partner)
    const partner = (!soort || soort === 'vacature')
      ? openVacatures().filter(v => past({ soort: 'vacature', titel: v.func, omschrijving: v.omschrijving || '',
          plaats: v.plaats || v.stad || '', skills: [], naam: v.bedrijf }))
        .slice(0, 20).map(v => ({ id: 'vac:' + v.supplierCode + ':' + v.id, bron: 'partner', soort: 'vacature',
          titel: v.func + ' bij ' + v.bedrijf, omschrijving: v.omschrijving || '',
          plaats: v.plaats || v.stad || '', skills: [], naam: v.bedrijf, icon: v.icon,
          land: v.landNaam || null, at: v.at, open: true }))
      : [];
    res.json({ kansen: leden.slice(0, 40), partnerVacatures: partner });
  });

  app.post('/api/zakelijk/kans/reageer', auth, pro, (req, res) => {
    const p = mijnProfiel(req);
    if (!p) return res.status(409).json({ error: 'Maak eerst je zakelijke profiel aan.', needProfiel: true });
    const k = Z().kansen.find(x => x.id === String(req.body.id || ''));
    if (!k) return res.status(404).json({ error: 'Kans niet gevonden.' });
    if (!k.open) return res.status(409).json({ error: 'Deze kans is al gesloten.' });
    if (k.key === p.key) return res.status(400).json({ error: 'Dit is je eigen kans.' });
    const tekst = schoon(req.body.tekst, 300);
    if (!tekst) return res.status(400).json({ error: 'Schrijf eerst iets.' });
    k.reacties.push({ naam: p.naam, kop: p.kop, key: p.key, tekst, at: nu() });
    if (k.reacties.length > 40) k.reacties.splice(0, k.reacties.length - 40);
    save();
    sseToCustomer(k.key, 'social', { kind: 'kans', van: p.naam, titel: k.titel });
    res.json({ ok: true, reactiesTotaal: k.reacties.length });
  });

  app.post('/api/zakelijk/kans/sluit', auth, pro, (req, res) => {
    const k = Z().kansen.find(x => x.id === String(req.body.id || ''));
    if (!k) return res.status(404).json({ error: 'Kans niet gevonden.' });
    if (k.key !== req.session.key) return res.status(403).json({ error: 'Alleen de plaatser sluit zijn kans.' });
    k.open = false; k.geslotenAt = nu();
    save();
    res.json({ ok: true });
  });
};
