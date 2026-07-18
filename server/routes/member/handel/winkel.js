/* Member-handel (deelmodule): veilig laten bezorgen door de modewinkel, de groothandel en de digitale contracten.
   Gemount vanuit routes/member/handel.js op de gedeelde kern. */
module.exports = (hctx) => {
  const { kern, openLijn } = hctx;
  const { DOOR_RELOCK_MS, app, auth, betaal, crypto,
    db, express, findSupplier, liveCodename, logActivity,
    notifySupplier, optieAan, save, schoon, sseToSupplier,
    unlockDoor, reserveerTafel, mijnReserveringen, annuleerReservering, annuleerItem,
    plaatsReview, reviewsVoor, verblijfBoek, mijnVerblijven, verblijfAnnuleer,
    gastDeur, toggleFavoriet, favorietenVan, agendaVoor, maakSplits,
    mijnSplitsen, betaalSplits, zetOpWachtlijst, mijnWachtlijst, rsvpAnnuleer,
    puntenVan, verzilverPunten, salonZichtbaar, ghMarkt, ghPlaatsBestelling,
    ghMijnBestellingen, ghAnnuleer, mbAanvraag, mbMijn, zorgVoor, zorgContact } = kern;
/* ================== veilig laten bezorgen door een modewinkel ==================
   Een lid laat gekochte/apart-gelegde mode-artikelen thuisbezorgen. Veilig: een
   bezorgcode die je alleen aan de echte koerier geeft, live volgen, en bij dure
   stukken een ID-controle aan de deur (RTG-geverifieerd account vereist). */
app.post('/api/mode/bezorg/aanvraag', auth, express.json({ limit: '1mb' }), (req, res) => {
  const r = mbAanvraag(req.session.key, liveCodename(req.session), String(req.body.supplierCode || ''), req.body.items,
    { adres: req.body.adres, lat: req.body.lat, lng: req.body.lng });
  if (r.error) return res.status(r.status).json({ error: r.error });
  openLijn(findSupplier(req.body.supplierCode), req);
  res.json({ ok: true, bezorging: r.bezorging });
});
app.post('/api/mode/bezorg/mijn', auth, (req, res) => {
  res.json({ bezorgingen: mbMijn(req.session.key) });
});

/* ================== boodschappen bij de groothandel/supermarkt ==================
   Leden bestellen boodschappen bij een groothandel die de consument-functie
   aan heeft staan, en laten die bezorgen of halen ze af. */
app.post('/api/groothandel/markt', auth, (req, res) => {
  res.json({ groothandels: ghMarkt('lid', { zoek: req.body.zoek, categorie: req.body.categorie }) });
});
app.post('/api/groothandel/bestel', auth, (req, res) => {
  const koper = { soort: 'lid', id: req.session.key, naam: liveCodename(req.session) };
  const r = ghPlaatsBestelling(String(req.body.groothandelCode || ''), koper, req.body.regels, { bezorgen: req.body.bezorgen !== false });
  if (r.error) return res.status(r.status).json({ error: r.error });
  openLijn(findSupplier(req.body.groothandelCode), req);
  res.json({ ok: true, order: r.order });
});
app.post('/api/groothandel/mijn', auth, (req, res) => {
  res.json({ bestellingen: ghMijnBestellingen({ soort: 'lid', id: req.session.key }) });
});
app.post('/api/groothandel/annuleer', auth, (req, res) => {
  const r = ghAnnuleer({ soort: 'lid', id: req.session.key }, String(req.body.ref || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
});

/* ================== contracten: het lid tekent digitaal ================== */
app.post('/api/contracten/mijn', auth, (req, res) => {
  const mijn = db.data.contracten
    .filter(c => c.partij.kind === 'lid' && c.partij.key === req.session.key)
    .slice(0, 50)
    .map(c => ({ ref: c.ref, soort: c.soort, supplierName: c.supplierName, titel: c.titel, tekst: c.tekst,
      velden: c.velden || [], status: c.status, getekendDoorMij: !!c.tekenPartij, getekendDoorZaak: !!c.tekenZaak,
      at: c.at }));
  res.json({ contracten: mijn });
});

app.post('/api/contract/teken', auth, (req, res) => {
  const c = db.data.contracten.find(x => x.ref === String(req.body.ref || '') && x.partij.kind === 'lid' && x.partij.key === req.session.key);
  if (!c) return res.status(404).json({ error: 'Contract niet gevonden.' });
  if (c.status === 'geweigerd') return res.status(409).json({ error: 'Dit contract is al geweigerd.' });
  if (c.tekenPartij) return res.status(409).json({ error: 'U heeft dit contract al ondertekend.' });
  const naam = schoon(req.body.naam, 60);
  if (!naam || req.body.akkoord !== true) return res.status(400).json({ error: 'Typ uw naam en vink akkoord aan om te tekenen.' });
  c.tekenPartij = { naam, at: new Date().toISOString() };
  if (c.tekenZaak && c.tekenPartij) c.status = 'getekend';
  save();
  notifySupplier(c.supplierCode, { icon: '\u2713', title: 'Contract getekend', body: c.partij.codename + ' tekende: ' + c.titel });
  sseToSupplier(c.supplierCode, 'sync', { scope: 'contract' });
  res.json({ ok: true, status: c.status });
});

app.post('/api/contract/weiger', auth, (req, res) => {
  const c = db.data.contracten.find(x => x.ref === String(req.body.ref || '') && x.partij.kind === 'lid' && x.partij.key === req.session.key);
  if (!c) return res.status(404).json({ error: 'Contract niet gevonden.' });
  if (c.tekenPartij) return res.status(409).json({ error: 'U heeft dit contract al ondertekend.' });
  c.status = 'geweigerd';
  save();
  notifySupplier(c.supplierCode, { icon: '\u2715', title: 'Contract geweigerd', body: c.partij.codename + ' weigerde: ' + c.titel });
  sseToSupplier(c.supplierCode, 'sync', { scope: 'contract' });
  res.json({ ok: true });
});

/* ================== vastgoed: het lid ================== */
};
