/* RTG Rugdekking (kern/rugdekking/): wat een lid over zijn eigen programma ziet.

   Alleen de LEZENDE kant staat hier. Rugdekking toekennen en de schakelaar van
   de beurs omzetten doet het kantoor, en die routes staan in
   routes/office/rugdekking.js -- dit domein kan niet bij kluisAuth, en dat is
   de bedoeling: een mens kent zichzelf geen rugdekking toe. */
module.exports = (kern) => {
  const { app, rugdekking, auth } = kern;
  const stuur = (res, r) => (r && r.error)
    ? res.status(r.status || 400).json({ error: r.error })
    : res.json(r);

  app.post('/api/rugdekking/lijst', auth, (req, res) => stuur(res, rugdekking.lijst()));

  app.post('/api/rugdekking/mijn', auth, (req, res) => {
    if (!req.session.key) return res.status(403).json({ error: 'Dit is voor leden met een eigen account.' });
    stuur(res, rugdekking.mijn(req.session.key));
  });
};
