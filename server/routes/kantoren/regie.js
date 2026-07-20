/* Kantoren, deel "regie": de boardroom-schakelkast en wat RTG platformbreed
   bijstuurt -- functies aan/uit (globaal, per doelgroep, per genre, in EEN klik
   per fase of alles ineens), Rahuls karakteraanvulling, de geld-regie (pasprijzen,
   partnervergoeding, ledenvoordeel), de Mall-regie, de paniekkamer (knoppen
   worden voorstellen) en de wereldkaart. Afgesplitst uit kantoren/index.js. */
module.exports = (ctx) => {
  const { app, officeAuth, veilig, stuur, afdelingen, sseToOffice, db, save, kern,
    geldOverzicht, geldPasprijzen, geldPasprijsZet, geldCommissieZet, geldKortingZet } = ctx;

  app.post('/api/office/boardroom', officeAuth, (req, res) => veilig(res, () => afdelingen.boardroom()));
  app.post('/api/office/boardroom/schakel', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakel(String(req.body.functie || ''), req.body.aan === true, req.body.doelgroep ? String(req.body.doelgroep) : null, req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
  app.post('/api/office/boardroom/verbeter', officeAuth, (req, res) => veilig(res, () => ({ ok: true, verbeterkamer: afdelingen.voorstellen(true) })));
  // de leveranciers-regie: een functie per genre zaken open of dicht
  app.post('/api/office/boardroom/genre', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakelGenre(String(req.body.functie || ''), String(req.body.genre || ''),
      req.body.aan === true, req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
  // de grote hendel: alles bij iedereen beschikbaar zetten of sluiten (intern blijft open)
  app.post('/api/office/boardroom/alles', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakelAlles(req.body.aan === true, req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
  // de uitrolfases: in EEN klik de hele kast in de stand van een fase
  app.post('/api/office/boardroom/fase', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakelFase(String(req.body.fase || ''), req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
  /* De AI-regie: de boardroom vult Rahuls karakter en verhaal aan. De
     vaste kern van het karakter blijft in de code staan (bewaakt door de
     drift-tests); deze aanvullingen komen live in ELKE assistent mee. */
  app.post('/api/office/boardroom/rahul', officeAuth, (req, res) => {
    res.json({ ok: true, profiel: db.data.rahulProfiel || { karakter: '', verhaal: '' } });
  });
  app.post('/api/office/boardroom/rahul/zet', officeAuth, (req, res) => {
    const kort = v => String(v == null ? '' : v).trim().slice(0, 2000);
    db.data.rahulProfiel = { karakter: kort(req.body.karakter), verhaal: kort(req.body.verhaal), at: new Date().toISOString() };
    save();
    sseToOffice('sync', { scope: 'boardroom' });
    res.json({ ok: true, profiel: db.data.rahulProfiel });
  });

  /* De Mall-regie: vanuit de boardroom elke leverancier in de RTG Mall bijstellen
     of verbergen (etage, tagline, actie). Het eigen-merk beheert RTG apart. */
  app.post('/api/office/mall', officeAuth, (req, res) => veilig(res, () => kern.mall.beheer()));
  app.post('/api/office/mall/zet', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.mall.beheerZet(String(req.body.code || ''), req.body.patch || req.body || {});
    if (r.ok) sseToOffice('sync', { scope: 'mall' });
    return r;
  }));

  /* De geld-regie: RTG bepaalt de pasprijzen, de partnervergoeding (per genre
     of per zaak) en het ledenvoordeel per genre. De pasprijzen zijn publiek:
     wat hier gezet wordt is meteen overal het geldende bedrag. */
  app.post('/api/pasprijzen', (req, res) => stuur(res, geldPasprijzen()));
  app.get('/api/pasprijzen', (req, res) => stuur(res, geldPasprijzen()));
  app.post('/api/office/geld', officeAuth, (req, res) => veilig(res, () => geldOverzicht()));
  app.post('/api/office/geld/pasprijs', officeAuth, (req, res) => veilig(res, () => {
    const r = geldPasprijsZet(req.body || {});
    if (r.ok) afdelingen.audit(req.body.naam || 'boardroom', 'Pasprijs ' + r.pas + ' gezet op € ' + (r.maandCenten / 100).toFixed(2) + ' per maand (ex btw)');
    return r;
  }));
  app.post('/api/office/geld/commissie', officeAuth, (req, res) => veilig(res, () => {
    const r = geldCommissieZet(req.body || {});
    if (r.ok) afdelingen.audit(req.body.naam || 'boardroom', 'Partnervergoeding ' + (r.code || r.genre) + ' gezet op ' + (r.rate * 100).toFixed(1) + '%');
    return r;
  }));
  app.post('/api/office/geld/korting', officeAuth, (req, res) => veilig(res, () => {
    const r = geldKortingZet(req.body || {});
    if (r.ok) afdelingen.audit(req.body.naam || 'boardroom', 'Ledenvoordeel ' + r.genre + ' gezet op ' + r.pct + '%');
    return r;
  }));

  // de paniekkamer: knoppen worden voorstellen; de boardroom besluit
  app.post('/api/office/paniek', officeAuth, (req, res) => veilig(res, () => afdelingen.paniekLijst()));
  app.post('/api/office/paniek/stel', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.paniekStel({ functie: String(req.body.functie || ''), aan: req.body.aan === true, doelgroep: req.body.doelgroep ? String(req.body.doelgroep) : null, reden: req.body.reden });
    if (r.ok) sseToOffice('sync', { scope: 'paniek' });
    return r;
  }));
  app.post('/api/office/paniek/besluit', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.paniekBesluit(String(req.body.id || ''), String(req.body.besluit || ''));
    if (r.ok) sseToOffice('sync', { scope: 'paniek' });
    return r;
  }));
  app.post('/api/office/paniek/bericht', officeAuth, (req, res) => veilig(res, () => afdelingen.paniekBericht(String(req.body.id || ''), String(req.body.wie || ''), req.body.tekst)));

  // de wereld: alles in het veld als bolletje (groen oke, oranje uit, rood
  // storing), met reset- en hulpknoppen; elke knop komt in het auditlog
  app.post('/api/office/wereld', officeAuth, (req, res) => veilig(res, () => afdelingen.wereld()));
  app.post('/api/office/wereld/actie', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.wereldActie(String(req.body.id || ''), String(req.body.actie || ''), req.body.naam);
    if (r.ok) sseToOffice('sync', { scope: 'wereld' });
    return r;
  }));
};
