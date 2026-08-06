/* Sociale laag RTF (deelmodule): het live-kanaal, bellen, blokkeren en
   melden, en het ouder-toezicht op kindcontacten en het kind-boardroom.
   Gemount vanuit routes/social/gezinnen.js op de gedeelde context. */
module.exports = (sctx) => {
  const { kern, isKindVanGezin, rtfOnbSess, rtfSociaal } = sctx;
  const { app, auth, geenGast, rtf, connectieTussen, verbActief, sseToCustomer, sseClients, sseSend, speelOpnieuw, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, kindContacten, kindVerwijder } = kern;
  const { lidBoard, lidBoardZet, lidBoardZetVeel, lidBoardHerstel, lidBoardLog } = kern.lidboard;
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

/* Ouderlijk beheer: de beheerder bekijkt en stuurt de boardroom van zijn
   beschermde kind bij. Dezelfde functie-motor als het lid zelf gebruikt, met de
   RTF-handle van het kind als sleutel. De voogd-check bewaakt dat het echt zijn
   kind is; kind:true laat de functies weg die niet bij een kind horen.

   Wat een ouder omzet, komt in het journaal van het kind te staan met door:
   'ouder'. Een kind dat later vraagt "waarom kan ik dit niet?" hoort dat te
   kunnen zien; een instelling die van buitenaf is gezet zonder spoor is precies
   het soort stille voogdij dat we niet willen bouwen. */
const kindOpts = (req) => ({ kind: true, door: 'ouder', bron: 'ouderlijk beheer', versie: req.body.versie });

app.post('/api/rtf/social/kind/boardroom', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  if (!s.beheerder) return res.status(403).json({ error: 'Alleen een ouder/beheerder kan de boardroom van een kind beheren.' });
  const kindHandle = String(req.body.kindHandle || '');
  if (!isKindVanGezin(s.g.code, kindHandle)) return res.status(403).json({ error: 'Dit is geen kind van jouw gezin.' });
  res.json({ bord: lidBoard(kindHandle, { kind: true }), logboek: lidBoardLog(kindHandle, 20) });
});
app.post('/api/rtf/social/kind/boardroom/zet', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  if (!s.beheerder) return res.status(403).json({ error: 'Alleen een ouder/beheerder kan dit.' });
  const kindHandle = String(req.body.kindHandle || '');
  if (!isKindVanGezin(s.g.code, kindHandle)) return res.status(403).json({ error: 'Dit is geen kind van jouw gezin.' });
  const r = lidBoardZet(kindHandle, String(req.body.id || ''), req.body.aan !== false, kindOpts(req));
  res.status(r.status).json(r);
});
// Een set in een keer, en terug naar de standaard: dezelfde motor, dezelfde
// voogd-check. Zonder deze twee moet een ouder twintig verzoeken doen.
app.post('/api/rtf/social/kind/boardroom/zetveel', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  if (!s.beheerder) return res.status(403).json({ error: 'Alleen een ouder/beheerder kan dit.' });
  const kindHandle = String(req.body.kindHandle || '');
  if (!isKindVanGezin(s.g.code, kindHandle)) return res.status(403).json({ error: 'Dit is geen kind van jouw gezin.' });
  const r = lidBoardZetVeel(kindHandle, req.body.standen, kindOpts(req));
  res.status(r.status).json(r);
});
app.post('/api/rtf/social/kind/boardroom/herstel', (req, res) => {
  const s = rtfSociaal(req, res); if (!s) return;
  if (!s.beheerder) return res.status(403).json({ error: 'Alleen een ouder/beheerder kan dit.' });
  const kindHandle = String(req.body.kindHandle || '');
  if (!isKindVanGezin(s.g.code, kindHandle)) return res.status(403).json({ error: 'Dit is geen kind van jouw gezin.' });
  const r = lidBoardHerstel(kindHandle, kindOpts(req));
  res.status(r.status).json(r);
});
};
