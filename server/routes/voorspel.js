/* Routes "voorspel": de voorspeller (kern/voorspel.js) voor de twee
   werelden. Het lid ziet wat RTG verwacht dat hij nodig heeft (en kan het
   met een tik door Rahul laten regelen); de zaak ziet wat er morgen
   waarschijnlijk komt. Beide paden staan ook op de kaart van het AI-stuur,
   dus Rahul kan ze zelf raadplegen tijdens een gesprek. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, liveCodename, voorspel } = kern;

  app.post('/api/voorspel', auth, (req, res) => {
    res.json(voorspel.voorLid(liveCodename(req.session), req.session.key));
  });

  app.post('/api/supplier/voorspel', supplierAuth, (req, res) => {
    res.json(voorspel.voorZaak(req.supplier.code));
  });

  // de werkvloer kijkt mee: dezelfde morgen-verwachting op de PDA, zodat
  // het team de piek ziet aankomen in plaats van erdoor overvallen te worden
  app.post('/api/staff/voorspel', supplierAuth, (req, res) => {
    res.json(voorspel.voorZaak(req.supplier.code));
  });
};
