/* Member-submodule: de wauw-laag (kern/wauw.js) -- de dag-stemming die overal
   naast je codenaam meereist, en De Terugblik op je sociale week. Gemount
   vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, geenGast, wauwStemmingZet, stemmingVan, STEMMINGEN, wauwTerugblik } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/member/wauw/stemming', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json({ ok: true, stemming: stemmingVan(req.session.key), keuzes: STEMMINGEN });
  });
  app.post('/api/member/wauw/stemming/zet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, wauwStemmingZet(req.session.key, String((req.body || {}).emoji ?? '')));
  });
  app.post('/api/member/wauw/terugblik', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, wauwTerugblik(req.session.key));
  });
};
