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
  const { app, auth, plaats, liveCodename } = kern;
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
};
