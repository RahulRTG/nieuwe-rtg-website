/* Domein "rtgkantoor": het RTG Kantoor met de eigen RTG AI. Alles achter de
   office-inlog. De AI zelf heeft hier maar vier knoppen nodig: status zien,
   een trainingsronde afdwingen (handig voor demo's), het roer geven en het
   roer terugnemen. Het roer geven kan ALLEEN hier, door een mens. */
module.exports = (kern) => {
  const { app, officeAuth, rtgai, onderzoeker } = kern;
  const wie = req => (req.actor && req.actor.name) || 'het kantoor';
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };

  app.post('/api/office/rtgai', officeAuth, (req, res) => res.json(rtgai.status()));
  app.post('/api/office/rtgai/train', officeAuth, (req, res) => res.json(rtgai.train(wie(req))));
  app.post('/api/office/rtgai/roer/geef', officeAuth, (req, res) => stuur(res, rtgai.roerGeef(wie(req))));
  app.post('/api/office/rtgai/roer/terug', officeAuth, (req, res) => stuur(res, rtgai.roerTerug(wie(req))));

  /* De tweede AI: de Onderzoeker. De RTG AI bouwt hem (de knop laat een
     bouwstap doen); daarna onderzoekt hij agentisch en adviseert alleen. */
  app.post('/api/office/onderzoeker', officeAuth, (req, res) => res.json(onderzoeker.status()));
  app.post('/api/office/onderzoeker/ontwikkel', officeAuth, (req, res) => stuur(res, onderzoeker.ontwikkel()));
  app.post('/api/office/onderzoeker/onderzoek', officeAuth, async (req, res) => {
    try { stuur(res, await onderzoeker.onderzoek(req.body.vraag)); }
    catch (e) { res.status(500).json({ error: 'Het onderzoek liep vast. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/onderzoeker/rapport', officeAuth, (req, res) => stuur(res, onderzoeker.rapport(req.body.id)));
};
