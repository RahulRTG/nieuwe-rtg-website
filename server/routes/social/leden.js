/* Sociale laag (deelmodule): de RTG-ledenkant: zoeken en verbinden op
   codenaam, DM, (video)bellen, snaps en 24-uurs verhalen. Gemount vanuit
   routes/social.js op de gedeelde kern. */
module.exports = (sctx) => {
  const { kern, isKindVanGezin, rtfOnbSess, rtfSociaal } = sctx;
  const { app, express, auth, geenGast, db, save, rtf, webpush, socialZoek, socialVerbind, ouderVerbind, socialAntwoord, socialConnecties, socialDm, socialDmSend, socialGoedkeur, socialTeKeuren, liveCodename, connectieTussen, verbActief, dmSleutel, codenaamVan, sseToCustomer, sseClients, sseSend, snapSturen, snapsVoor, snapOpenen, verhaalPlaatsen, verhalenVoor, verhaalBekijken, dagOpdracht, speelOpnieuw, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, kindContacten, kindVerwijder, onboarding, lidBoard, lidBoardZet } = kern;

// leden en RTF-gezinsleden zoeken op codenaam (nooit op echte naam)
app.post('/api/member/find', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  res.json({ results: await socialZoek(req.session.key, req.body.q) });
});

// verzoek sturen (mag ook naar een RTF-codenaam)
app.post('/api/member/connect', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const r = socialVerbind(req.session.key, String(req.body.key || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.st });
});

// verzoek beantwoorden
app.post('/api/member/connect/respond', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const r = socialAntwoord(req.session.key, String(req.body.key || ''), req.body.action);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.st });
});

// mijn vrienden + openstaande verzoeken + ongelezen tellers
app.post('/api/member/connections', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const sc = socialConnecties(req.session.key);
  res.json({ me: req.session.key, codename: liveCodename(req.session), connections: sc.connections, requests: sc.requests });
});

// gesprek ophalen (en als gelezen markeren). Moedertaal: heeft de lezer een
// vaste taal (db.data.memberTaal), dan komen de berichten van de ander
// vertaald binnen -- iedereen praat de eigen taal, iedereen leest de zijne.
app.post('/api/member/dm', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const ander = String(req.body.withKey || '');
  const c = connectieTussen(req.session.key, ander);
  if (!verbActief(c)) return res.status(403).json({ error: 'Je bent nog niet verbonden met deze codenaam.' });
  const k = dmSleutel(req.session.key, ander);
  const chat = db.data.memberChats[k] = db.data.memberChats[k] || { messages: [], read: {} };
  chat.read[req.session.key] = new Date().toISOString();
  save();
  let uit = chat.messages.slice(-80);
  const mijnTaal = (db.data.memberTaal || {})[req.session.key];
  if (mijnTaal) {
    const vertaler = require('../../translate');
    uit = await Promise.all(uit.map(async m => {
      if (m.from === req.session.key || !m.text) return m;
      try {
        const t = await vertaler.translate(m.text, mijnTaal, m.lang || undefined);
        return t.translated ? { ...m, text: t.text, vertaaldUit: t.from } : m;
      } catch (e) { return m; }
    }));
  }
  res.json({ messages: uit, codename: codenaamVan(ander), taal: mijnTaal || null });
});

// bericht sturen; optioneel met een gedeelde Salon-post erbij
app.post('/api/member/dm/send', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const ander = String(req.body.toKey || '');
  const c = connectieTussen(req.session.key, ander);
  if (!verbActief(c)) return res.status(403).json({ error: 'Je bent nog niet verbonden met deze codenaam.' });
  const text = String(req.body.text || '').slice(0, 500).trim();
  // de 9+-poort: de vriendenchat deelt de leeftijdsgrens met de rest van de socials
  if (text) { const keur9 = require('../../kern/veilig').keur(text); if (!keur9.ok) return res.status(400).json({ error: keur9.reden }); }
  let postDeel = null;
  if (req.body.postId != null) {
    const p = db.data.posts.find(x => x.id === Number(req.body.postId));
    if (p) postDeel = { id: p.id, author: p.author, place: p.place, text: String(p.text || '').slice(0, 120), photo: p.photo || null };
  }
  if (!text && !postDeel) return res.status(400).json({ error: 'Leeg bericht.' });
  const k = dmSleutel(req.session.key, ander);
  const chat = db.data.memberChats[k] = db.data.memberChats[k] || { messages: [], read: {} };
  // het bericht draagt zijn brontaal mee (de moedertaal van de schrijver),
  // zodat de leeskant precies weet waarvandaan te vertalen
  const msg = { from: req.session.key, text, post: postDeel, at: new Date().toISOString(),
    lang: (db.data.memberTaal || {})[req.session.key] || null };
  chat.messages.push(msg);
  if (chat.messages.length > 300) chat.messages = chat.messages.slice(-300);
  chat.read[req.session.key] = msg.at;
  save();
  const mijnNaam = liveCodename(req.session);
  sseToCustomer(ander, 'social', { kind: 'dm', from: req.session.key, codename: mijnNaam, text: msg.text, post: msg.post, at: msg.at });
  res.json({ ok: true, message: msg });
});

// bel-signalering: pure doorgeefluik tussen twee verbonden leden
app.post('/api/member/call', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const ander = String(req.body.toKey || '');
  if (isGeblokkeerd(req.session.key, ander)) return res.status(403).json({ error: 'Dit contact is niet beschikbaar.' });
  const c = connectieTussen(req.session.key, ander);
  if (!verbActief(c)) return res.status(403).json({ error: 'Je bent nog niet verbonden met deze codenaam.' });
  const kind = String(req.body.kind || '');
  if (!['ring', 'accept', 'offer', 'answer', 'ice', 'hangup', 'decline', 'busy'].includes(kind))
    return res.status(400).json({ error: 'Onbekend signaal.' });
  sseToCustomer(ander, 'call', {
    kind, from: req.session.key, codename: liveCodename(req.session),
    video: !!req.body.video, payload: req.body.payload || null
  });
  res.json({ ok: true });
});

/* ---------- snaps en verhalen: RTG-kant (auth) ---------- */
app.post('/api/member/snap/send', express.json({ limit: '1.5mb' }), auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const r = await snapSturen(req.session.key, String(req.body.toKey || ''), req.body.foto, req.body.tekst);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, vuurtje: r.vuurtje || 0 });
});
app.post('/api/member/snaps', auth, (req, res) => { if (geenGast(req, res)) return; res.json({ snaps: snapsVoor(req.session.key) }); });
app.post('/api/member/snap/view', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const r = await snapOpenen(req.session.key, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ foto: r.foto, tekst: r.tekst, van: r.van });
});
app.post('/api/member/story/post', express.json({ limit: '1.5mb' }), auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const r = await verhaalPlaatsen(req.session.key, req.body.foto, req.body.tekst, req.body.opdracht === true);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
});
// de snap-opdracht van vandaag (voor iedereen dezelfde)
app.post('/api/member/snap/opdracht', auth, (req, res) => { res.json({ opdracht: dagOpdracht() }); });
app.post('/api/member/stories', auth, (req, res) => { if (geenGast(req, res)) return; res.json({ stories: verhalenVoor(req.session.key) }); });
app.post('/api/member/story/view', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const r = await verhaalBekijken(req.session.key, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ foto: r.foto, tekst: r.tekst, van: r.van, at: r.at });
});

};
