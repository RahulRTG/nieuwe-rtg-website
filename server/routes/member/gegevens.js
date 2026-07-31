/* Routes "gegevens": Rahul vraagt in een gesprek wat er voor een handeling met een
   DERDE PARTIJ nodig is (kern/gegevenspoort.js + kern/gegevensgesprek.js).

   De app komt hier terecht nadat een bestelling of reservering een 428 gaf met
   `ontbreekt`: die 428 zegt "dit mag, maar er moet eerst iets gebeuren". Daarna
   loopt het gesprek, en als het rond is doet de app de oorspronkelijke handeling
   gewoon opnieuw. */
module.exports = (kern) => {
  const { app, auth, gegevensNodig, gegevensStart, gegevensZeg } = kern;

  // Wat mist er voor deze soort handeling? (De app kan dit vooraf vragen zodat
  // ze het gesprek al opent voordat iemand op "bestellen" drukt.)
  app.post('/api/gegevens/nodig', auth, (req, res) => {
    res.json({ ok: true, ontbreekt: gegevensNodig(req.session, req.body.soort) });
  });

  app.post('/api/gegevens/start', auth, (req, res) => {
    const r = gegevensStart(req.session, req.body.soort);
    res.status(r.status || 200).json(r);
  });

  app.post('/api/gegevens/zeg', auth, (req, res) => {
    const r = gegevensZeg(req.session, req.body.id, req.body.tekst);
    res.status(r.status || 200).json(r);
  });
};
