/* Routes "toestellen": koppelen, intrekken en de schrijfdeur voor het toestel
   zelf (kern/toestellen.js).

   TWEE SOORTEN DEUREN, en het verschil is de hele opzet. De eerste drie routes
   zijn voor het LID en zitten achter de gewone ledenwacht. De laatste is voor
   het TOESTEL en zit achter zijn eigen sleutel in een eigen kop: die deur kent
   geen sessie, geen lid en geen ander onderwerp dan een dagmeting.

   De sleutel staat bewust NIET in de Authorization-kop. Die kop hoort in dit
   huis bij sessies; een toestel heeft er geen, en hem daar toch in leggen zou
   betekenen dat elke lezer van die kop een tweede soort ding moet kennen. */
module.exports = (kern) => {
  const { app, auth, toestellenVan, toestelKoppel, toestelIntrek, toestelVanSleutel, toestelMeting } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };

  app.post('/api/toestellen', auth, (req, res) => stuur(res, toestellenVan(req.session.key)));
  app.post('/api/toestellen/koppel', auth, (req, res) => stuur(res, toestelKoppel(req.session.key, req.body || {})));
  app.post('/api/toestellen/intrek', auth, (req, res) => stuur(res, toestelIntrek(req.session.key, req.body || {})));

  /* De schrijfdeur van het toestel. Voor WIE er geschreven wordt volgt uit de
     sleutel en staat niet in het verzoek; een toestel kan dus alleen bij het lid
     dat hem heeft gekoppeld. Een ingetrokken sleutel is meteen niets meer waard,
     want toestelVanSleutel kijkt alleen naar actieve toestellen. */
  app.post('/api/toestel/meting', (req, res) => {
    const toestel = toestelVanSleutel(req.get('x-rtg-toestel'));
    if (!toestel) return res.status(401).json({ error: 'Geen geldige toestelsleutel.' });
    stuur(res, toestelMeting(toestel, req.body || {}));
  });
};
