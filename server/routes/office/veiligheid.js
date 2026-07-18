/* Backoffice (deelmodule): Salon-ontmoetingen (SOS, live meekijken), de asset-pool en de Salon-naleving.
   Draait op de gedeelde kern; gemount vanuit routes/office.js. */
module.exports = (octx) => {
  const { kern, officeQueryMag } = octx;
  const { OFFICE_CODE, UPLOAD_DIR, accounts, app, appUrl, archief, broadcastSync, conciergeInbox, crypto, db, eigenaar, ensureSupplierDefaults, fs, loginFails, mail, makeSupplierCode, noteFailedTry, notify, notifySupplier, officeAuth, officeState, path, talen, trChat, pendingVerifications, rememberSession, save, schoon, sessionFor, sseClients, sseToOffice, sseToSupplier, tooManyTries, totpOk, veiligGelijk, logInlog, paspoortIncidenten, paspoortBeoordeel, salonProfielCompleet, salonItemsVan, ontmoetKantoorState, ontmoetSosAf, ontmoetSignaalLid } = kern;

  /* Salon-ontmoetingen: het RTG-veiligheidsteam ziet de lopende afspraken met
     live-locatie, handelt SOS-en af en kan bij een SOS live meekijken (WebRTC). */
  app.post('/api/office/ontmoetingen', officeAuth, (req, res) => {
    res.json(ontmoetKantoorState());
  });
  app.post('/api/office/ontmoeting/sos-af', officeAuth, (req, res) => {
    const r = ontmoetSosAf(String(req.body.dateId || ''), String(req.body.sosId || ''), req.actor && req.actor.name);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, ontmoetingen: ontmoetKantoorState() });
  });
  // WebRTC-antwoord van kantoor naar het lid (live meekijken bij een SOS)
  app.post('/api/office/ontmoeting/signaal', officeAuth, (req, res) => {
    const r = ontmoetSignaalLid(String(req.body.dateId || ''), String(req.body.naarKey || ''), req.body.payload || null);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true });
  });

  /* Toren 3, RTG Shared Assets: het kantoor hertaxeert een object. De
     ticketwaarde, de uitstapwaarde en de prijzen van beide smaken (Access
     25% van de ticketwaarde, Asset ticketwaarde + 15%) schuiven automatisch
     mee; de pool-leden krijgen direct bericht. */
  app.post('/api/office/asset/waarde', officeAuth, (req, res) => {
    const r = kern.assetHertaxeer(req.body.assetId, req.body.waarde, 'RTG-kantoor');
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  // het poolbestuur: verkoop, poolkas, wachtlijst, open terugkopen en restdagen
  app.post('/api/office/asset/overzicht', officeAuth, (req, res) => res.json(kern.assetKantoor()));
  // een terugkoop uitbetalen (uiterlijk binnen het venster van dertig dagen)
  app.post('/api/office/asset/terugkoop', officeAuth, async (req, res) => {
    const r = await kern.assetTerugkoopUit(req.body.verzoekId, 'RTG-kantoor');
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  // de jaarlijkse servicefee innen (per actief ticket een keer per jaar)
  app.post('/api/office/asset/fees', officeAuth, async (req, res) => res.json(await kern.assetFeesInnen('RTG-kantoor')));

  // Naleving van de Salon-verplichting: welke partners zijn (niet) zichtbaar
  app.post('/api/office/salon-naleving', officeAuth, (req, res) => {
    const lijst = db.data.suppliers.map(s => {
      const t = db.data.supplierTypes[s.type] || {};
      const bio = ((s.salon && s.salon.bio) || '').trim();
      const heeftFoto = !!(s.salon && s.salon.foto) || (Array.isArray(s.photos) && s.photos.length > 0);
      return {
        code: s.code, name: s.name, type: t.label || s.type, city: s.city,
        compleet: salonProfielCompleet(s), bio: bio.length >= 15, foto: heeftFoto,
        items: salonItemsVan(s.code), volgers: (s.salon && s.salon.volgers.length) || 0
      };
    });
    res.json({
      totaal: lijst.length,
      compleet: lijst.filter(x => x.compleet).length,
      achter: lijst.filter(x => !x.compleet),
      partners: lijst.sort((a, b) => (a.compleet === b.compleet ? 0 : a.compleet ? 1 : -1))
    });
  });
};
