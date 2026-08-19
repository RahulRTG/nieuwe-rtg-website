/* Domein "plaats": de plaatslaag (PLAATS.md, kern/plaats).

   Vijf ingangen, en de vorm van deze vijf IS het ontwerp:

     hekken      haalt gebieden op zodat het TOESTEL kan rekenen. Geen
                 persoonsgegeven, dus dit mag gewoon naar buiten.
     venster     toestemming openen of sluiten, altijd met een einde erin.
     waarneem    de uitkomst van de motor op het toestel: welk hek, binnen of
                 buiten, wanneer. Deze route WEIGERT een coördinaat.
     stand       zelf-inzage: alles wat RTG nu van mij weet over plaats.
     aanwezig    voor een domein: binnen of buiten, met een tijd. Meer niet.

   ALLES OP CODENAAM. De laag kent geen accountsleutels en geen namen; dat is
   dezelfde regel als in kern/geldbeleid en om dezelfde reden. Een positie naast
   een echte naam is precies wat privacy by design hier moet voorkomen.

   Achter de gewone leden-inlog. Gasten niet: een gast heeft geen codenaam die
   ergens bij hoort, en een venster zonder houder is niet in te trekken. */
module.exports = (kern) => {
  const { app, auth, plaats, liveCodename, werkgeversVan, werkbeleidPauzeStand } = kern;
  const stuur = (res, r) => (r && r.error) ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'De plaatslaag is voor leden.' }); return true; }
    return false;
  };
  const wie = (req) => liveCodename(req.session);
  /* De ledensleutel gaat mee naar de hekkenkant (en alleen daarheen). De laag
     bewaart hem nergens: bronnen hebben hem nodig om een andere administratie te
     bevragen -- de personeelsadministratie werkt op sleutels -- en de vertaling
     codenaam -> sleutel loopt via de gids, die async is. */
  const sleutel = (req) => req.session.key || null;

  // de hekken voor één doel -- dit is wat de motor op het toestel ophaalt
  app.post('/api/plaats/hekken', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, plaats.plaatsHekken((req.body || {}).doel, wie(req), sleutel(req)));
  });

  // toestemming openen: altijd met een reden en altijd met een einde
  app.post('/api/plaats/venster', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, plaats.plaatsVensterOpen(wie(req), req.body || {}));
  });

  // en weer dicht -- sluiten wist ook de waarnemingen van dat venster
  app.post('/api/plaats/venster/sluit', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, plaats.plaatsVensterSluit(wie(req), (req.body || {}).doel));
  });

  /* De waarneming. Het toestel heeft zelf gerekend; hier komt alleen de
     uitkomst binnen. Stuurt iemand toch een positie mee, dan geeft de kern een
     400 met de reden erbij -- zie kern/plaats/venster.js voor waarom dat een
     weigering is en geen stille opschoning. */
  app.post('/api/plaats/waarneem', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, plaats.plaatsWaarneem(wie(req), req.body || {}, sleutel(req)));
  });

  // zelf-inzage gaat vrij: wie dit opent hoort niets te ontdekken dat er niet staat
  app.post('/api/plaats/stand', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, plaats.plaatsStand(wie(req)));
  });

  /* LOOPT ER EEN DIENST? -- de brug tussen de twee sessies (PLAATS.md fase 2c).

     Het probleem dat dit oplost: de hek-motor draait in de LEDEN-app en een
     dienst leeft in de PERSONEELS-app. Die twee sessies raken elkaar bewust
     nooit, en dat is de kracht van het ontwerp -- maar het betekende ook dat
     een venster alleen met de hand open kon.

     DE VERLEIDING WAS OM DE ZAAK HET VENSTER TE LATEN OPENEN, bij het inklokken,
     op het account van de medewerker. Dat is precies de deur die dicht moet
     blijven: dan opent een WERKGEVER een toestemming op de telefoon van zijn
     personeel, en toestemming die een ander voor je geeft is geen toestemming.

     Wat er wel mag is klaarzetten: dit antwoord zegt tegen het LID dat zijn
     eigen dienst loopt, en zijn eigen app biedt het hem aan. Een mens bevestigt.

     Alles hierin is eigen data: bij welke zaken werk ik, en sta ik daar nu
     ingeklokt. Geen enkele andere mens komt erin voor. */
  app.post('/api/plaats/dienst', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const key = req.session.key;
    const werkgevers = typeof werkgeversVan === 'function' ? (werkgeversVan(key) || []) : [];
    const lopend = [];
    for (const w of werkgevers) {
      if (w.staffId == null || typeof werkbeleidPauzeStand !== 'function') continue;
      let stand;
      try { stand = werkbeleidPauzeStand(w.code, w.staffId); } catch (e) { continue; }
      if (!stand || !stand.ingeklokt) continue;
      lopend.push({ zaak: w.code, naam: w.naam || w.code, hek: 'leverancier:' + w.code });
    }
    /* En of er al toestemming ligt. Ligt die er, dan hoeft de app niets te
       vragen en start hij gewoon; ligt die er niet meer terwijl de dienst nog
       loopt, dan vraagt hij opnieuw -- een venster dat afliep is een antwoord
       dat verlopen is, geen antwoord dat blijft gelden. */
    const stand = plaats.plaatsStand(wie(req));
    const venster = (stand.vensters || []).find(v => v.doel === 'dienst') || null;
    res.json({ status: 200, diensten: lopend,
      venster: venster ? { bron: venster.bron, sluit: venster.sluit } : null });
  });
};
