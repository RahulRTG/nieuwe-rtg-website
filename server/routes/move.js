/* Domein "move": RTG Move -- de bewegingslaag over een reis. Drie vragen die
   nergens anders te stellen waren: haal ik het, wat breekt er als iets
   verschuift, en waar moet ik nu naartoe.

   ALLE DRIE ZIJN LEZEND. Er is met opzet geen route die een transfer verzet of
   een reservering wijzigt: dat raakt een tweede persoon en gebeurt in het
   domein zelf, na een bevestiging door een mens (LIFE.md par. 4, REIZEN.md par.
   4.5). Move levert het voorstel met `uitgevoerd: false` en het adres van de app
   waar het echte werk hoort; drukken doet de reiziger.

   Achter de gewone leden-inlog en niet voor een gast: een gast heeft geen reis
   om te wegen. */
module.exports = (kern) => {
  const { app, auth, move } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG Move is voor leden.' }); return true; }
    return false;
  };

  /* Haal ik mijn reis? Per overgang het oordeel, en altijd de DEKKING erbij --
     over welk deel van de reis Move iets kon zeggen. Zonder dat getal is een
     groen oordeel over een half gemeten reis een geruststelling zonder grond. */
  app.post('/api/move/reis', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, move.reis(req.session.key));
  });

  /* Er schuift iets op: wat betekent dat verder in de reis? De minuten komen
     van de aanroeper (een vervoerder die het meldt, een lid dat het invult) en
     worden nooit geraden -- zelfde grens als kern/mobiliteit/storing.js. */
  app.post('/api/move/gevolg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, move.gevolg(req.session.key, req.body || {}));
  });

  /* De volgende beweging, voor de Continue Key. Weet Move het niet, dan komt er
     `null` terug met de reden -- en houdt het scherm zijn gewone vraag. Een
     Continue Key die een bestemming raadt, stuurt iemand met een tik naar de
     verkeerde stad. */
  app.post('/api/move/volgende', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, move.volgende(req.session.key));
  });
};
