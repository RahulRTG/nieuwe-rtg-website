/* De dunne HTTP-laag van RTG Neiging (kern/neiging/, NEIGING.md).

   ZEVEN ROUTES, EN ALLE ZEVEN VAN HET LID OVER ZICHZELF. Er is met opzet geen
   kantoorroute en geen leveranciersroute: er is geen scherm waarop een
   medewerker van RTG de neigingen van een lid kan lezen, en er komt er geen.

   Dat is geen voorzichtigheid maar de enige manier waarop deze laag mag
   bestaan. KANTOORMACHT.md mat dat 422 van de 590 kantoorroutes achter een
   GEDEELDE code hangen, en dat een spoor dat bij zo'n code eindigt een alibi is
   en geen spoor. Een laag die bijhoudt wat iemand leuk vindt, hoort niet als
   eerste zijn kantoordeur te bouwen -- zeker niet zolang die deur dat probleem
   nog draagt. Wil het kantoor er ooit bij, dan is dat een BESLUIT met een
   reden, een journaalregel en een melding aan de betrokkene, langs de weg die
   kern/ledenbalie-inzage.js al kent. Niet hier, en niet stilzwijgend.

   EN EEN BEZOEKER HEEFT GEEN INTAKE. Dezelfde grond als bij de gegevenskaart:
   zonder account is er niets om aan te hangen, en een lege lijst tonen leest
   als "RTG weet niets van u" terwijl er domweg geen plek is om iets te bewaren.
   De grond is dus het ACCOUNT en niet de pas -- maar de toets vroeg tot 29
   september 2026 naar de pas en weigerde ook het gratis account
   (SAMENLEVING.md par. 11.4). Het besluit van die dag: open voor een gratis
   account na een paspoortcontrole, langs de paspoortdeur van de bodem. */
'use strict';

module.exports = (kern) => {
  const { app, auth, idGeverifieerd } = kern;
  const paspoortdeur = require('../kern/onvervreemdbaar').maakPaspoortdeur({ idGeverifieerd });

  const lid = (req, res, next) => { if (paspoortdeur(req, res)) next(); };

  /* Een uitslag met een `status` is een weigering. Dezelfde vorm als
     routes/experience.js, zodat de client er een afhandeling voor heeft. */
  const stuur = (res, r) => {
    if (!r || r.error) return res.status((r && r.status) || 400).json({ error: (r && r.error) || 'Onbekende fout.' });
    res.json(r);
  };

  /* De volgende vraag, of `klaar`. Leest alleen. */
  app.post('/api/neiging/intake', auth, lid, (req, res) =>
    stuur(res, kern.neiging.intake(req.session.key)));

  /* Een antwoord. De client stuurt de vraag-id mee die hij kreeg; onderwerpen
     die niet bij die vraag horen worden geteld als `genegeerd` en niet bewaard
     -- zie de toelichting in kern/neiging/index.js. */
  app.post('/api/neiging/antwoord', auth, lid, (req, res) =>
    stuur(res, kern.neiging.antwoord(req.session.key, String((req.body || {}).vraag || ''),
      (req.body || {}).onderwerpen)));

  app.post('/api/neiging/overslaan', auth, lid, (req, res) =>
    stuur(res, kern.neiging.overslaan(req.session.key)));

  app.post('/api/neiging/opnieuw', auth, lid, (req, res) =>
    stuur(res, kern.neiging.opnieuw(req.session.key)));

  /* Wat RTG van mij denkt te weten. */
  app.post('/api/neiging/geheugen', auth, lid, (req, res) =>
    stuur(res, kern.neiging.geheugen(req.session.key)));

  /* Weghalen, en niet hiervoor gebruiken. Deze twee staan HIER en niet bij
     /api/mijn/gegevens: die kaart schrijft met opzet niets, en weghalen doe je
     waar het gegeven woont. Zouden ze daar ook staan, dan waren er twee plekken
     om hetzelfde te wissen, en binnen een jaar doet er een het net anders. */
  app.post('/api/neiging/vergeet', auth, lid, (req, res) =>
    stuur(res, kern.neiging.vergeet(req.session.key, String((req.body || {}).id || ''))));

  app.post('/api/neiging/niet-voor', auth, lid, (req, res) =>
    stuur(res, kern.neiging.nietVoor(req.session.key, String((req.body || {}).id || ''),
      String((req.body || {}).doel || ''))));
};
