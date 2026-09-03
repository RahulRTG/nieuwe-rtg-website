/* ============================================================================
   RTG SERVICE, DE KANT VAN EEN ZAAK -- de ingang die er niet was.

   HET GAT. Een leverancier, restaurant, vervoerder, gemeente of ontwikkelpartner
   kon RTG nergens een hulpvraag stellen. Er was wel een zin: routes/supplier/
   abonnement.js vertelt of er een vaste contactpersoon is. Maar een ZIN is geen
   kanaal -- er was geen enkele route waarlangs een zaak iets kon melden, en de
   enige verbinding met het kantoor (sseToOffice) wordt uitsluitend voor
   order-sync gebruikt.

   Wat er tegenover een gast wel bestond -- routes/gast/verzoek.js, waarmee
   iemand aan tafel om iets kan vragen -- bestond richting RTG dus niet.

   HET SYSTEEM WEET WIE ER MELDT, EN VRAAGT DAT DUS NIET. Er staat hieronder
   nergens "wat is uw klantnummer": de zaakcode komt uit de sessie
   (supplierAuth), de doelgroep wordt hier gezet en niet door de client, en de
   routering brengt hem daarmee bij het zakelijke team. Een zaak die zijn eigen
   nummer moet opzoeken om hulp te vragen, is een zaak die het niet doet.

   DRIE DINGEN DIE DEZE ROUTES NIET DOEN.

   1. Ze zetten de doelgroep niet uit het lichaam. Een melder die zelf mag zeggen
      dat hij een organisatie is, routeert zichzelf naar een ander team.
   2. Ze openen niets. Ook hier is `betrokken` een verwijzing, en gegevens vragen
      een machtiging met een bevestiging erop -- een zaak bevestigt op precies
      dezelfde manier als een lid.
   3. Ze beloven geen pas-dienst. Een zaak heeft geen pas; De Rechterhand komt
      hier niet voor, en kern/service/mens.js leest dat uit de DOELGROEP van de
      zaak zodat het hier niet nog eens hoeft te worden opgeschreven.

   DE MELDERSLEUTEL IS `zaak-<code>` EN NIET DE KALE CODE. Leden dragen
   `user-<id>`; zonder voorvoegsel zou een zaakcode die toevallig op een
   ledensleutel lijkt bij het verkeerde dossier uitkomen. Het voorvoegsel maakt
   de twee soorten melders uit elkaar te houden op de plek waar het telt: het
   filter dat bepaalt wiens zaken u ziet. */
module.exports = (kern) => {
  const { app, supplierAuth, serviceZaken, serviceLoop, serviceBevestiging, serviceKeuzes, serviceMens,
    servicePersoonlijk } = kern;

  const veilig = (res, werk) => {
    try { const r = werk(); res.status(r && r.status ? r.status : 200).json(r); }
    catch (e) { console.error('[service-zaak]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };
  const lijf = (req) => req.body || {};
  const kort = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const melder = (req) => 'zaak-' + String((req.supplier && req.supplier.code) || '');

  /* Wat er te kiezen valt. `mens` gaat mee zodat het scherm van de zaak kan
     zeggen naar WIE hij wordt doorgezet, en niet "een medewerker" moet gokken. */
  app.post('/api/supplier/service/keuzes', supplierAuth, (req, res) => veilig(res, () =>
    Object.assign({ ok: true }, serviceKeuzes(), { mens: serviceMens.overnameZaak() })));

  app.post('/api/supplier/service/open', supplierAuth, (req, res) => veilig(res, () => {
    const b = lijf(req);
    return serviceZaken.open({
      melder: melder(req),
      /* HIER, en niet uit het lichaam. Zie de kop. */
      doelgroep: 'zaak',
      soort: kort(b.soort, 30),
      onderwerp: kort(b.onderwerp, 30),
      kanaal: 'app',
      titel: kort(b.titel, 200),
      tekst: kort(b.tekst, 4000),
      betrokken: b.betrokken,
      termen: { impact: b.impact, geld: b.geld, urgentie: b.urgentie },
      bron: 'zaak'
    });
  }));

  app.post('/api/supplier/service/mijn', supplierAuth, (req, res) => veilig(res, () =>
    ({ ok: true, zaken: serviceZaken.lijst({ melder: melder(req), max: 50 }) })));

  /* Alleen de eigen zaken. De controle staat hier en niet in de kern: de kern
     bedient ook het kantoor, en dat mag wel alles zien. */
  app.post('/api/supplier/service/zaak', supplierAuth, (req, res) => veilig(res, () => {
    const z = serviceZaken.vind(kort(lijf(req).id, 40));
    if (!z || z.melder !== melder(req)) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    return serviceZaken.dossier(z.id, { voorMelder: true });
  }));

  app.post('/api/supplier/service/bericht', supplierAuth, (req, res) => veilig(res, () => {
    const z = serviceZaken.vind(kort(lijf(req).id, 40));
    if (!z || z.melder !== melder(req)) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    return serviceLoop.bericht(z.id, { van: 'melder', tekst: kort(lijf(req).tekst, 4000) });
  }));

  app.post('/api/supplier/service/mens', supplierAuth, (req, res) => veilig(res, () => {
    const z = serviceZaken.vind(kort(lijf(req).id, 40));
    if (!z || z.melder !== melder(req)) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    return serviceLoop.mensVraag(z.id, { tekst: kort(lijf(req).tekst, 500) });
  }));

  /* ------------------------------------------------------- bevestigingen -- */
  /* Een zaak bevestigt op precies dezelfde manier als een lid, en dat is geen
     gemak maar de bedoeling: wie de omgeving van een klant in wil, vraagt daar
     toestemming voor, met de reden en de bevoegdheden zichtbaar. Vergelijk
     kern/command/bijstand.js -- daar is toegang ook een uitnodiging en geen recht. */
  app.post('/api/supplier/service/bevestigingen', supplierAuth, (req, res) => veilig(res, () =>
    ({ ok: true, verzoeken: serviceBevestiging.voorLid(melder(req)),
      let: 'Een verzoek geldt ' + serviceBevestiging.MINUTEN + ' minuten en werkt een keer. ' +
        'RTG vraagt u dit nooit per e-mail of buiten uw werkplek om.' })));

  app.post('/api/supplier/service/bevestig', supplierAuth, (req, res) => veilig(res, () =>
    serviceBevestiging.bevestig(kort(lijf(req).id, 40), { melder: melder(req), via: 'werkplek' })));

  app.post('/api/supplier/service/weiger', supplierAuth, (req, res) => veilig(res, () =>
    serviceBevestiging.weiger(kort(lijf(req).id, 40), { melder: melder(req) })));

  /* De persoonlijke stand werkt ongewijzigd voor een zaak: hij leest de eigen
     lopende zaken en de storingen die daaraan gekoppeld zijn. En hij belooft ook
     hier niet dat alles werkt -- beschikbaarheid wordt niet per zaak gemeten. */
  app.post('/api/supplier/service/stand', supplierAuth, (req, res) => veilig(res, () =>
    servicePersoonlijk.stand(melder(req))));
};
