/* Routes voor de Website-studio van het RTG Atelier. Achter de kantoor-inlog
   (officeAuth): het ontwerpbureau bewaart, opent, lijst en verwijdert zijn
   eigen website-sjablonen. Losstaand van de echte site. */
module.exports = (kern) => {
  const { app, officeAuth, atelierweb } = kern;

  app.post('/api/office/atelierweb/lijst', officeAuth, (req, res) => {
    res.json({ lijst: atelierweb.lijst() });
  });
  app.post('/api/office/atelierweb/haal', officeAuth, (req, res) => {
    const d = atelierweb.haal((req.body || {}).id);
    if (!d) return res.status(404).json({ error: 'Sjabloon niet gevonden.' });
    res.json({ design: d });
  });
  app.post('/api/office/atelierweb/bewaar', officeAuth, (req, res) => {
    const b = req.body || {};
    const design = atelierweb.bewaar(b.design || b);
    res.json({ ok: true, design });
  });
  app.post('/api/office/atelierweb/verwijder', officeAuth, (req, res) => {
    res.json(atelierweb.verwijder((req.body || {}).id));
  });
};
