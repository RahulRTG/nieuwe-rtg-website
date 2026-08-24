/* Supplier-submodule "prplus": de volle PR-kamer van elke zaak --
   campagneplanner (Salon-posts en aanbiedingen vooruit plannen; een stille
   minuutklok publiceert wat rijp is, en elk overzicht publiceert ook lazy),
   nieuwsbrief naar volgers via RTMAIL (op codenaam, hoogstens 1 per 7
   dagen -- bewust geen spam), en bereik per post uit de bestaande
   Salon-data (geen nieuwe tracking, geen surveillance). */
module.exports = (kern) => {
  const { app, db, save, supplierAuth, managerOnly, findSupplier, schoon, logActivity,
    sseToSupplier, broadcastSync, salonNaarVolgers, salon, crypto, rtmail } = kern;

  const bak = code => {
    if (!db.data.campagnes) db.data.campagnes = {};
    if (!db.data.campagnes[code]) db.data.campagnes[code] = [];
    return db.data.campagnes[code];
  };

  function publiceer(s, c) {
    const post = {
      id: Date.now() + crypto.randomInt(0, 999),
      author: s.name, tier: 'partner', partner: true, partnerCode: s.code,
      place: s.city, visual: null,
      photo: (Number.isInteger(c.photoIndex) && s.photos && s.photos[c.photoIndex]) || null,
      text: c.tekst, lang: 'nl', at: new Date().toISOString(),
      baseLikes: 0, likedBy: {}, comments: []
    };
    if (c.soort === 'deal') { post.deal = { titel: c.titel, geldigTot: c.geldigTot || null, claims: [] }; post.photo = null; }
    db.data.posts.unshift(post);
    salon.kap();
    c.status = 'geplaatst'; c.geplaatstOp = new Date().toISOString(); c.postId = post.id;
    salonNaarVolgers(s, c.soort === 'deal' ? c.titel : c.tekst);
    broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  }

  function publiceerRijp(code) {
    const s = findSupplier(code);
    if (!s) return 0;
    let n = 0;
    for (const c of bak(code)) if (c.status === 'gepland' && Date.parse(c.publiceerOp) <= Date.now()) { publiceer(s, c); n++; }
    if (n) save();
    return n;
  }

  // de stille minuutklok: ook zonder dat iemand het kantoor opent gaat de
  // geplande campagne live (unref: houdt het proces niet wakker)
  const klok = setInterval(() => {
    try { for (const code of Object.keys(db.data.campagnes || {})) publiceerRijp(code); } catch (e) {}
  }, 60000);
  if (klok.unref) klok.unref();

  // volgers zijn sessiesleutels; het adres loopt via de codenaam uit de
  // ledengids -- de echte naam blijft in de kluis
  function volgerAdres(key) {
    const lid = (db.data.memberDir || {})[key];
    if (!lid || !lid.codename) return null;
    const rollen = (db.data.accountRollen || {})[key] || [];
    return rtmail.adresVoor(rtmail.soortVoor({ tier: lid.tier, rollen }), lid.codename);
  }

  app.post('/api/supplier/pr/overzicht', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const code = req.supplier.code;
    publiceerRijp(code);
    const bereik = db.data.posts.filter(p => p.partnerCode === code).slice(0, 12).map(p => ({
      id: p.id, at: p.at, tekst: String(p.text || '').slice(0, 90),
      likes: (p.baseLikes || 0) + Object.keys(p.likedBy || {}).length,
      reacties: (p.comments || []).length,
      soort: p.deal ? 'deal' : p.poll ? 'poll' : 'post',
      claims: p.deal ? p.deal.claims.length : undefined,
      stemmen: p.poll ? p.poll.opties.reduce((a, o) => a + o.stemmen.length, 0) : undefined
    }));
    const nb = (db.data.nieuwsbrieven || {})[code] || null;
    res.json({ ok: true, campagnes: bak(code), bereik,
      nieuwsbrief: { laatste: nb, volgers: (req.supplier.salon && req.supplier.salon.volgers.length) || 0,
        magWeer: !nb || Date.parse(nb.at) < Date.now() - 7 * 86400000 } });
  });

  app.post('/api/supplier/pr/plan', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const code = req.supplier.code;
    const lijst = bak(code);
    if (lijst.filter(c => c.status === 'gepland').length >= 20) return res.status(409).json({ error: 'Maximaal 20 geplande campagnes tegelijk.' });
    const soort = req.body.soort === 'deal' ? 'deal' : 'post';
    const tekst = schoon(req.body.tekst, 600);
    const titel = schoon(req.body.titel, 80);
    if (!tekst) return res.status(400).json({ error: 'Schrijf eerst een tekst.' });
    if (soort === 'deal' && !titel) return res.status(400).json({ error: 'Geef de aanbieding een titel.' });
    const op = Date.parse(req.body.publiceerOp);
    if (!Number.isFinite(op) || op < Date.now() - 60000) return res.status(400).json({ error: 'Kies een moment in de toekomst.' });
    const pi = parseInt(req.body.photoIndex, 10);
    const c = { id: crypto.randomBytes(4).toString('hex'), soort, tekst, titel: titel || null,
      geldigTot: /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.geldigTot || '')) ? req.body.geldigTot : null,
      photoIndex: Number.isInteger(pi) ? pi : null,
      publiceerOp: new Date(op).toISOString(), status: 'gepland', door: req.actor.name, at: new Date().toISOString() };
    lijst.push(c);
    save();
    logActivity(code, req.actor, 'plande een campagne (' + soort + ') voor ' + c.publiceerOp.slice(0, 16).replace('T', ' '));
    sseToSupplier(code, 'sync', { scope: 'pr' });
    res.json({ ok: true, campagne: c });
  });

  app.post('/api/supplier/pr/plan/weg', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const lijst = bak(req.supplier.code);
    const i = lijst.findIndex(c => c.id === req.body.id && c.status === 'gepland');
    if (i < 0) return res.status(404).json({ error: 'Geplande campagne niet gevonden.' });
    lijst.splice(i, 1);
    save();
    res.json({ ok: true });
  });

  app.post('/api/supplier/pr/nieuwsbrief', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const code = req.supplier.code;
    if (!db.data.nieuwsbrieven) db.data.nieuwsbrieven = {};
    const vorige = db.data.nieuwsbrieven[code];
    if (vorige && Date.parse(vorige.at) > Date.now() - 7 * 86400000)
      return res.status(429).json({ error: 'Hoogstens 1 nieuwsbrief per 7 dagen: zo blijft de brief welkom.' });
    const onderwerp = schoon(req.body.onderwerp, 120);
    const tekst = String(req.body.tekst || '').trim().slice(0, 4000);
    if (!onderwerp || !tekst) return res.status(400).json({ error: 'Geef de brief een onderwerp en een tekst.' });
    const van = rtmail.adresVoor('zaak', code);
    const volgers = (req.supplier.salon && req.supplier.salon.volgers) || [];
    let verstuurd = 0;
    for (const key of volgers.slice(0, 5000)) {
      const naar = volgerAdres(key);
      if (naar && !rtmail.stuur({ van, naar, onderwerp, tekst, soort: 'nieuwsbrief', bron: 'zaak' }).error) verstuurd++;
    }
    db.data.nieuwsbrieven[code] = { onderwerp, at: new Date().toISOString(), verstuurd, door: req.actor.name };
    save();
    logActivity(code, req.actor, 'verstuurde een nieuwsbrief aan ' + verstuurd + ' volger(s)');
    res.json({ ok: true, verstuurd, volgers: volgers.length });
  });

};
