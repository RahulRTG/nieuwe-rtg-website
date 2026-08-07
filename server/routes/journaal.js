/* Route voor het doorgeefjournaal: lezen wat er binnenkwam en wat de deur
   uitging. Achter de boardroom-poort, om twee redenen. Het journaal laat zien
   welke ingangen bestaan en hoe vaak ze falen -- dat is een kaart van het huis
   die niet bij een gedeelde kantoorcode hoort. En een gedeelde code wijst
   niemand aan, terwijl meekijken met het verkeer iets is waarvan je hoort te
   weten wie het deed. Zelfde redenering als bij het ledenregister. */
module.exports = (kern) => {
  const { app, boardroomAuth, journaalLees, journaalBeeld } = kern;

  app.post('/api/office/journaal', boardroomAuth, (req, res) => {
    const b = req.body || {};
    try {
      res.json(journaalLees({
        bron: b.bron === 'bewaard' ? 'bewaard' : 'venster',
        richting: b.richting === 'in' || b.richting === 'uit' ? b.richting : null,
        alleenMislukt: !!b.alleenMislukt,
        zoek: typeof b.zoek === 'string' ? b.zoek.slice(0, 60) : null,
        max: b.max
      }));
    } catch (e) {
      console.error('[journaal]', e);
      res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
    }
  });

  /* De samenvatting apart, zodat een scherm elke paar seconden kan kijken of er
     iets speelt zonder de hele lijst op te halen. Het getal dat telt is
     "mislukt": daar begint elk onderzoek. */
  app.post('/api/office/journaal/beeld', boardroomAuth, (req, res) => {
    try { res.json(journaalBeeld()); }
    catch (e) { console.error('[journaal]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
