/* Routes "gegevenskaart": wat weet RTG van mij (kern/identiteit/gegevenskaart.js).

   Een route, en met opzet geen tweede. Deze laag SCHRIJFT niets: weghalen doe je
   waar het gegeven woont -- het adres in de gegevenspoort, de sessie in het
   sessieregister, de post in het toestemmingsscherm. Zou hier een wisknop
   komen, dan bestond er van elk gegeven twee plekken om het weg te halen, en
   dan is er binnen een jaar een die het net iets anders doet.

   Gasten hebben geen kaart, om dezelfde reden als bij de inzagekaart: er is
   geen ledendossier om over te rapporteren, en een lege kaart tonen zou lezen
   als "RTG weet niets van u" terwijl er domweg geen account is. */
module.exports = (kern) => {
  const { app, auth, gegevenskaart } = kern;

  app.post('/api/mijn/gegevens', auth, (req, res) => {
    if (req.session.tier === 'guest') {
      return res.status(403).json({ error: 'Een gegevenskaart hoort bij een ledendossier; gasten hebben er geen.' });
    }
    res.json(gegevenskaart.kaartVan(req.session.key, req.session.account));
  });
};
