/* RTG Boeken: dunne routes op kern/boeken.js -- de huisbibliotheek, een
   boek lezen en de leesvoortgang die met je account meereist. Altijd-aan
   gemount; via de stuur-laag ook voor Rahul bereikbaar ("waar was ik in
   De haas en de schildpad?"). */
module.exports = (kern) => {
  const { app, auth, boeken } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/boeken/bieb', auth, (req, res) => stuur(res, boeken.boekenBieb()));
  app.post('/api/boeken/boek', auth, (req, res) => stuur(res, boeken.boekenBoek((req.body || {}).id)));
  app.post('/api/boeken/voortgang', auth, (req, res) => stuur(res, boeken.boekenVoortgang(req.session.key)));
  app.post('/api/boeken/lees', auth, (req, res) => stuur(res, boeken.boekenLees(req.session.key, req.body || {})));
};
