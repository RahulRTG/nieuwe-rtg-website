/* Rahul Bijles voor leden: dunne routes op kern/bijles.js. Het niveau komt
   rechtstreeks uit het leerpaspoort (kern/onderwijs.js) en de laatst behaalde
   leerdoelen reizen mee, zodat de bijles meegroeit van groep 1 tot en met een
   leven lang leren. */
module.exports = (kern) => {
  const { app, auth, bijles, onderwijs } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  function context(key) {
    const m = onderwijs.mijn(key);
    const niveau = m.fase ? m.fase.naam + (m.jaar > 1 ? ' (jaar ' + m.jaar + ')' : '') : null;
    return { niveau, doelen: Object.keys(m.doelen || {}).slice(-5) };
  }
  app.post('/api/bijles/vraag', auth, async (req, res) => {
    const c = context(req.session.key);
    stuur(res, await bijles.vraag({ sleutel: 'lid:' + req.session.key, naam: null,
      niveau: c.niveau, doelen: c.doelen, tekst: (req.body || {}).tekst }));
  });
  app.post('/api/bijles/gesprek', auth, (req, res) => stuur(res, bijles.gesprek('lid:' + req.session.key)));
};
