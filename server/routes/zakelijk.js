/* Domein "zakelijk": RTG Zakelijk, het professionele netwerk van de Business
   Pass (de LinkedIn-laag van het platform).

   Wat het is: een zakelijk profiel (kop, sector, vaardigheden, ervaring, "open
   voor werk"), een gids waarin Business-leden elkaar vinden, professioneel
   verbinden (dat rijdt mee op de bestaande vriendengraaf, dus DM en bellen
   werken meteen via de Salon), een zakelijke feed met likes en reacties, en
   aanbevelingen: een verbonden lid beveelt een vaardigheid van je aan.

   Privacy: het profiel is OPT-IN (zichtbaar pas na bewust aanmaken) en draait
   op de codenaam plus een zelfgekozen professionele naam. Niemand komt in de
   gids zonder er zelf voor te kiezen; alleen Business Pass-leden zien de gids. */
module.exports = (kern) => {
  const { app, auth, crypto, db, save, schoon, liveCodename,
    socialVerbind, connectieTussen, statusVan, zijnVrienden, codenaamVan, sseToCustomer } = kern;

  function Z() {
    if (!db.data.zakelijk) db.data.zakelijk = { profielen: {}, posts: [] };
    if (!db.data.zakelijk.profielen) db.data.zakelijk.profielen = {};
    if (!Array.isArray(db.data.zakelijk.posts)) db.data.zakelijk.posts = [];
    return db.data.zakelijk;
  }
  const nu = () => new Date().toISOString();
  const rid = (n = 4) => crypto.randomBytes(n).toString('hex');

  // alleen met de Business Pass; een gast of andere pas ziet dit domein niet
  function business(req, res, next) {
    if (req.session.tier !== 'business')
      return res.status(403).json({ error: 'RTG Zakelijk is onderdeel van de Business Pass.' });
    next();
  }
  const mijnProfiel = (req) => Z().profielen[req.session.key] || null;

  // publieke weergave van een profiel (voor de gids en de feed)
  function publiek(p, mij) {
    const aanb = p.aanbevelingen || {};
    return {
      key: p.key, codenaam: p.codenaam, naam: p.naam, kop: p.kop, sector: p.sector,
      plaats: p.plaats, bio: p.bio, openVoorWerk: !!p.openVoorWerk,
      vaardigheden: (p.vaardigheden || []).map(v => ({ naam: v, aanbevolen: (aanb[v] || []).length,
        doorMij: mij ? (aanb[v] || []).includes(mij) : false })),
      ervaring: p.ervaring || [],
      status: mij && mij !== p.key ? statusVan(mij, connectieTussen(mij, p.key)) : null
    };
  }

  /* ---------- mijn profiel ---------- */
  app.post('/api/zakelijk/profiel', auth, business, (req, res) => {
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

  app.post('/api/zakelijk/profiel/zet', auth, business, (req, res) => {
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
  app.post('/api/zakelijk/gids', auth, business, (req, res) => {
    const mij = req.session.key;
    const q = String(req.body.q || '').trim().toLowerCase();
    const alles = Object.values(Z().profielen)
      .filter(p => p.key !== mij && p.zichtbaar !== false)
      .filter(p => !q || [p.naam, p.kop, p.sector, p.plaats, (p.vaardigheden || []).join(' ')]
        .join(' ').toLowerCase().includes(q))
      .sort((a, b) => String(b.bijgewerkt).localeCompare(String(a.bijgewerkt)));
    res.json({ resultaten: alles.slice(0, 30).map(p => publiek(p, mij)), totaal: alles.length });
  });

  /* professioneel verbinden: hetzelfde vriendschapsverzoek als in de Salon, dus
     na acceptatie werken DM en bellen meteen. Accepteren gaat via de bestaande
     Contacten (/api/member/connect/respond). */
  app.post('/api/zakelijk/connect', auth, business, (req, res) => {
    const doel = Z().profielen[String(req.body.key || '')];
    if (!doel || doel.zichtbaar === false) return res.status(404).json({ error: 'Dit profiel staat niet (meer) in de gids.' });
    const r = socialVerbind(req.session.key, doel.key);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, status: r.st });
  });

  /* ---------- aanbevelingen: een verbonden lid beveelt een vaardigheid aan ---------- */
  app.post('/api/zakelijk/aanbevelen', auth, business, (req, res) => {
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
  app.post('/api/zakelijk/post', auth, business, (req, res) => {
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

  app.post('/api/zakelijk/feed', auth, business, (req, res) => {
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

  app.post('/api/zakelijk/like', auth, business, (req, res) => {
    const post = Z().posts.find(x => x.id === String(req.body.id || ''));
    if (!post) return res.status(404).json({ error: 'Post niet gevonden.' });
    const idx = post.likes.indexOf(req.session.key);
    if (idx >= 0) post.likes.splice(idx, 1); else post.likes.push(req.session.key);
    save();
    res.json({ ok: true, likes: post.likes.length, mijnLike: idx < 0 });
  });

  app.post('/api/zakelijk/reactie', auth, business, (req, res) => {
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
};
