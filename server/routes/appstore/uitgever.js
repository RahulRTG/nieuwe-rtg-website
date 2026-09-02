/* De uitgeverskant van de RTG App Store: een DERDE zendt hier in.

   De poort is supplierAuth -- een uitgever logt in als de zaak die hij is, niet
   met een aparte ontwikkelaarssleutel. Dat is met opzet: TENANT.md zegt dat er
   geen vijfde identiteitsbegrip bij komt, en een tweede inlog voor dezelfde
   partij is precies dat.

   De ORG wordt hier NIET uit de body gelezen maar afgeleid uit het tenantregister
   (kern/tenant/register.js: vanZaak). Zou de inzender zijn eigen organisatiecode
   mogen meesturen, dan publiceert iedereen onder ieders naam. Hangt de zaak nog
   niet onder een organisatie, dan is dat een weigering met de weg erbij en geen
   stilzwijgende toelating. */
module.exports = (kern) => {
  const { app, supplierAuth, appstore, appstoreWinkel, appstoreBrug, tenant } = kern;

  /* De organisatie achter deze zaak, of de reden waarom er geen is. Een
     ontbrekende tenantlaag is hier GEEN "ja": dan gaat de deur dicht (dezelfde
     keuze als de persoonspoort in opzet/leverancierpoort.js). */
  function orgVan(req) {
    if (!tenant || !tenant.register) return { error: 'De organisatielaag draait niet mee; zonder aanspreekbare organisatie neemt de App Store geen inzending aan.', status: 503 };
    const t = tenant.register.vanZaak(req.supplier.code);
    if (!t) return { status: 409, error: 'Deze zaak hangt nog niet onder een organisatie. Een app in de officiele App Store heeft een aanspreekbare rechtspersoon achter zich; vraag RTG om je zaak aan je organisatie te koppelen.' };
    if (t.actief === false) return { status: 403, error: 'De organisatie achter deze zaak staat niet actief.' };
    return { ok: true, org: t.org, naam: t.naam };
  }

  const metOrg = (fn) => (req, res) => {
    const o = orgVan(req);
    if (!o.ok) return res.status(o.status).json({ error: o.error });
    const r = fn(req, o);
    if (r && r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  };

  // wie ben ik hier, en wat mag ik
  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/uitgever', supplierAuth, metOrg((req, o) => Object.assign(
    { status: 200, org: o.org, organisatie: o.naam }, appstore.mijnUitgeverij(o.org))));

  // de uitgeversplek aanvragen; een MENS van RTG laat toe
  /* mutatie: idempotent -- een tweede aanvraag werkt de eerste bij of zegt dat hij er al is */
  app.post('/api/appstore/uitgever/aanvraag', supplierAuth, metOrg((req, o) => appstore.uitgeverAanvragen({
    org: o.org, naam: String(req.body.naam || o.naam || ''), contact: String(req.body.contact || ''), leverancier: req.supplier.code })));

  /* Inzenden. Het antwoord bij een afkeuring draagt per bestand en regel wat er
     is gevonden EN hoe het wel kan; dat is het verschil tussen een poort waar je
     doorheen leert komen en een poort waar je tegenaan blijft lopen. */
  /* mutatie: idempotent -- dezelfde bundel levert dezelfde hash en dus geen tweede versie */
  /* DE MENS ACHTER DE INZENDING gaat mee, en niet alleen de organisatie. Dat is
     de helft van de vier-ogenregel die aan deze kant hoort: zonder dit weet het
     aftekenmoment straks alleen van welke org een bundel komt
     (kern/appstore/vierogen.js). `req.actor` staat er al -- de leverancierspoort
     zet hem voor de toeschrijving van elke handeling in een werkplek. */
  app.post('/api/appstore/uitgever/inzenden', supplierAuth, metOrg((req, o) => appstore.inzenden({
    inzender: { soort: 'medewerker',
      id: req.actor && req.actor.staffId ? 'staff:' + req.supplier.code + ':' + req.actor.staffId
        : (req.actor && req.actor.lidKey ? req.actor.lidKey : null),
      naam: req.actor ? req.actor.name : null },
    org: o.org, manifest: req.body.manifest, bestanden: req.body.bestanden })));

  // de eigen app terugtrekken: dat wacht niet op een kantoor
  /* mutatie: idempotent -- twee keer intrekken laat dezelfde stand achter */
  app.post('/api/appstore/uitgever/intrekken', supplierAuth, metOrg((req, o) => appstore.intrekken({
    sleutel: req.body.sleutel, reden: req.body.reden, door: (req.actor && req.actor.name) || 'de uitgever', doorOrg: o.org })));

  /* Het eigen journaal: wat er met MIJN inzendingen is gebeurd. Een uitgever zag
     tot nu toe alleen de stand van een versie en niet wat er onderweg gebeurde --
     wie er wanneer naar keek, waarop de machine aansloeg, wanneer een mens
     aftekende. Dat is zijn eigen informatie en die hoort hij te kunnen lezen. */
  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/uitgever/journaal', supplierAuth, metOrg((req, o) => ({
    status: 200, lijst: appstore.journaalVan(o.org, req.body && req.body.n)
  })));

  /* De cijfers over de eigen apps. Tellingen van aanroepen, uitgesplitst naar
     foutcode -- want dat is wat een uitgever kan repareren. Nooit een lid: de
     meter heeft er niet eens een parameter voor (kern/appstore/meting.js). */
  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/uitgever/cijfers', supplierAuth, metOrg((req, o) => {
    const mijn = appstore.uitgeverApps ? appstore.uitgeverApps(o.org) : [];
    return { status: 200, apps: appstoreBrug.meting.cijfersVan(mijn, req.body && req.body.dagen) };
  }));

  /* Het naslagwerk: de methodes, de machtigingen, de grenzen, de foutcodes en
     wat er BEWUST niet is. Dezelfde bron als `rtg sdk` gebruikt
     (kern/appstore/naslag.js), zodat het scherm en de gegenereerde typings niet
     uiteen kunnen lopen. */
  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/naslag', supplierAuth, (req, res) =>
    res.json(require('../../kern/appstore/naslag').naslag()));

  /* De proefkeuring: dezelfde machinepoort, zonder dat er iets wordt bewaard.
     Hij bestaat omdat de rem op inzenden (twaalf per uur) anders het leren
     tegenhoudt -- en een uitgever die niet kan leren, zendt slechte bundels in. */
  /* mutatie: idempotent -- de proefkeuring bewaart niets */
  app.post('/api/appstore/uitgever/proef', supplierAuth, metOrg((req, o) => {
    const r = appstore.proef({ manifest: req.body.manifest, bestanden: req.body.bestanden });
    return Object.assign({ status: 200 }, r);
  }));

  /* Wat mijn verkopen hebben opgeleverd: aantallen en bedragen, nooit wie. Een
     uitgever hoort niet te kunnen zien welk lid zijn app kocht -- ook niet op
     codenaam, want een codenaam plus een tijdstip is een spoor. */
  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/uitgever/omzet', supplierAuth, metOrg((req, o) => {
    if (!appstore.geld) return { status: 503, error: 'De betaallaag draait niet mee.', nietGebouwd: 'RTG Pay is in dit proces niet gemount.' };
    return Object.assign({ status: 200 }, appstore.geld.omzet(o.org));
  }));

  /* HET INKOOPDOSSIER VAN MIJN EIGEN APP, precies zoals een klant het leest.

     Waarom een uitgever dit mag zien: het dossier is het stuk waarop hij wordt
     afgerekend bij een inkoopgesprek, en hij kan er niets aan veranderen -- alles
     erin komt uit een meting of uit een besluit van RTG. Een leverancier die pas
     bij de klant ontdekt wat er over hem staat, kan er niet op reageren; een die
     het vooraf leest, kan zijn bundel aanpassen.

     ALLEEN DE EIGEN APP, en die controle staat hier en niet in de kern: welke
     apps van wie zijn is een vraag van de POORT en geen eigenschap van het
     dossier. Precies dezelfde regel als bij /voorbeeld hieronder. */
  app.post('/api/appstore/uitgever/dossier', supplierAuth, metOrg((req, o) => {
    const a = appstore.app(req.body.sleutel);
    if (!a || a.org !== o.org) return { status: 404, error: 'Deze app is niet van jou.' };
    const d = appstore.dossier(a.sleutel);
    if (d.error) return d;
    return Object.assign({}, d, { kanaal: appstore.kanaal(),
      let: 'Dit is woord voor woord wat een klant leest. Je kunt er niets aan veranderen: elk gegeven komt uit een meting op je bundel of uit een besluit van RTG. Wat er onder nietGebouwd staat, staat er bij elke app -- ook bij die van je concurrent.' });
  }));

  // wat een lid straks te zien krijgt bij een van mijn apps
  app.post('/api/appstore/uitgever/voorbeeld', supplierAuth, metOrg((req, o) => {
    const a = appstore.app(req.body.sleutel);
    if (!a || a.org !== o.org) return { status: 404, error: 'Deze app is niet van jou.' };
    const kaart = appstoreWinkel.catalogus({ zoek: '' }, null).items.find(x => x.sleutel === a.sleutel);
    return { status: 200, kaart: kaart || null, nietGebouwd: kaart ? undefined : 'Deze app staat niet live; er is dus nog geen winkelkaart om te tonen.' };
  }));
};
