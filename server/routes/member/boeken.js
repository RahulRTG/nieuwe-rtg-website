/* Member-submodule: boeken en bestellen. Diensten boeken bij zelfstandige
   professionals (met vooraf/achteraf betalen), de eigen boekingen- en
   bestelhistorie (RAM-venster + grootboek), cadeaukaarten kopen, de
   partnerlijst per stad en bestellingen plaatsen/betalen.

   DE CADEAUKAART STAAT IN ./cadeaukaart.js. Die hoorde hier eigenlijk nooit --
   een kaart met saldo bij een zaak is geen boeking en geen bestelling -- en
   sinds hij ECHT betaald wordt (met een pay-boeking en een herhaalgrendel) is
   het ook geen paar regels meer. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, db, save, crypto, findSupplier, schoon, leeftijdVan, geborenVan,
    optieAan, zorgVoor, boekingenVoegToe, boekingenVanKlant, betaalBoekingVoor,
    notifySupplier, sseToSupplier, sseToOffice, PERSONAS, publicSupplier,
    isFavoriet, salonZichtbaar, plaatsOrderVoor, betaalOrderVoor, rekeningVoor, betaalRekeningVoor, ordersVanKlant,
    txLedgerActief, txLedgerVanKlant, txLedgerTel, gegevensStop } = kern;

  app.post('/api/booking/request', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    // een reservering staat op naam bij een derde: die moet je kunnen bereiken
    if (gegevensStop(req, res, 'reservering')) return;
    const s = findSupplier(req.body.supplierCode);
    const caps = s ? (db.capsVan(s)) : [];
    if (!s || !caps.includes('services')) return res.status(404).json({ error: 'Geen zelfstandige professional gevonden.' });
    if (s.settings && s.settings.ordersOpen === false) return res.status(409).json({ error: s.name + ' neemt op dit moment geen boekingen aan.' });
    const dienst = (s.services || []).find(x => x.id === req.body.serviceId);
    if (!dienst) return res.status(404).json({ error: 'Deze dienst bestaat niet (meer).' });
    const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
    // jeugdleden (15-17) betalen altijd vooraf, ook bij een achteraf-zaak
    // onbekende leeftijd telt als jeugdlid: dan altijd vooraf betalen. Dat is de
    // veilige kant en kost niets; andersom (fail-open) liet juist een sessie
    // zonder geverifieerde leeftijd achteraf betalen.
    const lftB = leeftijdVan(geborenVan(req.session));
    const vooraf = optieAan(s, 'betaalVooraf') || !(lftB >= 18);
    const d = schoon(req.body.date, 10), u = schoon(req.body.time, 5);
    const wanneer = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d + (/^\d{2}:\d{2}$/.test(u) ? ' ' + u : '') : null;
    const boeking = {
      ref: 'RTG-B-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      supplierCode: s.code, supplierName: s.name,
      customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
      service: { id: dienst.id, name: dienst.name, soort: dienst.soort || 'dienst', duurMin: dienst.duurMin || null },
      price: dienst.price,
      wanneer, note: schoon(req.body.note, 140),
      zorg: zorgVoor(req.session.key),
      betaalMoment: vooraf ? 'vooraf' : 'achteraf',
      status: vooraf ? 'wacht-op-betaling' : 'aangevraagd',
      paid: false, at: new Date().toISOString()
    };
    boekingenVoegToe(boeking);
    save();
    if (!vooraf) {
      notifySupplier(s.code, { icon: 'agenda', title: 'Nieuwe boeking (betaling achteraf)', body: codename + ': ' + dienst.name + (wanneer ? ' · ' + wanneer : '') + ' · € ' + dienst.price });
      sseToSupplier(s.code, 'sync', { scope: 'orders' });
      sseToOffice('sync', { scope: 'orders' });
    }
    res.json({ ok: true, boeking });
  });

  app.post('/api/booking/pay', auth, (req, res) => {
    const r = betaalBoekingVoor(req.session, req.body);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });

  // de vrije tijdvakken van een dienstverlener op een datum (voor de boekflow)
  app.post('/api/booking/slots', auth, (req, res) => {
    const s = findSupplier(req.body.supplierCode);
    if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
    const r = kern.vakwerk.slots(s.code, req.body.serviceId, req.body.date);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  app.post('/api/bookings/mine', auth, async (req, res) => {
    // zelfde vensterbeleid als /api/orders/mine: vers venster, grootboek-historie
    const key = req.session.key;
    const offset = Math.max(0, parseInt(req.body.offset, 10) || 0);
    const mijn = boekingenVanKlant(key);
    if (!txLedgerActief()) return res.json({ boekingen: mijn.slice(offset, offset + 25), total: mijn.length });
    const total = Math.max(mijn.length, await txLedgerTel('boekingen', key));
    const boekingen = offset < mijn.length ? mijn.slice(offset, offset + 25) : await txLedgerVanKlant('boekingen', key, 25, offset);
    res.json({ boekingen, total });
  });

  app.post('/api/suppliers', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const city = req.body.city;
    // De Salon is verplicht: partners zonder compleet Salon-profiel tonen we niet
    const list = db.data.suppliers.filter(s => (!city || s.city === city) && salonZichtbaar(s))
      .map(s => ({ ...publicSupplier(s, req.body.lang), favoriet: isFavoriet(req.session.key, s.code) }));
    res.json({ suppliers: list, city: db.data.trip.dest });
  });

  app.post('/api/order', auth, (req, res) => {
    /* Hier komt een DERDE PARTIJ in beeld: de zaak moet je kunnen bereiken als er
       iets misgaat met je bestelling. Ontbreekt dat nog, dan is dit geen weigering
       maar een 428 met wat er mist -- de app opent daarmee het gesprek met Rahul
       en doet daarna gewoon opnieuw wat je wilde. */
    if (gegevensStop(req, res, req.body.bezorgen ? 'bezorging' : 'bestelling')) return;
    const r = plaatsOrderVoor(req.session, req.body);
    // bij een allergiebotsing reizen de botsende gerechten mee, zodat de app
    // bewust kan laten bevestigen (allergieAkkoord) in plaats van blind te falen
    if (r.error) return res.status(r.status).json(r.allergieBotsing ? { error: r.error, allergieBotsing: r.allergieBotsing } : { error: r.error });
    res.json(r);
  });
  app.post('/api/order/pay', auth, (req, res) => {
    const r = betaalOrderVoor(req.session, req.body);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  // "De rekening" (betalen na het eten): de lopende achteraf-bonnen bij een
  // zaak opgeteld tonen, en in een keer afrekenen met een fooi over het geheel.
  app.post('/api/rekening', auth, (req, res) => {
    const r = rekeningVoor(req.session, req.body);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/rekening/betaal', auth, (req, res) => {
    const r = betaalRekeningVoor(req.session, req.body);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });

  app.post('/api/orders/mine', auth, async (req, res) => {
    // Schaalvast: de eerste pagina komt vers uit het RAM-venster; is het
    // grootboek actief, dan komen diepere pagina's (historie die uit het venster
    // is gerold) en het eerlijke totaal uit de geindexeerde grootboek-rijen.
    const key = req.session.key;
    const offset = Math.max(0, parseInt(req.body.offset, 10) || 0);
    const mijn = ordersVanKlant(key);
    if (!txLedgerActief()) return res.json({ orders: mijn.slice(offset, offset + 25), total: mijn.length });
    const total = Math.max(mijn.length, await txLedgerTel('orders', key));
    const orders = offset < mijn.length ? mijn.slice(offset, offset + 25) : await txLedgerVanKlant('orders', key, 25, offset);
    res.json({ orders, total });
  });
};
