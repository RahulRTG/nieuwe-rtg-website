/* Domein "member", deel van winkel: DE VINDLAAG VAN DE MALL.

   De commerciele voorkant van heel RTG: waar sta je (plekken), wat staat daar
   (home), wat zoek je (zoek), wat bewaar je (lijsten en de reismand) en wat
   vraag je als niemand het aanbiedt (aanvragen).

   Alleen routes. Zoeken is een LEESLAAG: er wordt hier niets besteld of
   geboekt, de knop wijst naar de plek waar dat al gebeurt. Vandaar ook geen
   gegevenspoort op de zoekroutes -- er gaat geen enkel gegeven naar een derde.
   Apart gehouden van ./winkel-bieb.js omdat dat bestand over de bibliotheken
   gaat en op de bestandsgrens liep. */
module.exports = (kern) => {
  const { app, auth, mall, liveCodename } = kern;
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Hiervoor heeft u een pas nodig.' }); return true; }
    return false;
  };

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
  /* Context komt uit wat het lid ZELF heeft gezet, niet uit wat we van hem
     hebben onthouden: een gekozen plek, een gekozen periode, of de reismand
     waar hij in werkt. Dat is de personalisatie die hier past -- een
     gedragsprofiel opbouwen om te raden wat iemand wil, is precies wat dit
     huis niet doet. */
  app.post('/api/mall/zoek', auth, (req, res) => {
    let plek = req.body.plek, van = req.body.van, tot = req.body.tot;
    if (req.body.lijst) {
      const l = mall.mallLijsten.toon(req.session.key, req.body.lijst);
      if (l.ok && l.lijst.soort === 'reis') { plek = plek || l.lijst.plek; van = van || l.lijst.van; tot = tot || l.lijst.tot; }
    }
    res.json(mall.mallZoek({
      q: String(req.body.q || '').slice(0, 120),
      plek, punt: req.body.punt, van, tot,
      // een Business Pass koopt op inkoopprijs waar die bestaat
      zakelijk: req.session.tier === 'business',
      verdieping: req.body.verdieping, type: req.body.type, aanbieder: req.body.aanbieder,
      maxPrijs: req.body.maxPrijs, binnenKm: req.body.binnenKm,
      // het land: de stap van een stad naar heel Europa
      land: req.body.land, minCijfer: req.body.minCijfer,
      // de live stand uit de Supplier OS: alleen wat nu open is / op voorraad ligt
      openNu: req.body.openNu === true, opVoorraad: req.body.opVoorraad === true,
      bezorgt: req.body.bezorgt === true, zakelijkAlleen: req.body.zakelijkAlleen === true,
      // de kaart kost werk over alle treffers, dus alleen als het scherm hem toont
      kaart: req.body.kaart === true,
      // "alleen wat ik bewaarde": de ids komen van dit lid, nooit van de client
      bewaard: req.body.bewaard === true,
      bewaardeIds: req.body.bewaard === true ? mall.mallLijsten.bewaardeIds(req.session.key) : null,
      pagina: req.body.pagina, per: req.body.per,
      // dit is een mens die zoekt: tel de woorden mee voor het vraagbeeld
      noteer: true
    }));
  });

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
  /* Het hartje en wat er sinds het bewaren veranderde. Bewust GEEN melding:
     dit ziet u wanneer u zelf kijkt; zie de kop van kern/mall/bewaard.js. */
  app.post('/api/mall/bewaar', auth, (req, res) => lijstStuur(res, mall.mallLijsten.bewaarWissel(req.session.key, req.body.aanbodId)));
  app.post('/api/mall/bewaard', auth, (req, res) => lijstStuur(res, mall.mallLijsten.toon(req.session.key, mall.mallLijsten.bewaardLijst(req.session.key).id)));
  app.post('/api/mall/wijzigingen', auth, (req, res) => res.json(mall.mallLijsten.mallWijzigingen(req.session.key)));

  /* ---- samengesteld aanbod: collectie, bundel, evenement, seizoen ----
     Wat er geldt wordt met de DATUM bepaald en niet met een vinkje dat iemand
     moet omzetten; zie de kop van kern/mall/collecties.js. */
  app.post('/api/mall/collecties', auth, (req, res) => res.json(mall.mallCollecties.collecties({
    plek: req.body.plek, soort: req.body.soort, van: req.body.van, tot: req.body.tot
  })));
  app.post('/api/mall/collectie', auth, (req, res) => lijstStuur(res, mall.mallCollecties.toon(req.body.id)));

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
};
