/* ============================================================================
   De deuren van de Trust Fabric: bonnen, bereik, simulatie en de Trust State.

   Alles achter techAuth + eigenaarAlleen, en dat is geen voorzichtigheid maar
   noodzaak: een blast radius is een KAART VAN DE ZWAKKE PLEKKEN. "Dit account
   kan tot duizend objecten uitvoeren zonder dat er iets vraagt" is precies wat
   een aanvaller wil weten, en het is dezelfde zin die een beheerder nodig heeft
   om het te repareren. Wie hem mag lezen, is dus een besluit en geen detail.

   HET RAPPORT SCHRIJFT NIETS. De simulatie verandert de wereld niet
   (VERTROUWEN.md par. 3.4) -- juist die knop drukt iemand in om te KIJKEN, en
   een simulatie met een bijwerking is de duurste soort bug. De bonnen worden
   geschreven door de poort die de handeling droeg, niet hier.

   EEN DEUR HIER SCHRIJFT WEL, en dat is het tweede moment onderaan: die lost
   een bon op en zet de verificatie van de sessie opnieuw. Dat hoort ook, want
   dat is geen kijken maar een handeling van de mens zelf. Hij staat met opzet
   als eerste in dit bestand, zodat niemand hem per ongeluk voor een
   rapportageroute aanziet.

   Gemount vanuit routes/techniek.js. */
'use strict';

module.exports = (tctx) => {
  const { app, accounts, techAuth, eigenaarAlleen, kern } = tctx;
  const F = () => kern.vertrouwen;

  /* ---------- het tweede moment (laag 3) ----------

     HIJ STOND IN ./tenant.js, naast de handeling die hem als eerste nodig had.
     Dat was de verkeerde plek zodra er een tweede manier bij kwam om hem te
     geven: een bon oplossen is een handeling van de FABRIC en niet van een
     tenant, en de twee wegen ernaartoe horen naast elkaar te staan in plaats
     van verspreid.

     TWEE WEGEN, EN DE TWEEDE IS ER OMDAT DE EERSTE NIET IEDEREEN BEDIENT. Een
     wachtwoord opnieuw typen werkt alleen als er een wachtwoord IS; wie via de
     identiteitsprovider van zijn organisatie binnenkomt, heeft dat niet. Een
     passkey erft niets van de manier waarop de sessie is ontstaan en is de
     enige manier hier met de band `sterk` -- precies wat een tweede
     bewijsvoering hoort te zijn.

     Achter techAuth + eigenaarAlleen zoals de rest van dit bestand, en dat
     klopt zolang de enige techniekhandeling die om een bon vraagt het
     vernietigen van een tenant is. Komt daar ooit een handeling bij die niet
     van de eigenaar is, dan is dat het moment om deze deur te verbreden -- met
     een reden, en niet stilzwijgend. */
  const passkey = require('../../kern/vertrouwen/passkeystap')(kern);

  app.post('/api/techniek/vertrouwen/passkey', techAuth, eigenaarAlleen, async (req, res) => {
    const uit = await passkey.opties(req.techUser, req);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    res.json({ ok: true, opties: uit.opties, ceremonie: uit.ceremonie });
  });

  app.post('/api/techniek/tenant/bevestig', techAuth, eigenaarAlleen, async (req, res) => {
    const b = req.body || {};
    /* Een van de twee, en niet allebei half. Wie een passkey meestuurt hoeft
       geen wachtwoord; wie geen passkey meestuurt, moet er wel een typen. */
    if (b.passkey) {
      const k = await passkey.keur(req.techUser, req, b.passkey);
      if (!k.ok) return res.status(k.status).json({ error: k.reden });
    } else if (!await accounts.verifyPassword(String(b.wachtwoord || ''), req.techUser.password_hash)) {
      return res.status(401).json({ error: 'Dat wachtwoord klopt niet. Er is niets bevestigd. Heeft dit account geen wachtwoord (inlog via uw organisatie), bevestig dan met een passkey.' });
    }
    const sessie = String(req.techSessie || '');
    const uit = kern.vertrouwen.losBon(String(b.id || ''), sessie);
    if (!uit.ok) return res.status(400).json({ error: uit.reden });
    /* En de sessie is weer VERS -- zie kern/vertrouwen/tweedemoment.js. De
       manier wordt genoteerd zoals hij WAS: een passkey als wachtwoord
       wegschrijven laat de bon liegen over hoe hard dit moment was. */
    kern.vertrouwen.noteerInlog(req, sessie, req.techUser.id, b.passkey ? 'passkey' : 'wachtwoord');
    res.json({ ok: true });
  });

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
