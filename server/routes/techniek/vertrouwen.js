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
  app.post('/api/techniek/vertrouwen/staat', techAuth, eigenaarAlleen, (req, res) => {
    const { HANDELINGEN } = require('../../bedrijf/handeling-lijst');
    res.json(F().trustState(HANDELINGEN));
  });
};
