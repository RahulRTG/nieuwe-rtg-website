/* ============================================================================
   RTG SERVICE, DE KANT VAN HET KANTOOR -- zaakgericht, niet wereldgericht.

   DE POORT IS DIE VAN DE LEDENBALIE, EN DAT IS EEN BESLUIT. Er komt geen vierde
   kantoorpoort bij. Werk aan de zaak van een lid raakt zijn account, en dat mag
   niet achter de gedeelde kantoorcode die niemand aanwijst -- exact de redenering
   uit routes/ledenbalie.js. Wie een zetel heeft, werkt hier; wie er geen heeft,
   krijgt de reden te horen in plaats van "geen toegang".

   GEEN ZOEKBALK OVER DE WERELD. Deze routes werken op een ZAAK. Een medewerker
   opent SUP-81929 en krijgt wat bij SUP-81929 hoort -- niet een veld waarin hij
   elk lid kan opzoeken en alles kan opendoen. Vrije inzage bestaat nog steeds,
   maar loopt langs de bestaande balieroutes met hun reden en hun journaalregel.
   Dat onderscheid is de reden dat deze laag er is.

   EN HET SCHERM VAN DE MEDEWERKER OPENT NIETS UIT ZICHZELF. Een zaak zegt dat
   hij over PAY-829192 gaat; wat daarin staat vraagt een machtiging, en die
   vraagt een bevestiging van het lid (kern/service/bevestiging.js). De code van
   die bevestiging staat met opzet NIET in deze antwoorden. */
module.exports = (kern) => {
  const { app, officeAuth, boardroomWie, magBalie,
    serviceZaken, serviceLoop, serviceMachtiging, serviceBevestiging, serviceKeuzes,
    serviceFoutsignaal, findSupplier } = kern;

  /* WIE MELDT DIT, ALS HET GEEN LID IS. Een zaak hoeft zijn eigen nummer niet op
     te zoeken om hulp te vragen: de melder draagt `zaak-<code>`, en dat is genoeg
     om te weten met wie u praat.

     Veld voor veld en nooit publicSupplier(): dat is de KLANTweergave, met
     menu's, foto's, kamers en evenementen erin. Een medewerker die een storing
     onderzoekt heeft daar niets aan, en alles wat hier binnenkomt is meteen ook
     alles wat er in de wachtrij te zien is. Vijf velden, en de partnerstand
     erbij omdat een geschorste zaak een ander gesprek is. */
  function zaakprofiel(melder) {
    const m = String(melder || '');
    if (!m.startsWith('zaak-') || typeof findSupplier !== 'function') return null;
    const code = m.slice(5);
    let s = null;
    try { s = findSupplier(code); } catch (e) { s = null; }
    if (!s) return { code, gevonden: false, let: 'Deze zaakcode kennen wij niet meer; de melding blijft staan.' };
    return { code: s.code, naam: s.name || null, soort: s.type || null, stad: s.city || null,
      partnerStand: s.partnerStatus || 'actief', gevonden: true };
  }

  const veilig = (res, werk) => {
    try { const r = werk(); res.status(r && r.status ? r.status : 200).json(r); }
    catch (e) { console.error('[service-kantoor]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };
  const lijf = (req) => req.body || {};
  const kort = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

  /* Dezelfde drie grendels als de ledenbalie, in dezelfde volgorde en om
     dezelfde reden: een kantoorsessie, een MENS erachter, en een zetel. De
     weigering legt uit wat er ontbreekt -- een medewerker met een geldige
     kantoorcode hoort niet te hoeven raden wat hij verkeerd doet. */
  function balieAuth(req, res, next) {
    const key = boardroomWie(req);
    if (!magBalie(key)) {
      return res.status(403).json({ error: 'RTG Service vraagt een zetel op naam. De gedeelde kantoorcode opent wel de ruimte, maar wijst niemand aan, en werk aan de zaak van een lid hoort herleidbaar te zijn tot een mens. De eigenaar deelt de zetels uit.' });
    }
    req.balieKey = key;
    next();
  }

  /* De wachtrij. Niet een lijst maar een gefilterde: per team, per stand, en met
     de tellingen erbij die zeggen waar het schuurt. `zonderEigenaar` staat er
     apart omdat dat de enige soort zaak is die vanzelf blijft liggen. */
  app.post('/api/office/service/wachtrij', officeAuth, balieAuth, (req, res) => veilig(res, () => {
    const b = lijf(req);
    return { ok: true,
      zaken: serviceZaken.lijst({ team: kort(b.team, 30), soort: kort(b.soort, 30),
        alleenOpen: b.alles !== true, mensGevraagd: b.mensGevraagd === true, max: 100 }),
      tel: serviceZaken.tel(), keuzes: serviceKeuzes() };
  }));

  app.post('/api/office/service/zaak', officeAuth, balieAuth, (req, res) => veilig(res, () => {
    const r = serviceZaken.dossier(kort(lijf(req).id, 40));
    if (r.error) return r;
    /* De machtigingen bij deze zaak gaan mee: een medewerker hoort te zien wat
       er al openstaat voordat hij iets nieuws vraagt, en wat er van hemzelf
       nog geldig is. */
    /* EN OF DIT EEN INDIVIDUEEL PROBLEEM IS. Kwam de melding van een scherm
       waarop iets kapot is, dan hoort een medewerker dat te zien VOORDAT hij
       gaat uitleggen dat het aan de browser van dit lid ligt. Alleen bij een
       schermverwijzing: bij een betaling of een bestelling zegt een clientfout
       niets. */
    const b = r.zaak.betrokken;
    return Object.assign(r, {
      zaakprofiel: zaakprofiel(r.zaak.melder),
      machtigingen: serviceMachtiging.lijst({ zaak: r.zaak.id, max: 20 }),
      bevestigingen: serviceBevestiging.lijst({ zaak: r.zaak.id, max: 20 }),
      foutsignalen: (b && b.soort === 'scherm') ? serviceFoutsignaal.bijScherm(b.code) : []
    });
  }));

  app.post('/api/office/service/bericht', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    serviceLoop.bericht(kort(lijf(req).id, 40), { van: 'mens', tekst: kort(lijf(req).tekst, 4000), wie: req.balieKey })));

  app.post('/api/office/service/stand', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    serviceLoop.stand(kort(lijf(req).id, 40), kort(lijf(req).naar, 30), { door: req.balieKey, notitie: kort(lijf(req).notitie, 300) })));

  app.post('/api/office/service/eigenaar', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    serviceLoop.eigenaar(kort(lijf(req).id, 40), { wie: kort(lijf(req).wie, 60) || req.balieKey, door: req.balieKey })));

  /* De prioriteit overschrijven. De kern eist een reden; die staat er niet voor
     de vorm, maar omdat de berekening anders nooit te verbeteren is -- zonder
     redenen weet niemand of hij structureel te laag of te hoog uitkomt. */
  app.post('/api/office/service/weeg', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    serviceLoop.weeg(kort(lijf(req).id, 40), { naar: kort(lijf(req).naar, 10), door: req.balieKey, reden: kort(lijf(req).reden, 500) })));

  /* Koppelen aan de laag die de BETEKENIS bezit: een klacht van de ledenbalie,
     een incident van RTG Command, een conciergeopdracht. De koppeling trekt
     niets over -- de klacht blijft van de balie. */
  app.post('/api/office/service/koppel', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    serviceLoop.koppel(kort(lijf(req).id, 40), { soort: kort(lijf(req).soort, 30), code: kort(lijf(req).code, 60), door: req.balieKey })));

  /* ------------------------------------------------------- bevestigingen -- */
  /* Om een bevestiging VRAGEN. De code komt hier niet terug: die staat in de app
     van het lid. Een medewerker die de code van zijn eigen scherm kan aflezen,
     bevestigt niets -- dan is de terugval een lege ceremonie. */
  app.post('/api/office/service/bevestiging/vraag', officeAuth, balieAuth, (req, res) => veilig(res, () => {
    const b = lijf(req);
    return serviceBevestiging.vraag({ zaakId: kort(b.id, 40), mens: req.balieKey,
      doel: kort(b.doel, 200), capabilities: b.capabilities, reden: kort(b.reden, 500) });
  }));

  /* De terugval: het lid leest zijn zes cijfers voor. Alleen geldig voor de
     medewerker die het verzoek deed, en een keer. */
  app.post('/api/office/service/bevestiging/code', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    serviceBevestiging.metCode(kort(lijf(req).code, 20), { mens: req.balieKey })));

  /* ---------------------------------------------------------- machtiging -- */
  /* De tweede handtekening onder zwaar werk. De kern weigert de aanvrager zelf;
     die controle staat daar en niet hier, zodat een tweede ingang hem niet kan
     omzeilen. */
  app.post('/api/office/service/machtiging/tekenbij', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    serviceMachtiging.tekenBij(kort(lijf(req).id, 40), { mens: req.balieKey, reden: kort(lijf(req).reden, 500) })));

  app.post('/api/office/service/machtiging/intrek', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    serviceMachtiging.trekIn(kort(lijf(req).id, 40), { door: req.balieKey })));

  app.post('/api/office/service/machtigingen', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    ({ ok: true, machtigingen: serviceMachtiging.lijst({ mens: req.balieKey, alleenGeldig: true, max: 50 }),
      tel: serviceMachtiging.tel() })));

  /* De borden die OVER zaken heen kijken -- patronen, bundelen, herstellen en
     foutsignalen -- staan in ./service-kantoor-borden.js. De naad ligt op een
     echte grens: hierboven werkt u AAN een zaak, daar kijkt u ERLANGS. Dat
     scheelt dit bestand bovendien de omvangsgrens van keuringsregel 13. */
  require('./service-kantoor-borden')(kern, { veilig, lijf, kort, balieAuth });
};
