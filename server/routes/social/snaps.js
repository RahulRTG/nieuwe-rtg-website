/* Sociale laag (deelmodule): snaps en 24-uurs verhalen aan de RTG-ledenkant.
   Stond in ./leden.js en is daar op de 10 kB-grens uitgeknipt toen het
   mediastuk-delen dat bestand eroverheen duwde; snaps en verhalen zijn een
   eigen onderwerp met eigen kernhelpers, dus de knip valt hier op een naad
   en niet dwars door een route. Gemount vanuit routes/social.js. */
module.exports = (sctx) => {
  const { kern } = sctx;
  const { app, express, auth, geenGast, snapSturen, snapsVoor, snapOpenen,
          verhaalPlaatsen, verhalenVoor, verhaalBekijken, dagOpdracht } = kern;

app.post('/api/member/snap/send', express.json({ limit: '1.5mb' }), auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const r = await snapSturen(req.session.key, String(req.body.toKey || ''), req.body.foto, req.body.tekst);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
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
