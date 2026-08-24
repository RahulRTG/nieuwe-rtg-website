/* ============================================================================
   De deuren van de Trust Fabric: bonnen, bereik, simulatie en de Trust State.

   Alles achter techAuth + eigenaarAlleen, en dat is geen voorzichtigheid maar
   noodzaak: een blast radius is een KAART VAN DE ZWAKKE PLEKKEN. "Dit account
   kan tot duizend objecten uitvoeren zonder dat er iets vraagt" is precies wat
   een aanvaller wil weten, en het is dezelfde zin die een beheerder nodig heeft
   om het te repareren. Wie hem mag lezen, is dus een besluit en geen detail.

   NIETS HIER SCHRIJFT. De simulatie verandert de wereld niet (VERTROUWEN.md
   par. 3.4) -- juist deze knop drukt iemand in om te KIJKEN, en een simulatie
   met een bijwerking is de duurste soort bug. De bonnen worden geschreven door
   de poort die de handeling droeg, niet hier.

   Gemount vanuit routes/techniek.js. */
'use strict';

module.exports = (tctx) => {
  const { app, techAuth, eigenaarAlleen, kern } = tctx;
  const F = () => kern.vertrouwen;

  /* De Trust Receipts, met de ketencontrole erbij. Die twee horen in EEN
     antwoord: bonnen zonder het oordeel over hun keten zijn een lijst tekst. */
  app.post('/api/techniek/vertrouwen/bonnen', techAuth, eigenaarAlleen, (req, res) => {
    res.json({ bonnen: F().bonnen((req.body || {}).hoeveel), keten: F().bonnenKlopt() });
  });

  /* HET ANKER. Zonder dit ziet niemand KOPAFKNIPPING: wie de nieuwste bonnen
     weggooit, houdt een keten over die van voor naar achter perfect klopt.
     Deze deur MAAKT de momentopname; wegzetten doet een mens, buiten deze
     database, want een anker dat hier blijft staan is een tweede regel om te
     wijzigen. Stuur er later een terug en hij rekent ermee af. */
  app.post('/api/techniek/vertrouwen/anker', techAuth, eigenaarAlleen, (req, res) => {
    const eerder = (req.body || {}).anker;
    if (eerder) return res.json({ tegenAnker: F().bonTegenAnker(eerder) });
    const punt = F().bonAnker();
    /* Geen bonnen, geen kop, geen anker. Dat is geen fout maar een stand, en
       een leeg anker met "zet dit weg" erbij zou nergens op slaan. */
    if (!punt) return res.json({ anker: null,
      reden: 'Er zijn nog geen Trust Receipts, dus er is geen kop om te verankeren.' });
    res.json({ anker: punt,
      let: 'Zet dit buiten deze database weg. Een anker dat hier blijft staan, bewijst niets.' });
  });

  /* Het bereik van een actor (laag 6). De rollentabel komt als DATA uit
     bedrijf/rollen-register.js -- die wordt daar met zoveel woorden los
     geexporteerd voor lezers buiten die laag, juist zodat niemand hem overtypt
     en er een tweede waarheid ontstaat over welk recht bij welke rol hoort. */
  const { ROLLEN, RECHTEN } = require('../../bedrijf/rollen-register');
  const rechtenVan = (r) => [...new Set((r.rollen || [])
    .flatMap(id => (ROLLEN.find(x => x.id === id) || {}).rechten || []))];

  app.post('/api/techniek/vertrouwen/bereik', techAuth, eigenaarAlleen, (req, res) => {
    const actor = String((req.body || {}).actor || '');
    if (!actor) return res.status(400).json({ error: 'Welke actor? Zonder actor is er geen bereik te rekenen.' });
    res.json(F().bereikVan(actor, { rechtenVan }));
  });

  /* Simuleer een compromittering (laag 7). Het antwoord draagt zijn eigen
     blinde vlek mee in `nietGemodelleerd`: een berekend bereik zegt wat het
     MODEL weet en niet wat de aanvaller kan. */
  app.post('/api/techniek/vertrouwen/simuleer', techAuth, eigenaarAlleen, (req, res) => {
    const actor = String((req.body || {}).actor || '');
    if (!actor) return res.status(400).json({ error: 'Welke actor zou er zijn overgenomen?' });
    res.json(F().simuleer(actor, { rechtenVan, alleRechten: RECHTEN }));
  });

  /* De Trust State (laag 8). Een handvol absolute eigenschappen die op nul
     horen -- geen score, en geen enkel getal dat iets wegmiddelt. */
  app.post('/api/techniek/vertrouwen/staat', techAuth, eigenaarAlleen, async (req, res) => {
    const { HANDELINGEN } = require('../../bedrijf/handeling-lijst');
    /* De scanner wordt LIVE gevraagd, want een bewaarde datum is een bewering
       over gisteren. Is er geen clamd (ontwikkelopstelling), of antwoordt hij
       niet, dan levert dat een reden op en geen nul -- zie kern/vertrouwen/staat.js. */
    let scanner = null;
    try {
      const c = require('../../kern/clamd').maakClamd();
      if (c) scanner = await c.versie();
    } catch (e) { scanner = { definitieDatum: null, reden: String(e && e.message || e).slice(0, 160) }; }
    res.json(F().trustState(HANDELINGEN, scanner));
  });
};
