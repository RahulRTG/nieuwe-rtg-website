/* Kopen (deelmodule): de ophaal/bezorgdienst: partnerinfo op code, de
   bezorgpartners, bestellen (ophalen of bezorgen) en live volgen. Krijgt
   de gedeelde kern een keer bij het opstarten vanuit
   routes/member/kopen.js. */
const { coord } = require('../../../kern/util');
const { servicekostenVoor } = require('../../../kern/servicekosten');
const bezorgvolg = require('../../../kern/bezorgvolg');
module.exports = (kern) => {
  const { PERSONAS, app, auth, crypto, db, findPartner, findSupplier, magBezorgen, pickupCode,
          publicPartner, save, schoon, salonZichtbaar, zorgMee, orderMetRef, ordersVoegToe,
          gegevensStop } = kern;
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
  // ophalen of bezorgen: de zaak moet je kunnen bereiken. Het bezorgadres vraagt
  // deze route zelf per bestelling, want dat is niet altijd je eigen adres.
  if (gegevensStop(req, res, 'bestelling')) return;
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
    const lat = coord(req.body.lat, 90), lng = coord(req.body.lng, 180);
    if (Number.isFinite(lat) && Number.isFinite(lng)) geo = { lat, lng };
  }
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  // Het tarief komt uit kern/servicekosten.js -- dezelfde bron als de afhaal- en
  // tafelroute in kern/lidacties/bestellen.js. Hier stond het bedrag los, en dan
  // betaalt dezelfde gast een ander bedrag afhankelijk van hoe hij bestelt.
  const servicekosten = servicekostenVoor(req.session.tier);
  if (servicekosten) total = Math.round((total + servicekosten.inBtw) * 100) / 100;
  const order = {
    ref: 'RTG-B-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    pickup: pickupCode(),
    supplierCode: s.code, supplierName: s.name, type: s.type,
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    items, total,
    ...(servicekosten ? { servicekosten } : {}),   // een lid krijgt geen veld, geen nul
    levering, adres, geo,
    allergyNote: schoon(req.body.note, 200),
    zorg: zorgMee(req.session.key, { zaak: s.code, reden: 'zorgprofiel meegegeven bij een bestelling' }),
    betaalMoment: 'vooraf',
    status: 'wacht-op-betaling', paid: false, at: new Date().toISOString()
  };
  ordersVoegToe(order);
  save();
  res.json({ ok: true, order }); // afrekenen via /api/order/pay; dan pas hoort de zaak ervan
});

/* De bestelling live volgen: status, bezorger op naam en (onderweg) de
   laatste GPS-positie met verwachte aankomsttijd. */
app.post('/api/bezorg/volg', auth, (req, res) => {
  const o = orderMetRef(String(req.body.ref || ''));
  if (!o || (o.customerKey || o.customerTier) !== req.session.key || !o.levering) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  const B = db.data.bezorgers || {};
  const pos = o.bezorger ? B[o.supplierCode + ':' + (o.bezorger.staffId || 'beheer')] : null;
  /* Het volgscherm: dezelfde stappen die de zaak intern doorloopt, in de taal
     van de klant, met wat er gebeurt en hoe lang het nog duurt. Hoeveel het er
     zijn en hoe ze heten bepaalt kern/bezorgvolg.js per leveringswijze (een
     afhaalbon vertrekt nooit) -- hier stond een aantal genoemd, en dat liep
     stilletjes achter op de keten. Tussen "betaald" en "onderweg" zat hier
     eerst niets, en dat is juist de tijd waarin iemand zich afvraagt of zijn
     bestelling wel is aangekomen. */
  const positie = o.status === 'onderweg' && pos ? { lat: pos.lat, lng: pos.lng, at: pos.at } : null;
  const zaak = findSupplier(o.supplierCode);
  const beeld = bezorgvolg.volgBeeld({
    order: o, orders: db.data.orders || [], zaakLoc: zaak && zaak.loc,
    positie, bezorgerNaam: o.bezorger && o.bezorger.name
  });
  res.json(Object.assign({
    order: o, bezorger: o.bezorger ? { name: o.bezorger.name } : null,
    positie
  }, beeld));
});

};
