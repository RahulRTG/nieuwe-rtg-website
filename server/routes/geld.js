/* RTG Geld: de routes van het financiele besturingssysteem (GELD.md).

   Dun, bewust: de kern doet het werk en de route vertaalt alleen. De
   geldgraaf levert het cockpitbeeld, het geldbeleid de regels, potten en het
   actielog; geldwereld (de oude samenhangstand) blijft staan voor de schil.

   De enige schrijfroutes hier raken het BELEID van het lid zelf: regels en
   oormerken binnen het eigen tegoed. Betalen, verrekenen en toezeggen blijft
   in de module die het echte werk doet, en daar heeft dit bestand met opzet
   geen tegenhanger voor -- geld verlaat het huis nooit via deze laag.

   Identiteit: het token reist in de Authorization-kop (auth leest hem daar,
   nooit uit een URL), en binnen de beleidslaag is de CODENAAM de sleutel;
   echte namen blijven in de kluis (privacy by design). */
module.exports = (kern) => {
  const { app, auth } = kern;

  app.post('/api/geld/wereld', auth, (req, res) =>
    res.json(kern.geldwereld.stand(req.session.key)));

  /* Kernantwoorden dragen een status mee voor de http-laag; het lichaam hoort
     hem niet te herhalen, want dan bestaan er twee plekken met dezelfde
     waarheid (LAT.md regel 4). */
  const stuur = (res, r) => {
    if (!r || r.error) return res.status((r && r.status) || 400).json({ error: (r && r.error) || 'Onbekende fout.' });
    const uit = Object.assign({}, r);
    delete uit.status;
    res.json(uit);
  };

  /* Een keer per verzoek van sleutel naar codenaam, zoals geldwereld het doet.
     De try bestaat omdat een omgevallen kernlaag anders als kale 500 zonder
     lichaam bij het lid belandt; de fout blijft zichtbaar in de serverlog. */
  function route(pad, werk) {
    app.post('/api/geld/' + pad, auth, (req, res) => {
      try { stuur(res, werk(kern.codenaamVan(req.session.key), req.body || {})); }
      catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
    });
  }

  /* Het command center: exact het beeld dat kern/geldgraaf samenstelt, met
     alleen ok erbij. Hier wordt niets bijgerekend -- een tweede rekenlaag in
     een route loopt gegarandeerd uit de pas met de kern. */
  app.post('/api/geld/cockpit', auth, (req, res) => {
    try { res.json(Object.assign({ ok: true }, kern.geldgraaf.cockpit(req.session.key))); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* Beleid en potten. De kern logt elk van deze handelingen zelf met
     wie 'lid' in het append-only actielog: via deze routes handelt altijd het
     lid, en het log mag het lid en Rahul nooit door elkaar halen. */
  route('beleid', (c) => ({ status: 200, ok: true,
    regels: kern.geldbeleid.regels(c), potten: kern.geldbeleid.potten(c) }));
  route('beleid/zet', (c, b) => kern.geldbeleid.regelZet(c, b));
  route('pot/zet', (c, b) => kern.geldbeleid.potZet(c, b));
  // centen mag negatief zijn: dat geeft een oormerk vrij; de kern bewaakt de nulgrens
  route('pot/reserveer', (c, b) => kern.geldbeleid.potReserveer(c, String(b.id || ''), b.centen));
  route('pot/weg', (c, b) => kern.geldbeleid.potWeg(c, String(b.id || '')));
  route('actielog', (c) => ({ status: 200, ok: true, log: kern.geldbeleid.log(c) }));

  /* De gegronde Rahul staat in een eigen bestand: antwoorden (AI plus het
     rekenende terugvalpad) is meer dan vertalen, en dat hoort niet tussen de
     dunne routes hierboven te groeien. */
  require('./geldrahul')(kern);
};
