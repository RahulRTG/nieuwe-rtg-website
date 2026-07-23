/* Domein "navigatie": RTG Navigatie, het huiseigen navigatiesysteem. De route
   komt uit ons eigen wegennet (A*), de bestemmingen uit onze leveranciers, het
   OV, de loketten en de POI-lagen (tank/laad); onderweg schuift RTG Flits erin.
   Achter de gewone leden-inlog; chauffeurs gebruiken dezelfde functies via de
   PDA-inlog. Op codenaam, geen externe kaartdienst. */
module.exports = (kern) => {
  const { app, auth, liveCodename, navBestemmingen, navRoute, navPoi, navKaart, navMeld } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG Navigatie is voor leden.' }); return true; }
    return false;
  };
  const hier = b => (b && b.lat != null ? { lat: b.lat, lng: b.lng, land: b.land } : null);

  // de kaart voor de 3D-app: net-definitie + alle koppelpunten
  app.post('/api/nav/kaart', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, navKaart(hier(req.body)));
  });
  // bestemmingen zoeken over alle eigen bronnen (leverancier/OV/loket/tank/laad)
  app.post('/api/nav/bestemmingen', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, navBestemmingen(req.body && req.body.q, hier(req.body)));
  });
  // de route: snelste weg + bocht-voor-bocht + ETA per vervoerwijze + langs de route
  app.post('/api/nav/route', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    stuur(res, navRoute({ van: b.van, naar: b.naar, modus: b.modus }));
  });
  // POI-lagen rond een punt (incl. flits via de Flits-laag)
  app.post('/api/nav/poi', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    stuur(res, navPoi(b.lagen, hier(b)));
  });
  // een wegprobleem melden: terug het Flits-netwerk in (op codenaam)
  app.post('/api/nav/meld', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, navMeld(req.session.key, liveCodename(req.session), req.body || {}));
  });
};
