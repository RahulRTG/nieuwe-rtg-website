/* Member-submodule: boeken en bestellen. Diensten boeken bij zelfstandige
   professionals (met vooraf/achteraf betalen), de eigen boekingen- en
   bestelhistorie (RAM-venster + grootboek), cadeaukaarten kopen, de
   partnerlijst per stad en bestellingen plaatsen/betalen.
   Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, db, save, crypto, findSupplier, schoon, leeftijdVan, geborenVan,
    optieAan, zorgVoor, boekingenVoegToe, boekingenVanKlant, betaalBoekingVoor,
    notifySupplier, sseToSupplier, sseToOffice, gcCode, PERSONAS, publicSupplier,
    isFavoriet, salonZichtbaar, plaatsOrderVoor, betaalOrderVoor, ordersVanKlant,
    txLedgerActief, txLedgerVanKlant, txLedgerTel } = kern;

  app.post('/api/booking/request', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const s = findSupplier(req.body.supplierCode);
    const caps = s ? ((db.data.supplierTypes[s.type] || {}).caps || []) : [];
    if (!s || !caps.includes('services')) return res.status(404).json({ error: 'Geen zelfstandige professional gevonden.' });
    if (s.settings && s.settings.ordersOpen === false) return res.status(409).json({ error: s.name + ' neemt op dit moment geen boekingen aan.' });
    const dienst = (s.services || []).find(x => x.id === req.body.serviceId);
    if (!dienst) return res.status(404).json({ error: 'Deze dienst bestaat niet (meer).' });
    const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
    // jeugdleden (15-17) betalen altijd vooraf, ook bij een achteraf-zaak
    const lftB = leeftijdVan(geborenVan(req.session));
    const vooraf = optieAan(s, 'betaalVooraf') || (lftB != null && lftB < 18);
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
      notifySupplier(s.code, { icon: '🗓️', title: 'Nieuwe boeking (betaling achteraf)', body: codename + ': ' + dienst.name + (wanneer ? ' · ' + wanneer : '') + ' · € ' + dienst.price });
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

  app.post('/api/giftcard/buy', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const s = findSupplier(req.body.supplierCode);
    if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
    const bedrag = Math.round(Number(req.body.bedrag));
    if (!(bedrag >= 10 && bedrag <= 5000)) return res.status(400).json({ error: 'Kies een bedrag tussen € 10 en € 5.000.' });
    const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
    const kaart = { code: gcCode(), supplierCode: s.code, supplierName: s.name, bedrag, saldo: bedrag,
      kocht: codename, customerKey: req.session.key, at: new Date().toISOString(), verzilveringen: [] };
    db.data.giftcards.unshift(kaart);
    db.data.giftcards = db.data.giftcards.slice(0, 20000);
    save();
    notifySupplier(s.code, { icon: '🎁', title: 'Cadeaukaart verkocht', body: codename + ' kocht via de app een cadeaukaart van € ' + bedrag + '.' });
    sseToSupplier(s.code, 'sync', { scope: 'pos' });
    res.json({ ok: true, kaart });
  });

  app.post('/api/giftcards/mine', auth, (req, res) => {
    res.json({ kaarten: (db.data.giftcards || []).filter(g => g.customerKey === req.session.key).slice(0, 20) });
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
    const r = plaatsOrderVoor(req.session, req.body);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/order/pay', auth, (req, res) => {
    const r = betaalOrderVoor(req.session, req.body);
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
