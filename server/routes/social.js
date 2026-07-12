/* Sociale laag (aparte module, draait op de gedeelde kern): de vriendenlaag
   over RTG en RTFoundation, plus snaps, 24-uurs verhalen en het bellen.
   Praat alleen via de kern met de gedeelde data en realtime, zodat dit domein
   later als een eigen proces kan draaien zonder de routes aan te passen. */
module.exports = (kern) => {
  const { app, express, auth, geenGast, db, save, rtf, webpush, socialZoek, socialVerbind, socialAntwoord, socialConnecties, socialDm, socialDmSend, socialGoedkeur, socialTeKeuren, liveCodename, connectieTussen, verbActief, dmSleutel, codenaamVan, sseToCustomer, sseClients, sseSend, snapSturen, snapsVoor, snapOpenen, verhaalPlaatsen, verhalenVoor, verhaalBekijken, speelOpnieuw, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, kindContacten, kindVerwijder } = kern;

// leden en RTF-gezinsleden zoeken op codenaam (nooit op echte naam)
app.post('/api/member/find', auth, (req, res) => {
  if (geenGast(req, res)) return;
  res.json({ results: socialZoek(req.session.key, req.body.q) });
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

// gesprek ophalen (en als gelezen markeren)
app.post('/api/member/dm', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const ander = String(req.body.withKey || '');
  const c = connectieTussen(req.session.key, ander);
  if (!verbActief(c)) return res.status(403).json({ error: 'Je bent nog niet verbonden met deze codenaam.' });
  const k = dmSleutel(req.session.key, ander);
  const chat = db.data.memberChats[k] = db.data.memberChats[k] || { messages: [], read: {} };
  chat.read[req.session.key] = new Date().toISOString();
  save();
  res.json({ messages: chat.messages.slice(-80), codename: codenaamVan(ander) });
});

// bericht sturen; optioneel met een gedeelde Salon-post erbij
app.post('/api/member/dm/send', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const ander = String(req.body.toKey || '');
  const c = connectieTussen(req.session.key, ander);
  if (!verbActief(c)) return res.status(403).json({ error: 'Je bent nog niet verbonden met deze codenaam.' });
  const text = String(req.body.text || '').slice(0, 500).trim();
  let postDeel = null;
  if (req.body.postId != null) {
    const p = db.data.posts.find(x => x.id === Number(req.body.postId));
    if (p) postDeel = { id: p.id, author: p.author, place: p.place, text: String(p.text || '').slice(0, 120), photo: p.photo || null };
  }
  if (!text && !postDeel) return res.status(400).json({ error: 'Leeg bericht.' });
  const k = dmSleutel(req.session.key, ander);
  const chat = db.data.memberChats[k] = db.data.memberChats[k] || { messages: [], read: {} };
  const msg = { from: req.session.key, text, post: postDeel, at: new Date().toISOString() };
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
app.post('/api/member/snap/send', express.json({ limit: '1.5mb' }), auth, (req, res) => {
  if (geenGast(req, res)) return;
  const r = snapSturen(req.session.key, String(req.body.toKey || ''), req.body.foto, req.body.tekst);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
});
app.post('/api/member/snaps', auth, (req, res) => { if (geenGast(req, res)) return; res.json({ snaps: snapsVoor(req.session.key) }); });
app.post('/api/member/snap/view', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const r = snapOpenen(req.session.key, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ foto: r.foto, tekst: r.tekst, van: r.van });
});
app.post('/api/member/story/post', express.json({ limit: '1.5mb' }), auth, (req, res) => {
  if (geenGast(req, res)) return;
  const r = verhaalPlaatsen(req.session.key, req.body.foto, req.body.tekst);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
});
app.post('/api/member/stories', auth, (req, res) => { if (geenGast(req, res)) return; res.json({ stories: verhalenVoor(req.session.key) }); });
app.post('/api/member/story/view', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const r = verhaalBekijken(req.session.key, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ foto: r.foto, tekst: r.tekst, van: r.van, at: r.at });
});

/* ---------- vriendenlaag en snaps: RTFoundation-kant (gezin-token) ----------
   Een gezinslid (geen gast) doet mee met dezelfde vriendenlaag als de RTG-app,
   zodat RTF en RTG elkaar op codenaam vinden, chatten, snappen en verhalen delen.
   Kinderen hebben ouderakkoord nodig. */
function rtfSociaal(req, res) {
  const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
  if (!sess) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
  if (sess.gast) { res.status(403).json({ error: 'Als oppas of familielid doe je hier niet mee.' }); return null; }
  return sess;
}
app.post('/api/rtf/social/find', (req, res) => { const s = rtfSociaal(req, res); if (!s) return; res.json({ results: socialZoek(s.handle, req.body.q) }); });
app.post('/api/rtf/social/connect', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = socialVerbind(s.handle, String(req.body.key || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.st });
});
app.post('/api/rtf/social/respond', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = socialAntwoord(s.handle, String(req.body.key || ''), req.body.action);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.st });
});
app.post('/api/rtf/social/connections', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const sc = socialConnecties(s.handle);
  // beheerder: ook de kinderen van het gezin, zodat de ouder kan meekijken
  const kinderen = s.beheerder ? rtf.socialProfielen().filter(sp => sp.gezinCode === s.g.code && sp.kind).map(sp => ({ handle: sp.handle, codenaam: sp.codenaam })) : [];
  res.json({ me: s.handle, codename: s.codenaam, kind: s.kind, beheerder: s.beheerder, connections: sc.connections, requests: sc.requests, teKeuren: s.beheerder ? socialTeKeuren(s.g.code) : [], kinderen });
});
app.post('/api/rtf/social/dm', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = socialDm(s.handle, String(req.body.withKey || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ messages: r.messages, codename: r.codename });
});
app.post('/api/rtf/social/dm/send', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = socialDmSend(s.handle, String(req.body.toKey || ''), req.body.text);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, messages: r.messages });
});
app.post('/api/rtf/social/goedkeuren', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  if (!s.beheerder) return res.status(403).json({ error: 'Alleen een ouder/beheerder keurt vriendschappen goed.' });
  const r = socialGoedkeur(s.g.code, String(req.body.kindHandle || ''), String(req.body.anderKey || ''), req.body.akkoord !== false);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.st });
});
app.post('/api/rtf/social/snap/send', express.json({ limit: '1.5mb' }), (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = snapSturen(s.handle, String(req.body.toKey || ''), req.body.foto, req.body.tekst);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
});
app.post('/api/rtf/social/snaps', (req, res) => { const s = rtfSociaal(req, res); if (!s) return; res.json({ snaps: snapsVoor(s.handle) }); });
app.post('/api/rtf/social/snap/view', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = snapOpenen(s.handle, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ foto: r.foto, tekst: r.tekst, van: r.van });
});
app.post('/api/rtf/social/story/post', express.json({ limit: '1.5mb' }), (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = verhaalPlaatsen(s.handle, req.body.foto, req.body.tekst);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
});
app.post('/api/rtf/social/stories', (req, res) => { const s = rtfSociaal(req, res); if (!s) return; res.json({ stories: verhalenVoor(s.handle) }); });
app.post('/api/rtf/social/story/view', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const r = verhaalBekijken(s.handle, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ foto: r.foto, tekst: r.tekst, van: r.van, at: r.at });
});
/* Live-kanaal voor de RTF-vriendenlaag: net als /api/stream, maar op gezin-token.
   De verbinding staat in dezelfde sseClients-lijst, met de handle als sleutel, zodat
   dm-, snap-, verzoek- en belsignalen de RTF-app net zo bereiken als de RTG-app.
   EventSource kan geen header sturen, dus code en token gaan als query-parameter. */
app.get('/api/rtf/social/stream', (req, res) => {
  const sess = rtf.verifieerProfiel(req.query.code, req.query.token);
  if (!sess || sess.gast) return res.status(401).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
  res.write('retry: 3000\n\n');
  const client = { tier: 'rtf', key: sess.handle, res };
  sseClients.push(client);
  // gemiste persoonlijke events opnieuw afspelen na een verbroken verbinding
  const sinds = Number(req.headers['last-event-id'] || req.query.since || 0);
  if (sinds) speelOpnieuw(res, sess.handle, sinds);
  sseSend(res, 'hello', {});
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); const i = sseClients.indexOf(client); if (i >= 0) sseClients.splice(i, 1); });
});
/* Belsignaal vanuit de RTF-app naar een vriend (RTF of RTG). Zelfde WebRTC-flow
   als bij de leden; de server is alleen het signaleringskanaal. */
app.post('/api/rtf/social/call', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  const ander = String(req.body.toKey || '');
  if (isGeblokkeerd(s.handle, ander)) return res.status(403).json({ error: 'Dit contact is niet beschikbaar.' });
  if (!verbActief(connectieTussen(s.handle, ander))) return res.status(403).json({ error: 'Je bent nog niet verbonden met deze codenaam.' });
  const kind = String(req.body.kind || '');
  if (!['ring', 'accept', 'offer', 'answer', 'ice', 'hangup', 'decline', 'busy'].includes(kind))
    return res.status(400).json({ error: 'Onbekend signaal.' });
  sseToCustomer(ander, 'call', { kind, from: s.handle, codename: s.codenaam, video: !!req.body.video, payload: req.body.payload || null });
  res.json({ ok: true });
});

/* ---------- veiligheid: blokkeren, melden, ouder-meekijk ---------- */
// RTG-lid
app.post('/api/member/block', auth, (req, res) => { if (geenGast(req, res)) return; const r = blokkeer(req.session.key, String(req.body.key || '')); res.status(r.status).json(r); });
app.post('/api/member/unblock', auth, (req, res) => { if (geenGast(req, res)) return; const r = deblokkeer(req.session.key, String(req.body.key || '')); res.status(r.status).json(r); });
app.post('/api/member/report', auth, (req, res) => { if (geenGast(req, res)) return; const r = meldMisbruik(req.session.key, String(req.body.key || ''), req.body.reden); res.status(r.status).json(r); });
// RTF-gezinslid
app.post('/api/rtf/social/block', (req, res) => { const s = rtfSociaal(req, res); if (!s) return; const r = blokkeer(s.handle, String(req.body.key || '')); res.status(r.status).json(r); });
app.post('/api/rtf/social/unblock', (req, res) => { const s = rtfSociaal(req, res); if (!s) return; const r = deblokkeer(s.handle, String(req.body.key || '')); res.status(r.status).json(r); });
app.post('/api/rtf/social/report', (req, res) => { const s = rtfSociaal(req, res); if (!s) return; const r = meldMisbruik(s.handle, String(req.body.key || ''), req.body.reden); res.status(r.status).json(r); });
// ouder-meekijk: de contacten van een kind bekijken en er een verwijderen (alleen de beheerder)
app.post('/api/rtf/social/kind/contacten', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  if (!s.beheerder) return res.status(403).json({ error: 'Alleen een ouder/beheerder kan meekijken.' });
  const r = kindContacten(s.g.code, String(req.body.kindHandle || ''));
  res.status(r.status).json(r.error ? { error: r.error } : { contacten: r.contacten });
});
app.post('/api/rtf/social/kind/verwijder', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  if (!s.beheerder) return res.status(403).json({ error: 'Alleen een ouder/beheerder kan dit.' });
  const r = kindVerwijder(s.g.code, String(req.body.kindHandle || ''), String(req.body.anderKey || ''));
  res.status(r.status).json(r);
});

// web-push: publieke sleutel + subscription opslaan
app.get('/api/push/key', (req, res) => {
  res.json({ key: webpush && db.data.vapid ? db.data.vapid.publicKey : null });
});

/* ICE-servers voor WebRTC-bellen (leden onderling en de RTFoundation-gezinnen).
   STUN werkt voor de meeste verbindingen; achter een streng mobiel netwerk
   (symmetrische NAT) is een TURN-server nodig om het beeld er altijd doorheen te
   krijgen. Zet die aan met de omgevingsvariabelen TURN_URL/TURN_USER/TURN_PASS.
   Zie docs/turn-server.md voor de volledige productie-opzet. */
function iceServers() {
  const list = [{ urls: (process.env.STUN_URL || 'stun:stun.l.google.com:19302').split(',').map(s => s.trim()) }];
  if (process.env.TURN_URL && process.env.TURN_USER && process.env.TURN_PASS) {
    list.push({ urls: process.env.TURN_URL.split(',').map(s => s.trim()), username: process.env.TURN_USER, credential: process.env.TURN_PASS });
  }
  return list;
}
app.get('/api/ice', (req, res) => res.json({ iceServers: iceServers() }));
};
