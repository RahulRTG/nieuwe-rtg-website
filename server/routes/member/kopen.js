/* Domein "member", deelmodule kopen: rechtstreeks betalen aan een
   leverancier (Face ID), de ophaal/bezorgdienst, tickets voor
   activiteiten en de transfers daarbij. Alleen routes; de logica
   woont in de kern-modules. */
module.exports = (kern) => {
  const { PERSONAS, app, auth, betaal, centen,
    crypto, db, findPartner, findSupplier, magBezorgen,
    liveCodename, notifySupplier, pickupCode, publicPartner, save,
    schoon, sseToOffice, sseToSupplier, salonZichtbaar, zorgVoor,
    koopTicketVoor, dpBetaalDirect, dpMijnBetalingen, dpVerzoekenVoor, dpBetaalVerzoek } = kern;

/* ============ rechtstreeks betalen aan een leverancier (Face ID) ============
   Elk betalend lid rekent alles met Face ID af, via de AI en de Salon, en het
   geld gaat rechtstreeks naar de leverancier. Alleen leden (geen gasten). */
app.post('/api/betaal/direct', auth, async (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Rechtstreeks betalen is voor leden.' });
  const cent = req.body.centen != null ? Math.round(Number(req.body.centen)) : Math.round(Number(req.body.bedrag) * 100);
  const r = await dpBetaalDirect({ key: req.session.key, codename: liveCodename(req.session),
    supplierCode: String(req.body.supplierCode || ''), bedragCenten: cent,
    omschrijving: req.body.omschrijving, bron: req.body.bron, idem: req.body.idem });
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/betaal/verzoeken', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.json({ verzoeken: [] });
  res.json({ verzoeken: dpVerzoekenVoor(liveCodename(req.session)) });
});
app.post('/api/betaal/verzoek/pay', auth, async (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Betalen is voor leden.' });
  const r = await dpBetaalVerzoek({ key: req.session.key, codename: liveCodename(req.session), ref: String(req.body.ref || ''), idem: req.body.idem });
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/betaal/mijn', auth, (req, res) => {
  res.json({ betalingen: dpMijnBetalingen(req.session.key) });
});

app.post('/api/partner', (req, res) => {
  const partner = findPartner(req.body.code);
  if (!partner) return res.status(404).json({ error: 'Deze partnercode kennen we niet.' });
  res.json({ partner: publicPartner(partner) });
});

/* ================== bestellen: de ophaal/bezorgdienst ==================
   Horeca en zelfstandigen voeren een eigen bezorg-assortiment (los van de
   menukaart ter plaatse). Het lid kiest ophalen of bezorgen; betalen gaat
   altijd vooraf via de bestaande betaalstroom (/api/order/pay), zodat de
   kassa, backoffice, boekhouding en archiefkast automatisch meedoen. */
app.post('/api/bezorg/partners', auth, (req, res) => {
  const partners = db.data.suppliers
    .filter(s => magBezorgen(s) && s.bezorg && s.bezorg.aan && s.bezorg.producten.length && salonZichtbaar(s))
    .map(s => ({ code: s.code, name: s.name, type: s.type, city: s.city, loc: s.loc || null,
      ophalen: s.bezorg.ophalen !== false, bezorgen: s.bezorg.bezorgen !== false,
      producten: s.bezorg.producten.slice(0, 60) }));
  res.json({ partners });
});

app.post('/api/bezorg/bestel', auth, (req, res) => {
  const s = findSupplier(req.body.supplierCode);
  if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
  if (!magBezorgen(s) || !s.bezorg || !s.bezorg.aan || !s.bezorg.producten.length)
    return res.status(409).json({ error: s.name + ' heeft op dit moment geen ophaal/bezorgdienst.' });
  const levering = req.body.levering === 'bezorgen' ? 'bezorgen' : 'ophalen';
  if (levering === 'bezorgen' && s.bezorg.bezorgen === false)
    return res.status(409).json({ error: s.name + ' bezorgt niet; ophalen kan wel.' });
  if (levering === 'ophalen' && s.bezorg.ophalen === false)
    return res.status(409).json({ error: s.name + ' doet alleen bezorgen.' });
  const wanted = Array.isArray(req.body.items) ? req.body.items : [];
  const items = [];
  let total = 0;
  for (const w of wanted) {
    const p = s.bezorg.producten.find(x => x.id === w.id);
    const qty = Math.min(20, Math.max(1, parseInt(w.qty, 10) || 1));
    if (p) { items.push({ id: p.id, name: p.name, qty, price: p.price }); total += p.price * qty; }
  }
  if (!items.length) return res.status(400).json({ error: 'Kies eerst iets uit het assortiment.' });
  let adres = null, geo = null;
  if (levering === 'bezorgen') {
    adres = schoon(req.body.adres, 120);
    if (!adres) return res.status(400).json({ error: 'Vul een bezorgadres in.' });
    const lat = Number(req.body.lat), lng = Number(req.body.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) geo = { lat, lng };
  }
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  const order = {
    ref: 'RTG-B-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    pickup: pickupCode(),
    supplierCode: s.code, supplierName: s.name, type: s.type,
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    items, total, levering, adres, geo,
    allergyNote: schoon(req.body.note, 200),
    zorg: zorgVoor(req.session.key),
    betaalMoment: 'vooraf',
    status: 'wacht-op-betaling', paid: false, at: new Date().toISOString()
  };
  db.data.orders.unshift(order);
  save();
  res.json({ ok: true, order }); // afrekenen via /api/order/pay; dan pas hoort de zaak ervan
});

/* De bestelling live volgen: status, bezorger op naam en (onderweg) de
   laatste GPS-positie met verwachte aankomsttijd. */
app.post('/api/bezorg/volg', auth, (req, res) => {
  const o = db.data.orders.find(x => x.ref === String(req.body.ref || '') && (x.customerKey || x.customerTier) === req.session.key);
  if (!o || !o.levering) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  const B = db.data.bezorgers || {};
  const pos = o.bezorger ? B[o.supplierCode + ':' + (o.bezorger.staffId || 'beheer')] : null;
  res.json({
    order: o, bezorger: o.bezorger ? { name: o.bezorger.name } : null,
    positie: o.status === 'onderweg' && pos ? { lat: pos.lat, lng: pos.lng, at: pos.at } : null,
    etaMin: o.status === 'onderweg' ? (o.etaMin || null) : null
  });
});

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
  const t = db.data.boekingen.find(b => b.kind === 'ticket' && b.ref === String(req.body.ticketRef || '') &&
    (b.customerKey || b.customerTier) === req.session.key);
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
