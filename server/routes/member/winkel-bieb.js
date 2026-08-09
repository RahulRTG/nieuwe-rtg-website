/* Domein "member", deel van winkel: de koop- en bibliotheek-ingangen van de
   RTG Mall (Food Court, de Mall zelf en het eigen-merk, plus de App-, Reis- en
   RTF-Bibliotheek). Apart gehouden zodat winkel.js klein blijft; alleen routes,
   de logica woont in de kern-modules. */
module.exports = (kern) => {
  const { app, auth, foodcourt, mall, appbieb, reisbieb, rtfbieb, gegevensStop, liveCodename } = kern;

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

  /* ---- de RTG Mall als commerciele voorkant van heel RTG ----
     Drie ingangen boven op de bestaande etages: waar sta je (plekken), wat
     staat daar (home) en wat zoek je (zoek). De zoekroute gaat dwars door
     alle domeinen heen -- reizen, verblijven, eten, retail, diensten,
     vervoer, marktplaats -- en is een LEESLAAG: er wordt hier niets besteld
     of geboekt, de knop wijst naar de plek waar dat al gebeurt. Vandaar geen
     gegevenspoort op deze drie: er gaat geen enkel gegeven naar een derde. */
  app.post('/api/mall/plekken', auth, (req, res) => res.json(mall.mallPlekken()));
  app.post('/api/mall/home', auth, (req, res) => res.json(mall.mallHome({
    plek: req.body.plek, punt: req.body.punt
  })));
  app.post('/api/mall/zoek', auth, (req, res) => res.json(mall.mallZoek({
    q: String(req.body.q || '').slice(0, 120),
    plek: req.body.plek, punt: req.body.punt,
    verdieping: req.body.verdieping, type: req.body.type, aanbieder: req.body.aanbieder,
    maxPrijs: req.body.maxPrijs, binnenKm: req.body.binnenKm,
    // de live stand uit de Supplier OS: alleen wat nu open is / op voorraad ligt
    openNu: req.body.openNu === true, opVoorraad: req.body.opVoorraad === true,
    pagina: req.body.pagina, per: req.body.per,
    // dit is een mens die zoekt: tel de woorden mee voor het vraagbeeld
    noteer: true
  })));

  /* ---- bewaren en een reis bouwen ----
     Een verlanglijst en "voeg toe aan mijn reis" zijn hetzelfde ding met twee
     velden verschil; zie de kop van kern/mall/lijsten.js. Er wordt hier niets
     afgerekend: elke regel wijst naar de partij die hem levert. */
  const lijstStuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  app.post('/api/mall/lijsten', auth, (req, res) => res.json(mall.mallLijsten.mijn(req.session.key)));
  app.post('/api/mall/lijst/nieuw', auth, (req, res) => lijstStuur(res, mall.mallLijsten.maak(req.session.key, req.body || {})));
  app.post('/api/mall/lijst', auth, (req, res) => lijstStuur(res, mall.mallLijsten.toon(req.session.key, req.body.id)));
  app.post('/api/mall/lijst/zet', auth, (req, res) => lijstStuur(res, mall.mallLijsten.zet(req.session.key, req.body.id, req.body || {})));
  app.post('/api/mall/lijst/weg', auth, (req, res) => lijstStuur(res, mall.mallLijsten.weg(req.session.key, req.body.id)));
  app.post('/api/mall/lijst/voegtoe', auth, (req, res) => lijstStuur(res, mall.mallLijsten.voegToe(req.session.key, req.body.id, req.body.aanbodId)));
  app.post('/api/mall/lijst/regel-weg', auth, (req, res) => lijstStuur(res, mall.mallLijsten.haalWeg(req.session.key, req.body.id, req.body.aanbodId)));

  /* ---- de vraagkant: wat niemand aanbiedt, kun je vragen ----
     Alleen leden plaatsen een aanvraag: een open vraagmarkt voor iedereen die
     een gratis account maakt is binnen een week een prikbord met troep. */
  app.post('/api/mall/aanvraag', auth, (req, res) => {
    if (geenGast(req, res)) return;
    lijstStuur(res, mall.mallAanvragen.plaats(req.session.key, liveCodename(req.session), req.body || {}));
  });
  app.post('/api/mall/aanvragen/mijn', auth, (req, res) => res.json(mall.mallAanvragen.mijn(req.session.key)));
  app.post('/api/mall/aanvraag/sluit', auth, (req, res) => lijstStuur(res, mall.mallAanvragen.sluit(req.session.key, req.body.id)));
  app.post('/api/mall/aanvraag/kies', auth, (req, res) => lijstStuur(res, mall.mallAanvragen.kies(req.session.key, req.body.id, req.body.code)));

  /* ---- de RTG Mall: de enige plek waar je bij RTG koopt ---- */
  app.post('/api/mall', auth, (req, res) => res.json(mall.overzicht()));
  // de catalogus van het RTG eigen-merk (hardware + de Hardwarelab-ontwerpen)
  app.post('/api/mall/eigen', auth, (req, res) => res.json(mall.eigenCatalogus()));
  // een lid bestelt een eigen-merk-product direct in de app
  app.post('/api/mall/bestel', auth, (req, res) => {
    if (gegevensStop(req, res, 'bestelling')) return;
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
    if (gegevensStop(req, res, 'bestelling')) return;
    const r = mall.memberBestelFarm(req.body || {});
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  /* ---- de App-Bibliotheek: de echte RTG-apps van het ecosysteem. Bladeren is
     voor iedereen zichtbaar; op je startscherm zetten is het pas-voordeel van
     betalende leden. ---- */
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

  /* ---- de Reis-Bibliotheek: echte, leesbare bestemmingsgidsen van eigen
     redactie. Volledig open voor iedereen die is aangemeld, ook de gratis
     gast: bladeren, lezen en in je kast zetten. ---- */
  app.post('/api/mall/reis', auth, (req, res) => res.json(reisbieb.overzicht()));
  app.post('/api/mall/reis/catalogus', auth, (req, res) => res.json(reisbieb.catalogus(req.body || {})));
  // een gids echt lezen: de volledige tekst
  app.post('/api/mall/reis/lees', auth, (req, res) => {
    const r = reisbieb.lees(req.body.id);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
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

  /* ---- de RTF-Bibliotheek in de Mall: dezelfde echte, gratis kind- en
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
