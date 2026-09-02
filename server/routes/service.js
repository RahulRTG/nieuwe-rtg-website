/* ============================================================================
   RTG SERVICE, DE KANT VAN DE MELDER -- een voordeur, geen wachtrij.

   Er is een ingang, en die weet waar de melder vandaan komt. Wie vanuit een
   betaling om hulp vraagt, hoeft niet te horen "waarmee kunnen wij u helpen?"
   terwijl het systeem al weet dat hij naar PAY-829192 kijkt. Daarom draagt
   /api/service/open een `betrokken` mee: een SOORT en een CODE, meer niet -- de
   kern gooit al het andere weg (kern/service/zaak.js, verwijzing()).

   WAT HIER NIEUW IS EN WAAROM HET ERTOE DOET. Tot vandaag kon een lid geen
   supportzaak beginnen. Een klacht bestond alleen als een medewerker van het
   kantoor hem noteerde nadat hij het lid had opgezocht, en de chat van de RTG
   Pass zette `needsConcierge` hard op false. Er was dus wel een mens, en de
   melder was de enige die niet bij hem kon. /api/service/mens is het herstel
   daarvan, en kern/service/mens.js draagt de regel.

   TWEE DINGEN DIE DEZE ROUTES NIET DOEN:
   - ze openen niets. Een zaak weet waarover hij gaat en leest die betaling niet
     uit; dat gebeurt pas met een machtiging, na een bevestiging van het lid;
   - ze beloven geen mens waar er geen is. Zonder account is het antwoord nee,
     met de reden erbij, en niet een zaak die in een wachtrij blijft staan. */
module.exports = (kern) => {
  const { app, auth, serviceZaken, serviceLoop, serviceBevestiging, serviceKeuzes, serviceMens } = kern;

  const veilig = (res, werk) => {
    try { const r = werk(); res.status(r && r.status ? r.status : 200).json(r); }
    catch (e) { console.error('[service]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };
  const lijf = (req) => req.body || {};
  const kort = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  /* De melder is de SESSIESLEUTEL. Geen naam, geen e-mailadres, geen id uit de
     kluis -- deze laag hoort een zaak te kunnen tonen zonder te weten wie hij
     voor zich heeft. Zelfde regel als in kern/ledenbalie.js. */
  const melder = (req) => (req.session && req.session.key) || null;

  /* Wat er te kiezen valt, afgeleid uit kern/service/klassen.js. Inclusief de
     kanalen die er NOG NIET zijn, met hun reden: een scherm dat alleen toont wat
     bestaat, laat de lezer denken dat de rest niet kan in plaats van dat hij
     nog niet is aangesloten. */
  app.post('/api/service/keuzes', auth, (req, res) => veilig(res, () =>
    Object.assign({ ok: true }, serviceKeuzes(), {
      mens: serviceMens.overname(req.session.tier)
    })));

  /* Een zaak openen. De doelgroep wordt hier bepaald en niet door de client
     meegegeven: een melder die zelf mag zeggen dat hij een organisatie is,
     routeert zichzelf naar een ander team. */
  app.post('/api/service/open', auth, (req, res) => veilig(res, () => {
    const b = lijf(req);
    return serviceZaken.open({
      melder: melder(req),
      doelgroep: req.session.supplier ? 'zaak' : 'lid',
      soort: kort(b.soort, 30),
      onderwerp: kort(b.onderwerp, 30),
      kanaal: 'app',
      titel: kort(b.titel, 200),
      tekst: kort(b.tekst, 4000),
      betrokken: b.betrokken,
      /* De melder weegt zichzelf NIET. Wat hij aanlevert is wat hij weet -- dat
         hij er niet bij kan, of dat er geld vaststaat -- en de weging gebeurt in
         kern/service/prioriteit.js. Zou de melder de prioriteit kiezen, dan
         meet de wachtrij binnen een half jaar welbespraaktheid. */
      termen: { impact: b.impact, geld: b.geld, urgentie: b.urgentie },
      bron: 'lid'
    });
  }));

  app.post('/api/service/mijn', auth, (req, res) => veilig(res, () =>
    ({ ok: true, zaken: serviceZaken.lijst({ melder: melder(req), max: 50 }) })));

  /* Een zaak met zijn tijdlijn. Alleen die van de melder zelf: de controle
     staat hier en niet in de kern, want de kern kent het kantoor ook -- en dat
     mag wel alles zien. */
  app.post('/api/service/zaak', auth, (req, res) => veilig(res, () => {
    const z = serviceZaken.vind(kort(lijf(req).id, 40));
    if (!z || z.melder !== melder(req)) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    return serviceZaken.dossier(z.id, { voorMelder: true });
  }));

  app.post('/api/service/bericht', auth, (req, res) => veilig(res, () => {
    const z = serviceZaken.vind(kort(lijf(req).id, 40));
    if (!z || z.melder !== melder(req)) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    return serviceLoop.bericht(z.id, { van: 'melder', tekst: kort(lijf(req).tekst, 4000) });
  }));

  /* "IK WIL EEN MENS." Dit is de route die het contract waarmaakt. Hij weigert
     alleen als er voor deze melder werkelijk geen mens bestaat, en zegt dan
     waarom -- hij weigert nooit omdat de AI het liever zelf zou proberen. */
  app.post('/api/service/mens', auth, (req, res) => veilig(res, () => {
    const z = serviceZaken.vind(kort(lijf(req).id, 40));
    if (!z || z.melder !== melder(req)) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    return serviceLoop.mensVraag(z.id, { tier: req.session.tier, tekst: kort(lijf(req).tekst, 500) });
  }));

  /* ------------------------------------------------------- bevestigingen -- */
  /* Wat er in de app klaarstaat om te bevestigen: welke medewerker, voor welke
     zaak, waarvoor, en wat hij daarmee opent. Met de terugvalcode erbij -- die
     hoort HIER en niet op het scherm van de medewerker, anders kan hij hem
     aflezen zonder ooit iemand te spreken. */
  app.post('/api/service/bevestigingen', auth, (req, res) => veilig(res, () =>
    ({ ok: true, verzoeken: serviceBevestiging.voorLid(melder(req)),
      let: 'Een verzoek geldt ' + serviceBevestiging.MINUTEN + ' minuten en werkt een keer. ' +
        'RTG vraagt u dit nooit per e-mail of buiten de app om.' })));

  app.post('/api/service/bevestig', auth, (req, res) => veilig(res, () =>
    serviceBevestiging.bevestig(kort(lijf(req).id, 40), { melder: melder(req), via: 'app' })));

  app.post('/api/service/weiger', auth, (req, res) => veilig(res, () =>
    serviceBevestiging.weiger(kort(lijf(req).id, 40), { melder: melder(req) })));
};
