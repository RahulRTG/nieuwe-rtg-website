/* Kantoren, deel "regie": de boardroom-schakelkast en wat RTG platformbreed
   bijstuurt -- functies aan/uit (globaal, per doelgroep, per genre, in EEN klik
   per fase of alles ineens), Rahuls karakteraanvulling, de geld-regie (pasprijzen,
   partnervergoeding, ledenvoordeel), de Mall-regie, de paniekkamer (knoppen
   worden voorstellen) en de wereldkaart. Afgesplitst uit kantoren/index.js. */
module.exports = (ctx) => {
  const { app, officeAuth, boardroomAuth, boardroomLijst, keyVanCodenaam, veilig, stuur, afdelingen, sseToOffice, db, save, kern,
    geldOverzicht, geldPasprijzen, geldPasprijsZet, geldCommissieZet, geldKortingZet } = ctx;

  /* De deur van de boardroom: alles hieronder loopt door de boardroom-poort
     (alleen de eigenaar, of wie van hem de sleutel kreeg). Het overige
     kantoor blijft op de gewone office-inlog werken. */
  app.post('/api/office/boardroom', boardroomAuth, (req, res) => veilig(res, () => ({ status: 200, ...afdelingen.boardroom(), baas: !!req.boardroomBaas })));

  /* De sleutel van de kamer: de eigenaar geeft toegang op codenaam en trekt
     hem ook weer in. De lijst toont alleen codenamen; namen blijven in de kluis. */
  app.post('/api/office/boardroom/toegang', boardroomAuth, (req, res) => veilig(res, () =>
    ({ status: 200, ok: true, baas: !!req.boardroomBaas, lijst: boardroomLijst().map(t => ({ codenaam: t.codenaam, sinds: t.at })) })));
  app.post('/api/office/boardroom/toegang/geef', boardroomAuth, async (req, res) => {
    try {
      if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar geeft boardroom-toegang.' });
      const t = await keyVanCodenaam(req.body.codenaam);
      if (!t) return res.status(404).json({ error: 'Deze codenaam kennen we niet.' });
      const lijst = boardroomLijst();
      if (!lijst.some(x => x.key === t.key)) {
        lijst.push({ key: t.key, codenaam: t.codename, at: new Date().toISOString() });
        save();
        afdelingen.audit('eigenaar', 'Boardroom-toegang gegeven aan ' + t.codename);
      }
      res.json({ ok: true, lijst: lijst.map(x => ({ codenaam: x.codenaam, sinds: x.at })) });
    } catch (e) { console.error('[boardroom]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/boardroom/toegang/weg', boardroomAuth, (req, res) => veilig(res, () => {
    if (!req.boardroomBaas) return { status: 403, error: 'Alleen de eigenaar trekt boardroom-toegang in.' };
    const wie = String(req.body.codenaam || '').trim().toLowerCase();
    const lijst = boardroomLijst();
    const rest = lijst.filter(x => String(x.codenaam || '').toLowerCase() !== wie);
    if (rest.length !== lijst.length) {
      db.data.boardroomToegang = rest;
      save();
      afdelingen.audit('eigenaar', 'Boardroom-toegang ingetrokken van ' + req.body.codenaam);
    }
    return { status: 200, ok: true, lijst: rest.map(x => ({ codenaam: x.codenaam, sinds: x.at })) };
  }));
  app.post('/api/office/boardroom/schakel', boardroomAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakel(String(req.body.functie || ''), req.body.aan === true, req.body.doelgroep ? String(req.body.doelgroep) : null, req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
  app.post('/api/office/boardroom/verbeter', boardroomAuth, (req, res) => veilig(res, () => ({ ok: true, verbeterkamer: afdelingen.voorstellen(true) })));
  // de leveranciers-regie: een functie per genre zaken open of dicht
  app.post('/api/office/boardroom/genre', boardroomAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakelGenre(String(req.body.functie || ''), String(req.body.genre || ''),
      req.body.aan === true, req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
  // de grote hendel: alles bij iedereen beschikbaar zetten of sluiten (intern blijft open)
  app.post('/api/office/boardroom/alles', boardroomAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakelAlles(req.body.aan === true, req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
  // de uitrolfases: in EEN klik de hele kast in de stand van een fase
  app.post('/api/office/boardroom/fase', boardroomAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakelFase(String(req.body.fase || ''), req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
  /* De AI-regie: de boardroom vult Rahuls karakter en verhaal aan. De
     vaste kern van het karakter blijft in de code staan (bewaakt door de
     drift-tests); deze aanvullingen komen live in ELKE assistent mee. */
  app.post('/api/office/boardroom/rahul', boardroomAuth, (req, res) => {
    res.json({ ok: true, profiel: db.data.rahulProfiel || { karakter: '', verhaal: '' } });
  });
  app.post('/api/office/boardroom/rahul/zet', boardroomAuth, (req, res) => {
    const kort = v => String(v == null ? '' : v).trim().slice(0, 2000);
    db.data.rahulProfiel = { karakter: kort(req.body.karakter), verhaal: kort(req.body.verhaal), at: new Date().toISOString() };
    save();
    sseToOffice('sync', { scope: 'boardroom' });
    res.json({ ok: true, profiel: db.data.rahulProfiel });
  });

  /* De Mall-regie: vanuit de boardroom elke leverancier in de RTG Mall bijstellen
     of verbergen (etage, tagline, actie). Het eigen-merk beheert RTG apart. */
  app.post('/api/office/mall', officeAuth, (req, res) => veilig(res, () => kern.mall.beheer()));
  app.post('/api/office/mall/zet', boardroomAuth, (req, res) => veilig(res, () => {
    const r = kern.mall.beheerZet(String(req.body.code || ''), req.body.patch || req.body || {});
    if (r.ok) sseToOffice('sync', { scope: 'mall' });
    return r;
  }));

  /* De geld-regie: RTG bepaalt de pasprijzen, de partnervergoeding (per genre
     of per zaak) en het ledenvoordeel per genre. De pasprijzen zijn publiek:
     wat hier gezet wordt is meteen overal het geldende bedrag. */
  app.post('/api/pasprijzen', (req, res) => stuur(res, geldPasprijzen()));
  app.get('/api/pasprijzen', (req, res) => stuur(res, geldPasprijzen()));
  app.post('/api/office/geld', boardroomAuth, (req, res) => veilig(res, () => geldOverzicht()));
  app.post('/api/office/geld/pasprijs', boardroomAuth, (req, res) => veilig(res, () => {
    const r = geldPasprijsZet(req.body || {});
    if (r.ok) afdelingen.audit(req.body.naam || 'boardroom', 'Pasprijs ' + r.pas + ' gezet op € ' + (r.maandCenten / 100).toFixed(2) + ' per maand (ex btw)');
    return r;
  }));
  app.post('/api/office/geld/commissie', boardroomAuth, (req, res) => veilig(res, () => {
    const r = geldCommissieZet(req.body || {});
    if (r.ok) afdelingen.audit(req.body.naam || 'boardroom', 'Partnervergoeding ' + (r.code || r.genre) + ' gezet op ' + (r.rate * 100).toFixed(1) + '%');
    return r;
  }));
  // de betaaldienst: het tarief dat per kassabetaling DIRECT met de zaak wordt verrekend
  app.post('/api/office/geld/betaaldienst', boardroomAuth, (req, res) => veilig(res, () =>
    (req.body && (req.body.vastCenten != null || req.body.pct != null))
      ? kern.geldBetaaldienstZet(req.body) : { status: 200, ok: true, ...kern.geldBetaaldienst() }));
  app.post('/api/office/geld/korting', boardroomAuth, (req, res) => veilig(res, () => {
    const r = geldKortingZet(req.body || {});
    if (r.ok) afdelingen.audit(req.body.naam || 'boardroom', 'Ledenvoordeel ' + r.genre + ' gezet op ' + r.pct + '%');
    return r;
  }));

  /* De eigen-AI-dataset: het bord (hoeveel records per bron) en de knop die
     alles als JSONL-bestand bewaart. Op codenamen; de kluis blijft dicht.
     Elke export komt in het auditlog. */
  app.post('/api/office/aidata', officeAuth, (req, res) => veilig(res, () => kern.aidataOverzicht()));
  app.post('/api/office/aidata/export', boardroomAuth, (req, res) => {
    try {
      const r = kern.aidataExport();
      afdelingen.audit(req.body.naam || 'boardroom', 'AI-dataset geexporteerd: ' + r.aantal + ' records (JSONL)');
      res.setHeader('Content-Type', 'application/jsonl; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="rtg-ai-dataset-' + new Date().toISOString().slice(0, 10) + '.jsonl"');
      res.send(r.jsonl);
    } catch (e) { console.error('[aidata]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  // de paniekkamer: knoppen worden voorstellen; de boardroom besluit
  app.post('/api/office/paniek', officeAuth, (req, res) => veilig(res, () => afdelingen.paniekLijst()));
  app.post('/api/office/paniek/stel', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.paniekStel({ functie: String(req.body.functie || ''), aan: req.body.aan === true, doelgroep: req.body.doelgroep ? String(req.body.doelgroep) : null, reden: req.body.reden });
    if (r.ok) sseToOffice('sync', { scope: 'paniek' });
    return r;
  }));
  app.post('/api/office/paniek/besluit', boardroomAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.paniekBesluit(String(req.body.id || ''), String(req.body.besluit || ''));
    if (r.ok) sseToOffice('sync', { scope: 'paniek' });
    return r;
  }));
  app.post('/api/office/paniek/bericht', officeAuth, (req, res) => veilig(res, () => afdelingen.paniekBericht(String(req.body.id || ''), String(req.body.wie || ''), req.body.tekst)));

  // de wereld: alles in het veld als bolletje (groen oke, oranje uit, rood
  // storing), met reset- en hulpknoppen; elke knop komt in het auditlog
  app.post('/api/office/wereld', officeAuth, (req, res) => veilig(res, () => afdelingen.wereld()));
  app.post('/api/office/wereld/actie', boardroomAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.wereldActie(String(req.body.id || ''), String(req.body.actie || ''), req.body.naam);
    if (r.ok) sseToOffice('sync', { scope: 'wereld' });
    return r;
  }));
};
