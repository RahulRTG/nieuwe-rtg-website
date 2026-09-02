/* ============================================================================
   RTG SERVICE, DE BORDEN DIE OVER ZAKEN HEEN KIJKEN.

   ./service-kantoor.js is het werk AAN een zaak; dit zijn de borden die ERLANGS
   kijken: welke meldingen samen een storing lijken, wat er in browsers stukgaat,
   en wat er aan een incident hangt. Eigen bestand omdat de twee samen over de
   omvangsgrens van keuringsregel 13 gingen, met de naad op een echte grens.

   DE POORT KOMT MEE EN WORDT NIET NAGEBOUWD. `balieAuth` is dezelfde functie als
   hiernaast -- een tweede kopie zou op een dag een andere grens hanteren dan de
   eerste, en dat is precies de fout waar dit huis zich vaker op heeft gebrand.
   ========================================================================== */
module.exports = (kern, hulp) => {
  const { app, officeAuth, servicePatronen, serviceFoutsignaal } = kern;
  const { veilig, lijf, kort, balieAuth } = hulp;

  /* ------------------------------------------------------------ patronen -- */
  /* Twintig meldingen die hetzelfde zeggen. Dit LEEST alleen: er wordt niets
     gebundeld tot een mens het bevestigt, en de uitslag zegt altijd WAAROP de
     groep is gevormd -- anders is de drempel een orakel dat een maandagochtend
     voor een storing aanziet. */
  app.post('/api/office/service/patronen', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    ({ ok: true, vermoedens: servicePatronen.vermoedens(lijf(req)),
      incidenten: servicePatronen.perIncident(),
      let: 'Een vermoeden is een groep die iets DEELT. Wat zij delen is geen oorzaak.' })));

  /* Bundelen: de schaalwinst. Vanaf hier is het een technische oplossing en
     worden alle gekoppelde melders in een keer bijgewerkt. Het incidentnummer
     komt uit RTG Command; deze laag geeft er geen tweede reeks bij uit. */
  app.post('/api/office/service/bundel', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    servicePatronen.bundel(lijf(req).zaken, { incident: kort(lijf(req).incident, 60),
      door: req.balieKey, tekst: kort(lijf(req).tekst, 1000) })));

  /* Hersteld: iedereen die erop wachtte hoort het tegelijk. De zaken gaan NIET
     op opgelost -- dat een platformstoring weg is, bewijst niet dat het probleem
     van dit ene lid weg is. */
  app.post('/api/office/service/incident/hersteld', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    servicePatronen.hersteld(kort(lijf(req).incident, 60), { door: req.balieKey, tekst: kort(lijf(req).tekst, 1000) })));

  /* --------------------------------------------------------- foutsignalen -- */
  /* Gegroepeerd op vingerafdruk, niet per gebeurtenis: een scherm dat op elke
     render struikelt levert tienduizend meldingen, en tienduizend zaken is geen
     wachtrij meer. `gebruikers` staat er als null MET de reden -- de foutingang
     staat zonder inlog open en kent dus geen mensen om te tellen. */
  app.post('/api/office/service/foutsignalen', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    ({ ok: true, signalen: serviceFoutsignaal.lijst({ max: 50 }), tel: serviceFoutsignaal.tel() })));

  app.post('/api/office/service/foutsignaal/koppel', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    serviceFoutsignaal.koppel(kort(lijf(req).signaal, 40), kort(lijf(req).zaak, 40))));
};
