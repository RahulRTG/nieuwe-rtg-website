/* Domein "navigatie": RTG Navigatie, het huiseigen navigatiesysteem. De route
   komt uit ons eigen wegennet (A*), de bestemmingen uit onze leveranciers, het
   OV, de loketten en de POI-lagen (tank/laad); onderweg schuift RTG Flits erin.
   Achter de gewone leden-inlog; chauffeurs gebruiken dezelfde functies via de
   PDA-inlog. Op codenaam, geen externe kaartdienst. */
const fs = require('node:fs');
module.exports = (kern) => {
  const { app, auth, supplierAuth, liveCodename, navBestemmingen, navRoute, navPoi, navKaart, navMeld,
    navStatus, navPartnerEvent, navPartnerEvents,
    navKaartenBeeld, navKaartKies, navKaartWeg, navKaartPakket, navKaartDeel } = kern;
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
    stuur(res, navRoute({ van: b.van, naar: b.naar, modus: b.modus, profiel: b.profiel,
      vertrekAt: b.vertrekAt, accuProcent: b.accuProcent, bereikKm: b.bereikKm }));
  });
  // wat de eigen motor nu werkelijk weet; de cockpit toont bronversheid eerlijk
  app.post('/api/nav/status', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, navStatus(hier(req.body)));
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

  /* DE KAARTEN VAN DIT LID: de hele catalogus met per gebied of hij hem heeft
     gekozen, en of er werkelijk een pakket ligt. "Aangeboden" is geen dekking,
     dus die drie standen staan apart in het antwoord (kern/navigatie/gebieden.js).
     Op de SESSIESLEUTEL en niet op een naam: welke landen iemand wil hebben,
     zegt iets over waar hij komt. */
  app.post('/api/nav/gebieden', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, navKaartenBeeld(req.session.key));
  });
  /* Kiezen mag ook als het pakket nog niet gebouwd is -- dat IS het verzoek,
     en het antwoord zegt met zoveel woorden dat er dan nog niet gerekend
     wordt. Een knop die stil iets anders doet dan hij belooft, is erger dan
     geen knop. */
  app.post('/api/nav/gebied/kies', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, navKaartKies(req.session.key, req.body && req.body.code));
  });
  app.post('/api/nav/gebied/weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, navKaartWeg(req.session.key, req.body && req.body.code));
  });

  /* HET PAKKET OPHALEN VOOR DIT TOESTEL. Het manifest zegt wat er te halen is,
     hoe groot en met welk controlegetal; de tweede route stuurt de bytes. Twee
     routes en geen een, omdat een toestel eerst wil weten wat het binnenhaalt
     (kern/navigatie/toestelpakket.js draagt de reden).

     De licentiepoort zit in de kern en niet hier: een pakket op een toestel
     zetten is verspreiden, en dan eist ODbL naamsvermelding. Geen vermelding,
     geen manifest -- en dus ook geen bytes, want ook de tweede route vraagt
     dezelfde poort. */
  app.post('/api/nav/gebied/pakket', auth, (req, res) => {
    if (geenGast(req, res)) return;
    navKaartPakket(req.body && req.body.code).then(r => stuur(res, r))
      .catch(() => res.status(500).json({ error: 'Het manifest kon niet worden gemaakt.' }));
  });
  /* Met GET en niet met POST, want dit is een bestand: de browser bewaart het
     antwoord in zijn eigen cache op het ADRES, en dat werkt alleen als het
     adres het antwoord bepaalt. De sessie komt uit de Authorization-header
     (fetch kan dat, een <video> niet -- vandaar dat theater.js wel een token in
     de url heeft en deze route niet: een token in een adres landt in logs). */
  app.get('/api/nav/gebied/pakket/:code/:deel', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const d = navKaartDeel(req.params.code, req.params.deel);
    if (!d.ok) return res.status(d.status || 400).json({ error: d.error });
    res.writeHead(200, { 'Content-Type': d.soort, 'Content-Length': d.bytes,
      /* Een deel van een pakket verandert alleen als het pakket opnieuw wordt
         gebouwd, en dan verandert ook zijn controlegetal in het manifest. Het
         toestel bewaart het zelf; de browsercache hoeft er niet nog een kopie
         van te maken. */
      'Cache-Control': 'no-store' });
    fs.createReadStream(d.pad).on('error', () => res.destroy()).pipe(res);
  });

  /* Partners leveren een genormaliseerd mobiliteitssignaal, nooit een te
     volgen route. RTG houdt daarmee de besluitvorming, herkomst en vervaldatum
     in eigen hand. */
  app.post('/api/supplier/nav/event', supplierAuth, (req, res) => {
    stuur(res, navPartnerEvent(req.supplier, req.body || {}));
  });
  app.post('/api/supplier/nav/events', supplierAuth, (req, res) => {
    stuur(res, navPartnerEvents(req.supplier.code));
  });
};
