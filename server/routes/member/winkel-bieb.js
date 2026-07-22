/* Domein "member", deel van winkel: de koop- en bibliotheek-ingangen van de
   RTG Mall (Food Court, de Mall zelf en het eigen-merk, plus de App-, Reis- en
   RTF-Bibliotheek). Apart gehouden zodat winkel.js klein blijft; alleen routes,
   de logica woont in de kern-modules. */
module.exports = (kern) => {
  const { app, auth, foodcourt, mall, appbieb, reisbieb, rtfbieb } = kern;

  /* Het toegangsmodel van de echte RTG Bibliotheek: BLADEREN is voor iedereen
     zichtbaar (ook de aangemelde gratis gast). Installeren uit de
     App-Bibliotheek is een pas-voordeel voor betalende leden; het
     Reis-gedeelte en de RTF-Bibliotheek zijn ook voor de gast volledig open. */
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Installeren uit de App-Bibliotheek is voor betalende leden. Word lid en alles is inbegrepen; het Reis-gedeelte en de RTF-bieb zijn ook voor jou al open.' }); return true; }
    return false;
  };

  /* ---- de RTG Food Court: alle restaurants op een rij, reserveren met tijdsloten ---- */
  app.post('/api/foodcourt', auth, (req, res) => res.json(foodcourt.overzicht()));
  // de vrije tijdsloten voor een restaurant op een datum en gezelschap; reserveren
  // gaat via het bestaande /api/reserveer (de zaak beslist)
  app.post('/api/foodcourt/tijden', auth, (req, res) => {
    const r = foodcourt.tijden(String(req.body.code || ''), req.body.datum, req.body.personen);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  /* ---- de RTG Mall: de enige plek waar je bij RTG koopt ---- */
  app.post('/api/mall', auth, (req, res) => res.json(mall.overzicht()));
  // de catalogus van het RTG eigen-merk (hardware + de Hardwarelab-ontwerpen)
  app.post('/api/mall/eigen', auth, (req, res) => res.json(mall.eigenCatalogus()));
  // een lid bestelt een eigen-merk-product direct in de app
  app.post('/api/mall/bestel', auth, (req, res) => {
    const r = mall.memberBestel(req.body || {});
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  // de catalogus van een boerderij op de etage "Van het land"
  app.post('/api/mall/land', auth, (req, res) => {
    const r = mall.farmCatalogus(String(req.body.code || ''));
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  // een lid bestelt een boerderijproduct direct; de voorraad daalt
  app.post('/api/mall/land-bestel', auth, (req, res) => {
    const r = mall.memberBestelFarm(req.body || {});
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  /* ---- de App-Bibliotheek: 20.000 professionele apps. Bladeren is voor
     iedereen zichtbaar; installeren is het pas-voordeel van betalende leden. ---- */
  app.post('/api/mall/apps', auth, (req, res) => res.json(appbieb.overzicht()));
  // bladeren en zoeken (gepagineerd; de catalogus wordt ter plekke samengesteld)
  app.post('/api/mall/apps/catalogus', auth, (req, res) => res.json(appbieb.catalogus(req.body || {})));
  // installeren en verwijderen: het lid beslist, de pas dekt de prijs (0)
  app.post('/api/mall/apps/installeer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const r = appbieb.installeer(req.session.key, req.body.id);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/mall/apps/weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const r = appbieb.verwijder(req.session.key, req.body.id);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  // mijn geïnstalleerde apps (voor de gast gewoon leeg)
  app.post('/api/mall/apps/mijn', auth, (req, res) => res.json({ apps: appbieb.mijnApps(req.session.key) }));

  /* ---- de Reis-Bibliotheek: een miljoen reisgidsen van Londen tot Gaza.
     Volledig open voor iedereen die is aangemeld, ook de gratis gast. ---- */
  app.post('/api/mall/reis', auth, (req, res) => res.json(reisbieb.overzicht()));
  app.post('/api/mall/reis/catalogus', auth, (req, res) => res.json(reisbieb.catalogus(req.body || {})));
  app.post('/api/mall/reis/installeer', auth, (req, res) => {
    const r = reisbieb.installeer(req.session.key, req.body.id);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/mall/reis/weg', auth, (req, res) => {
    const r = reisbieb.verwijder(req.session.key, req.body.id);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/mall/reis/mijn', auth, (req, res) => res.json({ apps: reisbieb.mijnApps(req.session.key) }));

  /* ---- de RTF-Bibliotheek in de Mall: dezelfde 20.000 gratis kind- en
     gezinsapps als in de foundation, volledig open voor iedereen die is
     aangemeld (ook de gast). Installaties staan los van de gezinsprofielen. ---- */
  const rtfSleutel = req => 'mall:' + req.session.key;
  app.post('/api/mall/rtf', auth, (req, res) => res.json(rtfbieb.overzicht('volw')));
  app.post('/api/mall/rtf/catalogus', auth, (req, res) => res.json(rtfbieb.catalogus('volw', req.body || {})));
  app.post('/api/mall/rtf/installeer', auth, (req, res) => {
    const r = rtfbieb.installeer(rtfSleutel(req), 'volw', req.body.id);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/mall/rtf/weg', auth, (req, res) => {
    const r = rtfbieb.verwijder(rtfSleutel(req), req.body.id);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/mall/rtf/mijn', auth, (req, res) => res.json({ apps: rtfbieb.mijnApps(rtfSleutel(req)) }));
};
