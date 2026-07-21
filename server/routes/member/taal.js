/* Member-submodule: de moedertaal van het account. Iedereen praat op het
   platform in de eigen taal en de ander leest alles in de zijne: deze vaste
   taal (uit de actieve wereldtalen van de Boardroom) is waarnaar de
   vriendenchat en de andere leespaden voor dit account vertalen, en de taal
   die aan elk verstuurd bericht wordt meegegeven als brontaal.
   Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, db, save, talen } = kern;

  app.post('/api/member/taal', auth, (req, res) =>
    res.json({ ok: true, taal: (db.data.memberTaal || {})[req.session.key] || null, talen: talen.actieve() }));

  app.post('/api/member/taal/zet', auth, (req, res) => {
    const code = String((req.body || {}).code || '').toLowerCase();
    if (!talen.isActief(code)) return res.status(400).json({ error: 'Kies een actieve taal; de Boardroom bepaalt welke wereldtalen aanstaan.' });
    db.data.memberTaal = db.data.memberTaal || {};
    db.data.memberTaal[req.session.key] = code;
    save();
    res.json({ ok: true, taal: code });
  });
};
