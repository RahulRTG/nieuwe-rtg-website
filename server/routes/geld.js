/* RTG Geld: de routes van het financiele besturingssysteem (GELD.md).

   Dun, bewust: de kern doet het werk en de route vertaalt alleen. De
   geldgraaf levert het cockpitbeeld, het geldbeleid de regels, potten en het
   actielog.

   De enige schrijfroutes hier raken het BELEID van het lid zelf: regels en
   oormerken binnen het eigen tegoed. Betalen, verrekenen en toezeggen blijft
   in de module die het echte werk doet, en daar heeft dit bestand met opzet
   geen tegenhanger voor -- geld verlaat het huis nooit via deze laag.

   Identiteit: het token reist in de Authorization-kop (auth leest hem daar,
   nooit uit een URL), en binnen de beleidslaag is de CODENAAM de sleutel;
   echte namen blijven in de kluis (privacy by design). */
module.exports = (kern) => {
  const { app, auth } = kern;

  /* GEEN GASTEN, en dat is hier geen beleefdheidsregel maar een lek dat we
     dicht doen. Een anonieme demo-gast heeft geen codenaam; kern.codenaamVan
     valt voor hem stil terug op de rauwe sessiesleutel, en die belandde
     daarmee als opslagsleutel in db.data.geldbeleid -- een stuk van zijn
     sessietoken, blijvend op schijf, met actielogregels op naam van een lid
     dat niet bestaat. Dat omzeilt precies het codenamen-ontwerp (CLAUDE.md:
     klantdata draait op codenamen) en groeit bovendien onbegrensd, want elke
     gast-login is een nieuw token en dus een nieuwe rij.

     Dezelfde poort als RTG Pay (routes/pay.js) en het bankhart: wie geen lid
     is, heeft hier niets te zoeken. */
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') {
      res.status(403).json({ error: 'RTG Geld is voor leden.' });
      return true;
    }
    return false;
  };

  /* HIER STOND /api/geld/wereld, en die is weg. Hij bediende de oude
     samenhangstand van geld.html; sinds die pagina tien standen met een eigen
     cockpit heeft (/api/geld/cockpit), riep niemand hem nog aan -- repo-breed
     geen enkele aanroeper in public/, test/ of scripts/. Een endpoint dat
     niemand roept is geen reserve maar een deur die openstaat en die niemand
     bewaakt, en het commentaar hierboven beweerde bovendien dat hij "voor de
     schil" bleef staan: onwaar sinds de samenvoeging (LAT.md regel 6).

     kern/geldwereld.js zelf BLIJFT. Hij hoort bij een familie van vier
     (reiswereld, kantoorwereld, socialewereld, geldwereld) die door
     test/geldwereld.test.js in dezelfde taal wordt gehouden, en die drie
     anderen worden wel degelijk geroepen door hun wereldpagina. Zodra ook zij
     een cockpit hebben, gaat de hele samenhanglaag in EEN keer met pensioen --
     niet stukje bij beetje, want dan blijft er een half gezin over. */

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
      if (geenGast(req, res)) return;
      try { stuur(res, werk(kern.codenaamVan(req.session.key), req.body || {})); }
      catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
    });
  }

  /* Het command center: exact het beeld dat kern/geldgraaf samenstelt, met
     alleen ok erbij. Hier wordt niets bijgerekend -- een tweede rekenlaag in
     een route loopt gegarandeerd uit de pas met de kern. */
  app.post('/api/geld/cockpit', auth, (req, res) => {
    if (geenGast(req, res)) return;
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
  /* opruimen hoort erbij: zonder deze route belooft de foutmelding bij
     veertig regels een handeling die niet bestaat (LAT.md regel 6) */
  route('beleid/weg', (c, b) => kern.geldbeleid.regelWeg(c, String(b.id || '')));
  route('pot/weg', (c, b) => kern.geldbeleid.potWeg(c, String(b.id || '')));
  route('actielog', (c) => ({ status: 200, ok: true, log: kern.geldbeleid.log(c) }));

  /* De gegronde Rahul staat in een eigen bestand: antwoorden (AI plus het
     rekenende terugvalpad) is meer dan vertalen, en dat hoort niet tussen de
     dunne routes hierboven te groeien. */
  require('./geldrahul')(kern);
};
