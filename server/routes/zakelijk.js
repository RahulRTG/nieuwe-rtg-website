/* Domein "zakelijk": RTG Zakelijk, het professionele netwerk van de Lifestyle
   en Business Pass (de LinkedIn-laag van het platform).

   Wat het is: een zakelijk profiel (kop, sector, vaardigheden, ervaring, "open
   voor werk"), een gids waarin leden elkaar vinden (met gedeelde connecties en
   een open-voor-werk-filter), professioneel verbinden (dat rijdt mee op de
   bestaande vriendengraaf, dus DM en bellen werken meteen via de Salon), een
   zakelijke feed met likes en reacties, aanbevelingen per vaardigheid, en het
   KANSENBORD: leden plaatsen opdrachten, samenwerkingen en investeringsvragen,
   en de open vacatures van de RTG-partners lopen er automatisch in mee.

   Privacy: het profiel is OPT-IN (zichtbaar pas na bewust aanmaken) en draait
   op de codenaam plus een zelfgekozen professionele naam. Niemand komt in de
   gids zonder er zelf voor te kiezen. */
module.exports = (kern) => {
  const { app, auth, crypto, db, save, schoon, liveCodename, openVacatures, gidsHaal,
    socialVerbind, connectieTussen, statusVan, zijnVrienden, verbActief, codenaamVan, sseToCustomer } = kern;

  function Z() {
    if (!db.data.zakelijk) db.data.zakelijk = { profielen: {}, posts: [], kansen: [] };
    if (!db.data.zakelijk.profielen) db.data.zakelijk.profielen = {};
    if (!Array.isArray(db.data.zakelijk.posts)) db.data.zakelijk.posts = [];
    if (!Array.isArray(db.data.zakelijk.kansen)) db.data.zakelijk.kansen = [];
    return db.data.zakelijk;
  }
  const nu = () => new Date().toISOString();
  const rid = (n = 4) => crypto.randomBytes(n).toString('hex');

  // voor de professionele passen: Lifestyle en Business (gast en basis-pas niet)
  const PRO = ['lifestyle', 'business'];
  function pro(req, res, next) {
    if (!PRO.includes(req.session.tier))
      return res.status(403).json({ error: 'RTG Zakelijk is onderdeel van de Lifestyle en Business Pass.' });
    next();
  }
  const mijnProfiel = (req) => Z().profielen[req.session.key] || null;
  const pasVan = (key) => (gidsHaal(key) || {}).tier || null;

  // actieve connecties van een lid; daarmee tellen we gedeelde connecties
  // ("via wie ken ik deze persoon"), het netwerkgevoel van de gids
  function connectiesVan(key) {
    return db.data.connections.filter(c => (c.a === key || c.b === key) && verbActief(c))
      .map(c => (c.a === key ? c.b : c.a));
  }
  function gedeeldeConnecties(mij, ander) {
    const set = new Set(connectiesVan(mij));
    return connectiesVan(ander).filter(k => set.has(k));
  }

  // publieke weergave van een profiel (voor de gids en de feed)
  function publiek(p, mij) {
    const aanb = p.aanbevelingen || {};
    const gedeeld = mij && mij !== p.key ? gedeeldeConnecties(mij, p.key) : [];
    return {
      key: p.key, codenaam: p.codenaam, naam: p.naam, kop: p.kop, sector: p.sector,
      plaats: p.plaats, bio: p.bio, openVoorWerk: !!p.openVoorWerk, pas: pasVan(p.key),
      vaardigheden: (p.vaardigheden || []).map(v => ({ naam: v, aanbevolen: (aanb[v] || []).length,
        doorMij: mij ? (aanb[v] || []).includes(mij) : false })),
      ervaring: p.ervaring || [],
      status: mij && mij !== p.key ? statusVan(mij, connectieTussen(mij, p.key)) : null,
      gedeeld: gedeeld.length,
      gedeeldNamen: gedeeld.slice(0, 3).map(codenaamVan)
    };
  }

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

  /* ---------- de zakelijke feed ---------- */
  app.post('/api/zakelijk/post', auth, pro, (req, res) => {
    const p = mijnProfiel(req);
    if (!p) return res.status(409).json({ error: 'Maak eerst je zakelijke profiel aan; dan post je onder je professionele naam.', needProfiel: true });
    const tekst = schoon(req.body.tekst, 600);
    if (!tekst) return res.status(400).json({ error: 'Schrijf eerst iets.' });
    const z = Z();
    z.posts.unshift({ id: rid(), key: p.key, naam: p.naam, kop: p.kop, tekst, at: nu(), likes: [], reacties: [] });
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
        id: x.id, key: x.key, naam: x.naam, kop: x.kop, tekst: x.tekst, at: x.at,
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
    post.reacties.push({ naam: p.naam, key: p.key, tekst, at: nu() });
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
