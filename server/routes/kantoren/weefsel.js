/* Kantoren, deel "weefsel": het stadsweefsel vanuit de boardroom.

   Het beeld (hoe groot is de stad, wat staat er open), de kaart, het
   objectregister met zijn onderhoudsstaat, de zaken met hun gedeelde oorzaken,
   de werkvoorraad, de tijdreeksen en de uitvalsimulatie. Alles achter de
   office-inlog; wat de stad VERANDERT (een object plaatsen, een zaak zetten,
   werk klaarmelden) gaat bovendien met naam het auditlog in, want dat zijn
   besluiten over de openbare ruimte.

   Wat hier NIET staat is een knop die iets in de fysieke wereld schakelt. De
   uitvalsimulatie rekent op het geregistreerde net en raakt niets; de
   scenario- en regimeknoppen van de stad staan in kantoren/stad.js en blijven
   daar. */
module.exports = (ctx) => {
  const { app, officeAuth, veilig, afdelingen, kern } = ctx;
  const w = kern.weefsel;
  const naam = req => (req.body && req.body.naam ? String(req.body.naam) : 'boardroom');

  // ---- kijken ----
  app.post('/api/office/weefsel', officeAuth, (req, res) => veilig(res, () => w.weefselBeeld()));
  app.post('/api/office/weefsel/kaart', officeAuth, (req, res) => veilig(res, () => w.weefselKaart({ gebied: req.body.gebied })));
  app.post('/api/office/weefsel/gebieden', officeAuth, (req, res) => veilig(res, () => w.weefselGebieden({ niveau: req.body.niveau })));
  app.post('/api/office/weefsel/plaats', officeAuth, (req, res) => veilig(res, () => w.weefselPlaats({ lat: req.body.lat, lng: req.body.lng })));
  app.post('/api/office/weefsel/objecten', officeAuth, (req, res) => veilig(res, () => w.weefselObjecten({
    soort: req.body.soort, gebied: req.body.gebied, status: req.body.status, risico: req.body.risico, beheerder: req.body.beheerder })));
  app.post('/api/office/weefsel/object', officeAuth, (req, res) => veilig(res, () => w.weefselObject({ id: req.body.id })));
  app.post('/api/office/weefsel/aandacht', officeAuth, (req, res) => veilig(res, () => w.weefselAandacht()));
  app.post('/api/office/weefsel/relaties', officeAuth, (req, res) => veilig(res, () => w.weefselRelaties({ objectId: req.body.objectId })));
  app.post('/api/office/weefsel/keten', officeAuth, (req, res) => veilig(res, () => w.weefselKeten({ id: req.body.id })));
  app.post('/api/office/weefsel/zaken', officeAuth, (req, res) => veilig(res, () => w.weefselZaken({
    status: req.body.status, categorie: req.body.categorie, gebied: req.body.gebied, ploeg: req.body.ploeg, alles: req.body.alles === true })));
  app.post('/api/office/weefsel/zaak', officeAuth, (req, res) => veilig(res, () => w.weefselZaak({ id: req.body.id })));
  app.post('/api/office/weefsel/werk', officeAuth, (req, res) => veilig(res, () => w.weefselWerklijst({
    ploeg: req.body.ploeg, gebied: req.body.gebied, organisatie: req.body.organisatie })));
  app.post('/api/office/weefsel/reeks', officeAuth, (req, res) => veilig(res, () => w.weefselReeks({
    sens: req.body.sens, gebied: req.body.gebied, laag: req.body.laag, vanaf: req.body.vanaf, tot: req.body.tot })));
  app.post('/api/office/weefsel/trend', officeAuth, (req, res) => veilig(res, () => w.weefselTrend({
    sens: req.body.sens, gebied: req.body.gebied, dagen: req.body.dagen })));

  /* De "wat als"-vraag: wat sleept dit object mee als het uitvalt. Rekent op
     het geregistreerde net en verandert niets -- daarom een kijk-route, geen
     auditregel. Het antwoord zegt er zelf bij dat het een berekening is. */
  app.post('/api/office/weefsel/uitval', officeAuth, (req, res) => veilig(res, () =>
    w.weefselUitval({ id: req.body.id, minuten: req.body.minuten })));

  // ---- veranderen: alles met naam in het auditlog ----
  app.post('/api/office/weefsel/object/maak', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselObjectMaak({ soort: req.body.soort, naam: req.body.objectNaam, lat: req.body.lat, lng: req.body.lng,
      eigenaar: req.body.eigenaar, beheerder: req.body.beheerder, bouwjaar: req.body.bouwjaar, waarde: req.body.waarde, conditie: req.body.conditie });
    if (r.ok) afdelingen.audit(naam(req), 'Stadsobject toegevoegd: ' + r.object.naam + ' (' + r.object.soort + ', ' + r.object.plaats + ')');
    return r;
  }));
  app.post('/api/office/weefsel/object/zet', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselObjectZet({ id: req.body.id, status: req.body.status, conditie: req.body.conditie, risico: req.body.risico, beheerder: req.body.beheerder });
    if (r.ok) afdelingen.audit(naam(req), 'Stadsobject bijgewerkt: ' + r.object.naam + ' -> status ' + r.object.status + ', conditie ' + r.object.conditie);
    return r;
  }));
  app.post('/api/office/weefsel/relatie/maak', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselRelatieMaak({ van: req.body.van, naar: req.body.naar, soort: req.body.soort, door: naam(req) });
    if (r.ok && !r.bestond) afdelingen.audit(naam(req), 'Stadsrelatie gelegd: ' + r.relatie.van + ' ' + r.relatie.soort + ' ' + r.relatie.naar);
    return r;
  }));
  app.post('/api/office/weefsel/relatie/weg', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselRelatieWeg({ id: req.body.id });
    if (r.ok) afdelingen.audit(naam(req), 'Stadsrelatie verwijderd: ' + req.body.id);
    return r;
  }));
  app.post('/api/office/weefsel/gebied/maak', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselGebiedMaak({ niveau: req.body.niveau, naam: req.body.gebiedNaam, ouder: req.body.ouder, punten: req.body.punten, soort: req.body.soort });
    if (r.ok) afdelingen.audit(naam(req), 'Stadsgebied toegevoegd: ' + r.gebied.naam + ' (' + r.gebied.niveau + ')');
    return r;
  }));

  /* Een waarneming vanuit het kantoor: de telefonist die een melding aanneemt,
     of een ambtenaar die zelf iets ziet. Zelfde motor, ander kanaal -- dus ook
     hier wordt een dubbele melding herkend in plaats van verdubbeld. */
  app.post('/api/office/weefsel/waarneming', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselWaarneming({ kanaal: req.body.kanaal || 'telefoon', categorie: req.body.categorie, tekst: req.body.tekst,
      lat: req.body.lat, lng: req.body.lng, gebied: req.body.gebied, objectId: req.body.objectId, bronRef: req.body.bronRef });
    if (r.ok) afdelingen.audit(naam(req), 'Stadszaak ' + r.zaak.ref + (r.duplicaat ? ' aangevuld' : ' geopend') + ': ' + r.zaak.omschrijving);
    return r;
  }));
  app.post('/api/office/weefsel/zaak/zet', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselZaakZet({ id: req.body.id, status: req.body.status, prioriteit: req.body.prioriteit, ploeg: req.body.ploeg, notitie: req.body.notitie, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Stadszaak ' + r.zaak.ref + ' -> ' + r.zaak.status + ' (' + r.zaak.prioriteit + ')');
    return r;
  }));
  app.post('/api/office/weefsel/werk/maak', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselWerkorderMaak({ zaakId: req.body.zaakId, objectId: req.body.objectId, omschrijving: req.body.omschrijving,
      soort: req.body.soort, ploeg: req.body.ploeg, organisatie: req.body.organisatie, prioriteit: req.body.prioriteit, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Werkorder ' + r.werkorder.id + ' aangemaakt: ' + r.werkorder.omschrijving);
    return r;
  }));
  app.post('/api/office/weefsel/werk/zet', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselWerkorderZet({ id: req.body.id, status: req.body.status, uitvoerder: req.body.uitvoerder, ploeg: req.body.ploeg, wie: naam(req) });
    if (r.ok) afdelingen.audit(naam(req), 'Werkorder ' + r.werkorder.id + ' -> ' + r.werkorder.status);
    return r;
  }));
  app.post('/api/office/weefsel/werk/klaar', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselWerkorderKlaar({ id: req.body.id, wie: naam(req), notitie: req.body.notitie, kosten: req.body.kosten, uren: req.body.uren });
    if (r.ok) afdelingen.audit(naam(req), 'Werkorder ' + r.werkorder.id + ' klaargemeld' +
      (r.werkorder.kosten ? ' (EUR ' + r.werkorder.kosten + ')' : '') + (r.zaakGesloten ? '; zaak ' + r.zaakGesloten + ' gesloten' : ''));
    return r;
  }));

  /* Het geheugen opruimen volgens de bewaartermijn. Handmatig aan te roepen
     naast de zelfveger, zodat "wat is er weg" een handeling met een naam is. */
  app.post('/api/office/weefsel/reeks/veeg', officeAuth, (req, res) => veilig(res, () => {
    const r = w.weefselReeksVeeg();
    afdelingen.audit(naam(req), 'Tijdreeksen opgeruimd: ' + r.verwijderd + ' emmer(s) over de bewaartermijn');
    return r;
  }));
};
