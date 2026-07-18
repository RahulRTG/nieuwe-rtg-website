/* Member-submodule: De Salon (het besloten sociale netwerk). Post-interactie
   (liken, reageren, privebericht) en de publieke partner-etalage (volgen,
   profiel, aanbieding claimen, poll stemmen). Alleen de routes; de helpers
   komen via het kern-object binnen. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, db, save, broadcastSync, canEngage, engageError, registerContact,
    notify, notifySupplier, findSupplier, salonZichtbaar, talen, AUTHOR_TIER, PERSONAS,
    crypto, zorgContact, liveCodename } = kern;

  /* Zodra een lid echt in contact komt met een partner (hier: de partner volgen
     of zijn Salon-etalage bekijken) openen we automatisch een open chatlijn. Zo
     zijn ze nooit vreemden. Idempotent en stil voor gasten (geen ledenchat). */
  const openLijnVoor = (s, session) => {
    if (!s || session.tier === 'guest') return;
    try { zorgContact(s, session.key, liveCodename(session), session.tier); } catch (e) {}
  };
  const openLijn = (s, req) => openLijnVoor(s, req.session);

  app.post('/api/like', auth, (req, res) => {
    const post = db.data.posts.find(p => p.id === Number(req.body.postId));
    if (!post) return res.status(404).json({ error: 'Post niet gevonden.' });
    // Gratis gebruikers (zonder pas) bekijken de Salon, maar liken en reageren niet
    // bij particulieren. Berichten van partners mogen ze wel waarderen.
    if (req.session.tier === 'guest' && !post.partner)
      return res.status(403).json({ error: 'Zonder pas bekijk je de Salon, maar liken en reageren bij leden is voor leden. Solliciteren en betalen bij partners kan wel.' });
    if (req.body.liked) post.likedBy[req.session.key] = true;
    else delete post.likedBy[req.session.key];
    save();
    const likes = post.baseLikes + Object.keys(post.likedBy).length;
    // alle open Salon-schermen de nieuwe like-telling laten zien
    broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
    // de eigenaar van de post een notificatie geven (niet bij eigen like)
    const ownerTier = AUTHOR_TIER[post.author];
    if (req.body.liked && ownerTier && ownerTier !== req.session.tier) {
      notify(ownerTier, { icon: '♥', title: 'Nieuwe like', body: PERSONAS[req.session.tier].full + ' vindt uw post over ' + post.place + ' mooi.', scope: 'salon' });
    }
    res.json({ ok: true, likes });
  });

  app.post('/api/comment', auth, (req, res) => {
    const post = db.data.posts.find(p => p.id === Number(req.body.postId));
    if (!post) return res.status(404).json({ error: 'Post niet gevonden.' });
    if (!canEngage(req.session, post)) {
      return res.status(403).json({ error: engageError(req.session.tier) });
    }
    const text = String(req.body.text || '').trim().slice(0, 500);
    if (!text) return res.status(400).json({ error: 'Lege reactie.' });
    // Echte leden verschijnen in De Salon onder hun codenaam, nooit hun echte naam.
    const who = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].full;
    const clang = talen.taalVan(req.body.lang);
    const comment = { who, tier: req.session.tier, text, lang: clang };
    post.comments.push(comment);
    registerContact(req.session, post);
    save();
    // alle Salon-schermen tonen de nieuwe reactie live
    broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
    // de eigenaar van de post krijgt een notificatie (niet bij eigen reactie)
    const ownerTier = AUTHOR_TIER[post.author];
    if (ownerTier && ownerTier !== req.session.tier) {
      notify(ownerTier, { icon: '💬', title: 'Nieuwe reactie', body: who + ': “' + text.slice(0, 80) + '”', scope: 'salon' });
    }
    res.json({ ok: true, comment });
  });

  app.post('/api/dm', auth, (req, res) => {
    const post = db.data.posts.find(p => p.id === Number(req.body.postId));
    if (!post) return res.status(404).json({ error: 'Post niet gevonden.' });
    if (!canEngage(req.session, post)) {
      return res.status(403).json({ error: engageError(req.session.tier) });
    }
    const text = String(req.body.text || '').trim().slice(0, 1000);
    if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
    registerContact(req.session, post);
    const fromName = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].full;
    db.data.dms.push({
      from: fromName,
      fromTier: req.session.tier,
      to: post.author,
      text,
      lang: talen.taalVan(req.body.lang),
      at: new Date().toISOString()
    });
    save();
    // de ontvanger krijgt een notificatie/push van het privébericht
    const ownerTier = AUTHOR_TIER[post.author];
    if (ownerTier && ownerTier !== req.session.tier) {
      notify(ownerTier, { icon: '✉', title: 'Nieuw bericht in De Salon', body: fromName + ' stuurde u een bericht.', scope: 'salon' });
    }
    res.json({ ok: true });
  });

  app.post('/api/salon/volg', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const s = findSupplier(req.body.code);
    if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
    s.salon = s.salon || { bio: '', volgers: [], sinds: new Date().toISOString() };
    const i = s.salon.volgers.indexOf(req.session.key);
    if (i >= 0) s.salon.volgers.splice(i, 1);
    else { s.salon.volgers.push(req.session.key); openLijn(s, req); }
    save();
    broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
    res.json({ ok: true, volgIk: i < 0, volgers: s.salon.volgers.length });
  });

  /* De publieke Salon-etalage van een partner: bio, foto's, folders, aanbiedingen
     en polls op een plek. Hier leeft de marketing/producten, los van de leden-app. */
  app.post('/api/salon/profiel', auth, (req, res) => {
    const s = findSupplier(req.body.code);
    if (!s || !salonZichtbaar(s)) return res.status(404).json({ error: 'Partner niet gevonden.' });
    const key = req.session.key;
    openLijn(s, req); // vanaf nu geen vreemden meer: open lijn zodra je de Salon bekijkt
    const t = db.data.supplierTypes[s.type] || {};
    const eigen = db.data.posts.filter(p => p.partnerCode === s.code);
    const claimVan = p => (p.deal && (p.deal.claims || []).find(c => c.key === key)) || null;
    const items = eigen.map(p => ({
      id: p.id, at: p.at || null, text: p.text, photo: p.photo || null,
      soort: p.folder ? 'folder' : p.deal ? 'deal' : p.poll ? 'poll' : 'post',
      likes: p.baseLikes + Object.keys(p.likedBy || {}).length,
      folder: p.folder ? { titel: p.folder.titel, fotos: p.folder.fotos || [], items: p.folder.items || [] } : null,
      deal: p.deal ? { titel: p.deal.titel, geldigTot: p.deal.geldigTot || null, mijnCode: (claimVan(p) || {}).code || null } : null,
      poll: p.poll ? { vraag: p.poll.vraag, totaal: p.poll.opties.reduce((n, o) => n + o.stemmen.length, 0),
        opties: p.poll.opties.map(o => ({ tekst: o.tekst, stemmen: o.stemmen.length, mijn: o.stemmen.includes(key) })),
        gestemd: p.poll.opties.some(o => o.stemmen.includes(key)) } : null
    }));
    res.json({
      partner: {
        code: s.code, name: s.name, type: s.type, typeLabel: t.label, icon: t.icon, city: s.city,
        bio: (s.salon && s.salon.bio) || '', foto: (s.salon && s.salon.foto) || null,
        photos: (s.photos || []).slice(0, 8),
        volgers: (s.salon && s.salon.volgers.length) || 0, volgIk: !!(s.salon && s.salon.volgers.includes(key)),
        sinds: (s.salon && s.salon.sinds) || null,
        caps: t.caps || []
      },
      items
    });
  });

  app.post('/api/salon/deal/claim', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const p = db.data.posts.find(x => x.id === Number(req.body.postId));
    if (!p || !p.deal) return res.status(404).json({ error: 'Aanbieding niet gevonden.' });
    if (p.deal.geldigTot && p.deal.geldigTot < new Date().toISOString().slice(0, 10))
      return res.status(410).json({ error: 'Deze aanbieding is verlopen.' });
    const al = p.deal.claims.find(c => c.key === req.session.key);
    if (al) return res.json({ ok: true, code: al.code, alGeclaimd: true });
    const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
    const claim = { key: req.session.key, codename, code: 'RTG-D-' + crypto.randomBytes(3).toString('hex').toUpperCase(), at: new Date().toISOString(), used: false };
    p.deal.claims.push(claim);
    save();
    notifySupplier(p.partnerCode, { icon: '🎁', title: 'Aanbieding geclaimd', body: codename + ' claimde "' + p.deal.titel + '" (' + p.deal.claims.length + 'x totaal).' });
    res.json({ ok: true, code: claim.code });
  });

  app.post('/api/salon/poll/stem', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const p = db.data.posts.find(x => x.id === Number(req.body.postId));
    if (!p || !p.poll) return res.status(404).json({ error: 'Poll niet gevonden.' });
    if (p.poll.opties.some(o => o.stemmen.includes(req.session.key))) return res.status(409).json({ error: 'U heeft al gestemd.' });
    const i = Number(req.body.optie);
    if (!p.poll.opties[i]) return res.status(400).json({ error: 'Onbekende optie.' });
    p.poll.opties[i].stemmen.push(req.session.key);
    save();
    broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
    res.json({ ok: true });
  });
};
