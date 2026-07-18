/* Kopen (deelmodule): tickets voor activiteiten, tours en musea
   (tijdsloten met capaciteit, entreecode) en de transferaanvraag bij een
   ticket. Krijgt de gedeelde kern een keer bij het opstarten vanuit
   routes/member/kopen.js. */
module.exports = (kern) => {
  const { PERSONAS, app, auth, betaal, centen,
    crypto, db, findPartner, findSupplier, magBezorgen,
    liveCodename, notifySupplier, pickupCode, publicPartner, save,
    schoon, sseToOffice, sseToSupplier, salonZichtbaar, zorgVoor,
    koopTicketVoor, dpBetaalDirect, dpMijnBetalingen, dpVerzoekenVoor, dpBetaalVerzoek,
    orderMetRef, ordersVoegToe } = kern;
/* ================== tickets: activiteiten, tours en musea ==================
   Tijdsloten met capaciteit; betalen vooraf via de bestaande boekingstroom
   (/api/booking/pay). Het ticket krijgt een entreecode die het personeel aan
   de deur op eigen naam afvinkt. */
app.post('/api/tickets/aanbod', auth, (req, res) => {
  const partners = db.data.suppliers
    .filter(s => ((db.data.supplierTypes[s.type] || {}).caps || []).includes('tickets') && (s.activiteiten || []).length && salonZichtbaar(s))
    .map(s => ({ code: s.code, name: s.name, city: s.city, loc: s.loc || null, activiteiten: s.activiteiten.slice(0, 30) }));
  res.json({ partners });
});

app.post('/api/ticket/koop', auth, (req, res) => {
  const r = koopTicketVoor(req.session, req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

app.post('/api/tickets/mijn', auth, (req, res) => {
  const mijn = db.data.boekingen
    .filter(b => b.kind === 'ticket' && (b.customerKey || b.customerTier) === req.session.key && b.status !== 'geweigerd' && b.paid)
    .slice(0, 20)
    .map(b => {
      const zaak = findSupplier(b.supplierCode);
      const rit = db.data.rides.find(r => r.ticketRef === b.ref && !['afgerond', 'geweigerd'].includes(r.status));
      return { ref: b.ref, code: b.code, supplierName: b.supplierName, naam: b.service.name,
        datum: b.datum, tijd: b.tijd, personen: b.personen, prijs: b.price,
        gebruikt: !!b.checkin, checkin: b.checkin || null,
        // de eigen transferdienst van de zaak, en de lopende rit met chauffeur
        transferAan: !!(zaak && zaak.transfer && zaak.transfer.aan),
        transferPrijs: zaak && zaak.transfer ? (zaak.transfer.prijs || 0) : 0,
        transfer: rit ? { ref: rit.ref, status: rit.status, prijs: rit.quote || 0, paid: !!rit.paid,
          chauffeur: rit.driver ? rit.driver.name : null, etaMin: rit.pickupEtaMin || null } : null };
    });
  res.json({ tickets: mijn });
});

/* De transfer van een activiteitenzaak: alleen met een geldig (betaald, nog
   niet gebruikt) ticket. De rit gaat de gewone rittenmachinerie in: de
   chauffeur van de zaak neemt hem op naam aan, de klant ziet wie er komt
   (en andersom), en de zaak ziet alles in de eigen app. */
app.post('/api/transfer/aanvraag', auth, (req, res) => {
  const bt = kern.boekingMetRef(String(req.body.ticketRef || ''));
  const t = bt && bt.kind === 'ticket' && (bt.customerKey || bt.customerTier) === req.session.key ? bt : null;
  if (!t) return res.status(404).json({ error: 'Ticket niet gevonden.' });
  if (!t.paid) return res.status(409).json({ error: 'Betaal eerst het ticket; dan regelen we de transfer.' });
  if (t.checkin) return res.status(409).json({ error: 'Dit ticket is al gebruikt.' });
  if (t.datum < new Date().toISOString().slice(0, 10)) return res.status(409).json({ error: 'Dit ticket is verlopen.' });
  const s = findSupplier(t.supplierCode);
  if (!s || !s.transfer || !s.transfer.aan)
    return res.status(409).json({ error: (s ? s.name : 'Deze zaak') + ' heeft geen eigen transferdienst.' });
  if (db.data.rides.some(r => r.ticketRef === t.ref && !['afgerond', 'geweigerd'].includes(r.status)))
    return res.status(409).json({ error: 'Er staat al een transfer voor dit ticket.' });
  const prijs = s.transfer.prijs || 0;
  const codename = liveCodename(req.session);
  const ride = {
    ref: 'RTG-R-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    supplierCode: s.code, supplierName: s.name, type: 'transfer',
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    from: schoon(req.body.van || 'Huidige locatie', 80),
    to: s.name, toCode: s.code,
    when: t.tijd + ' \u00B7 ' + t.service.name,
    plannedFor: t.datum + 'T' + t.tijd + ':00',
    passengers: t.personen || 1, luggage: 0,
    note: schoon(req.body.note, 140),
    km: null, quote: prijs, ticketRef: t.ref,
    zorg: zorgVoor(req.session.key),
    driver: null, vehicle: null,
    betaalMoment: 'vooraf',
    // prijs 0 = inclusief bij het ticket: meteen definitief, geen betaalstap
    status: prijs > 0 ? 'wacht-op-betaling' : 'aangevraagd',
    paid: prijs === 0, at: new Date().toISOString()
  };
  db.data.rides.unshift(ride);
  save();
  if (ride.status === 'aangevraagd') {
    notifySupplier(s.code, { icon: '\u{1F690}', title: 'Transferaanvraag', body: codename + ': ophalen ' + ride.from + ' voor ' + t.service.name + ' ' + t.tijd + ' \u00B7 ' + (t.personen || 1) + 'p' + (prijs ? ' \u00B7 \u20AC ' + prijs : ' \u00B7 inclusief') });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
  }
  res.json({ ok: true, ride }); // met een prijs: afrekenen via /api/ride/pay
});
};
