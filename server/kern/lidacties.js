/* Lidacties: de transactiefuncties van het lid als kern-module met
   EXPLICIETE afhankelijkheden. Bestellen, tickets en ritten, elk als
   (session, body) -> { ok, ... } | { status, error }. Dit zijn exact de
   functies achter de app-knoppen EN achter De Butler (via de
   acties-registry in server.js), dus er is een codepad en geen drift.
   De regels reizen mee: ledenprijsgarantie, 86 van de keuken, de
   leeftijds/alcohol-grens per land, het zorgprofiel en het betaalmoment
   van de zaak. */
module.exports = ({ db, save, crypto, schoon, PERSONAS, findSupplier, ledenPrijs, optieAan,
  leeftijdVan, geborenVan, alcoholGrensVan, pickupCode, entreeCode, ticketsVoorSlot,
  fooiUit, pasTegoedToe, verdienPunten, liveCodename, haversine, pushLive,
  notifySupplier, sseToSupplier, sseToOffice, zorgVoor, zorgContact, keuken }) => {

  /* Zodra het lid echt bij een partner koopt, opent de chatlijn: ze zijn
     dan geen vreemden meer. Idempotent en stil voor gasten. */
  const openLijnVoor = (s, session) => {
    if (!s || session.tier === 'guest') return;
    try { zorgContact(s, session.key, liveCodename(session), session.tier); } catch (e) {}
  };

function plaatsOrderVoor(session, body) {
  // betalen bij partners mag ook zonder pas (gratis gebruiker)
  const s = findSupplier(body.supplierCode);
  if (!s) return { status: 404, error: 'Leverancier niet gevonden.' };
  if (s.settings && s.settings.ordersOpen === false) return { status: 409, error: s.name + ' neemt op dit moment geen bestellingen aan.' };
  const wanted = Array.isArray(body.items) ? body.items : [];
  const items = [];
  let total = 0;
  for (const w of wanted) {
    const m = (s.menu || []).find(x => x.id === w.id);
    const qty = Math.min(20, Math.max(1, parseInt(w.qty, 10) || 1));
    // 86 van het keukenscherm: een uitverkocht gerecht is per direct niet te bestellen
    if (m && m.uitverkocht) return { status: 409, error: m.name + ' is helaas uitverkocht (86 gemeld door de keuken).' };
    // ledenprijsgarantie: reken nooit meer dan de publieke prijs, ook al zou
    // de menuprijs door een fout hoger staan (extra vangnet na het opslaan)
    if (m) { const unit = ledenPrijs(m.publiekePrijs, m.price); items.push({ id: m.id, name: m.name, qty, price: unit }); total += unit * qty; }
  }
  if (!items.length) return { status: 400, error: 'Geen geldige gerechten gekozen.' };
  const codename = session.account ? session.account.codename : PERSONAS[session.tier].codename;
  // leeftijd uit het paspoort: alcohol (bar-items) alleen boven de grens van
  // het land van de zaak; de partner ziet enkel dat de leeftijd geverifieerd is
  const lft = leeftijdVan(geborenVan(session));
  const metAlcohol = items.some(it => { const m = (s.menu || []).find(x => x.id === it.id); return m && m.station === 'bar'; });
  if (metAlcohol && lft != null) {
    const a = alcoholGrensVan(s);
    if (lft < a.grens) return { status: 403, error: 'Alcohol is in ' + a.land + ' vanaf ' + a.grens + ' jaar; je leeftijd is via je paspoort geverifieerd. Kies iets zonder alcohol.' };
  }
  // de zaak kiest het betaalmoment: vooraf (standaard, pas zichtbaar na
  // afrekenen) of achteraf (direct zichtbaar, betalen via de app volgt);
  // jeugdleden (15-17) betalen altijd vooraf, ook bij een achteraf-zaak
  const vooraf = optieAan(s, 'betaalVooraf') || (lft != null && lft < 18);
  const order = {
    ref: 'RTG-O-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    pickup: pickupCode(),
    supplierCode: s.code, supplierName: s.name, type: s.type,
    customerTier: session.tier, customerKey: session.key, customerCodename: codename,
    items, total,
    table: schoon(body.table, 24),
    allergyNote: schoon(body.allergyNote, 200),
    // het zorgprofiel reist automatisch mee naar de keuken (alleen met toestemming)
    zorg: zorgVoor(session.key),
    tagSalon: !!body.tagSalon,
    betaalMoment: vooraf ? 'vooraf' : 'achteraf',
    leeftijdOk: metAlcohol && lft != null ? true : undefined,
    status: vooraf ? 'wacht-op-betaling' : 'nieuw', paid: false, at: new Date().toISOString()
  };
  db.data.orders.unshift(order);
  openLijnVoor(s, session);
  save();
  if (!vooraf) {
    notifySupplier(s.code, { icon: '\u{1F6CE}️', title: 'Nieuwe bestelling (betaling achteraf)', body: codename + ', ' + items.reduce((n, i) => n + i.qty, 0) + ' item(s), € ' + total + (order.allergyNote ? ' · allergie: ' + order.allergyNote : '') });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
  }
  return { ok: true, order };
}

function betaalOrderVoor(session, body) {
  const o = db.data.orders.find(x => x.ref === body.ref && (x.customerKey || x.customerTier) === session.key);
  if (!o) return { status: 404, error: 'Bestelling niet gevonden.' };
  if (o.paid) return { status: 409, error: 'Al betaald.' };
  // de verloopgrens geldt alleen voor vooraf betalen; achteraf mag later
  if (o.status === 'wacht-op-betaling' && Date.now() - new Date(o.at) > 30 * 60000) return { status: 410, error: 'Deze bestelling is verlopen. Plaats hem opnieuw.' };
  // fooi (gaat naar het team), punten-tegoed (RTG legt bij) en spaarpunten
  const fooi = fooiUit(body, o.total);
  if (fooi) o.fooi = fooi;
  const korting = pasTegoedToe(session.key, o.total);
  if (korting) o.puntenKorting = korting;
  o.paid = true;
  o.paidAt = new Date().toISOString();
  if (o.status === 'wacht-op-betaling') o.status = 'nieuw';
  verdienPunten(session.key, o.total - korting, o.supplierName);
  save();
  // betaald = definitief: het keukenbrein boekt de ingredienten af via de recepten
  try { keuken.boekVerkoopAf(findSupplier(o.supplierCode), o.items || [], 'bestelling ' + o.ref); } catch (e) {}
  // nu pas hoort de zaak ervan: betaald = definitief
  notifySupplier(o.supplierCode, { icon: '\u{1F6CE}\uFE0F', title: 'Nieuwe bestelling (betaald)', body: o.customerCodename + ', ' + o.items.reduce((n, i) => n + i.qty, 0) + ' item(s), \u20AC ' + o.total + (o.allergyNote ? ' \u00B7 allergie: ' + o.allergyNote : '') });
  sseToSupplier(o.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  return { ok: true, order: o };
}

function koopTicketVoor(session, body) {
  const s = findSupplier(body.supplierCode);
  const caps = s ? ((db.data.supplierTypes[s.type] || {}).caps || []) : [];
  if (!s || !caps.includes('tickets')) return { status: 404, error: 'Geen activiteitenpartner gevonden.' };
  const act = (s.activiteiten || []).find(a => a.id === body.activiteitId);
  if (!act) return { status: 404, error: 'Deze activiteit bestaat niet (meer).' };
  const datum = String(body.datum || '');
  const tijd = String(body.tijd || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum < new Date().toISOString().slice(0, 10))
    return { status: 400, error: 'Kies een datum vanaf vandaag.' };
  if (!(act.tijden || []).includes(tijd)) return { status: 400, error: 'Kies een tijdslot van deze activiteit.' };
  const personen = Math.min(10, Math.max(1, parseInt(body.personen, 10) || 1));
  const bezet = ticketsVoorSlot(s.code, act.id, datum, tijd).reduce((n, t) => n + (t.personen || 1), 0);
  if (bezet + personen > act.capaciteit)
    return { status: 409, error: 'Dit tijdslot heeft nog ' + Math.max(0, act.capaciteit - bezet) + ' plek(ken). Kies een ander slot.' };
  const codename = session.account ? session.account.codename : PERSONAS[session.tier].codename;
  const ticket = {
    ref: 'RTG-T-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    kind: 'ticket', code: entreeCode(),
    supplierCode: s.code, supplierName: s.name,
    customerTier: session.tier, customerKey: session.key, customerCodename: codename,
    service: { id: act.id, name: act.name, soort: 'ticket' },
    activiteitId: act.id, datum, tijd, personen,
    zorg: zorgVoor(session.key),
    price: (act.prijs || 0) * personen,
    wanneer: datum + ' ' + tijd,
    betaalMoment: 'vooraf', status: 'wacht-op-betaling', paid: false, at: new Date().toISOString()
  };
  db.data.boekingen.unshift(ticket);
  db.data.boekingen = db.data.boekingen.slice(0, 50000);
  save();
  return { ok: true, ticket }; // afrekenen via /api/booking/pay of de Butler
}

function betaalBoekingVoor(session, body) {
  const b = db.data.boekingen.find(x => x.ref === body.ref && (x.customerKey || x.customerTier) === session.key);
  if (!b) return { status: 404, error: 'Boeking niet gevonden.' };
  if (b.paid) return { status: 409, error: 'Al betaald.' };
  if (b.status === 'wacht-op-betaling' && Date.now() - new Date(b.at) > 30 * 60000)
    return { status: 410, error: 'Deze aanvraag is verlopen. Boek opnieuw.' };
  // punten-tegoed (RTG legt bij) en spaarpunten
  const kortingB = pasTegoedToe(session.key, b.price || 0);
  if (kortingB) b.puntenKorting = kortingB;
  b.paid = true;
  b.paidAt = new Date().toISOString();
  if (b.status === 'wacht-op-betaling') b.status = 'aangevraagd';
  verdienPunten(session.key, (b.price || 0) - kortingB, b.supplierName);
  openLijnVoor(findSupplier(b.supplierCode), session);
  save();
  notifySupplier(b.supplierCode, { icon: '🗓️', title: 'Nieuwe boeking (betaald)', body: b.customerCodename + ': ' + b.service.name + (b.wanneer ? ' · ' + b.wanneer : '') + ' · € ' + b.price });
  sseToSupplier(b.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  return { ok: true, boeking: b };
}

function vraagRitVoor(session, body) {
  if (session.tier === 'guest') return { status: 403, error: 'Alleen voor leden.' };
  const s = findSupplier(body.supplierCode);
  const caps = s ? ((db.data.supplierTypes[s.type] || {}).caps || []) : [];
  if (!s || !caps.includes('rides')) return { status: 404, error: 'Geen vervoerspartner gevonden.' };
  // activiteitenzaken rijden alleen hun eigen transfers: die regel je via je ticket
  if (s.type === 'activiteit') return { status: 409, error: 'De transfer van ' + s.name + ' regel je via je ticket (Ter plaatse, Mijn tickets).' };
  if (!optieAan(s, 'ritten')) return { status: 409, error: s.name + ' neemt op dit moment geen ritaanvragen aan.' };
  // leeftijd uit het paspoort: privejets en helikopters boek je vanaf 18 jaar
  const lftR = leeftijdVan(geborenVan(session));
  if ((s.type === 'jet' || s.type === 'helikopter') && lftR != null && lftR < 18)
    return { status: 403, error: (s.type === 'helikopter' ? 'Helikoptervluchten' : 'Privejets') + ' boek je vanaf 18 jaar. Een taxi regelen we graag voor je.' };
  const dest = body.toCode ? findSupplier(body.toCode) : null;
  const codename = liveCodename(session);
  // slimme offerte: afstand uit de live-locatie en de bestemming, anders een
  // realistisch stadsgemiddelde; prijs volgt het tarief van de vervoerder
  const pax = Math.min(9, Math.max(1, Number(body.passengers) || 1));
  const koffers = Math.min(9, Math.max(0, Number(body.luggage) || 0));
  const L = db.data.live[session.key];
  const van = (L && Number.isFinite(L.lat)) ? { lat: L.lat, lng: L.lng } : (s.loc || null);
  const naar = dest && dest.loc ? dest.loc : null;
  let km = s.type === 'jet' ? 350 : (s.type === 'helikopter' ? 60 : 9);
  const meters = haversine(van, naar);
  if (meters != null && meters > 200) km = Math.max(1, meters / 1000);
  const t = (s.settings && s.settings.tarief) || {};
  const quote = Math.round(Math.max(t.minimum || 0, (t.start || 0) + (t.perKm || 2.5) * km));
  const ride = {
    ref: 'RTG-R-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    supplierCode: s.code, supplierName: s.name, type: s.type,
    customerTier: session.tier, customerKey: session.key, customerCodename: codename,
    from: schoon(body.from || 'Huidige locatie', 80),
    to: schoon(body.to || (dest && dest.name) || '', 80),
    toCode: dest ? dest.code : null,
    when: schoon(body.when || 'Zo snel mogelijk', 40),
    // vooruit plannen: datum en tijd geven een geplande rit (taxi en jet)
    plannedFor: (() => {
      const d = schoon(body.date, 10), u = schoon(body.time, 5);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
      const iso = d + 'T' + (/^\d{2}:\d{2}$/.test(u) ? u : '12:00') + ':00';
      return isNaN(new Date(iso)) ? null : iso;
    })(),
    passengers: pax, luggage: koffers, note: schoon(body.note, 140),
    // de chauffeur weet het (alleen met toestemming): bijv. rolstoel of medicatie
    zorg: zorgVoor(session.key),
    km: Math.round(km * 10) / 10, quote,
    driver: null, vehicle: null,
    // de vervoerder kiest het betaalmoment: vooraf (standaard) of achteraf;
    // jeugdleden (15-17) betalen altijd vooraf
    betaalMoment: (optieAan(s, 'betaalVooraf') || (lftR != null && lftR < 18)) ? 'vooraf' : 'achteraf',
    status: (optieAan(s, 'betaalVooraf') || (lftR != null && lftR < 18)) && quote > 0 ? 'wacht-op-betaling' : 'aangevraagd',
    paid: quote === 0, at: new Date().toISOString()
  };
  if (ride.plannedFor) ride.when = 'Gepland: ' + ride.plannedFor.slice(0, 16).replace('T', ' ');
  db.data.rides.unshift(ride);
  save();
  if (ride.status === 'aangevraagd') {
    notifySupplier(s.code, { icon: '\u{1F697}', title: 'Nieuwe ritaanvraag', body: codename + ': ' + ride.from + ' naar ' + (ride.to || 'bestemming') + ' \u00B7 ' + pax + 'p \u00B7 \u20AC ' + quote });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
  }
  pushLive(session.key);
  return { ok: true, ride };
}

function betaalRitVoor(session, body) {
  const r = db.data.rides.find(x => x.ref === body.ref && (x.customerKey || x.customerTier) === session.key);
  if (!r) return { status: 404, error: 'Rit niet gevonden.' };
  if (r.paid) return { status: 409, error: 'Al betaald.' };
  // de verloopgrens geldt alleen voor vooraf betalen; achteraf mag later
  if (r.status === 'wacht-op-betaling' && Date.now() - new Date(r.at) > 30 * 60000) return { status: 410, error: 'Deze aanvraag is verlopen. Vraag de rit opnieuw aan.' };
  // fooi voor de chauffeur, punten-tegoed (RTG legt bij) en spaarpunten
  const fooiR = fooiUit(body, r.quote);
  if (fooiR) r.fooi = fooiR;
  const kortingR = pasTegoedToe(session.key, r.quote);
  if (kortingR) r.puntenKorting = kortingR;
  r.paid = true;
  r.paidAt = new Date().toISOString();
  if (r.status === 'wacht-op-betaling') r.status = 'aangevraagd';
  verdienPunten(session.key, r.quote - kortingR, r.supplierName);
  save();
  notifySupplier(r.supplierCode, { icon: r.type === 'jet' ? '\u2708\uFE0F' : '\u{1F697}', title: 'Nieuwe ritaanvraag (betaald)', body: r.customerCodename + ': ' + r.from + ' naar ' + (r.to || 'bestemming') + ' \u00B7 ' + r.passengers + 'p \u00B7 \u20AC ' + r.quote + (r.plannedFor ? ' \u00B7 ' + r.when : '') });
  sseToSupplier(r.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  pushLive(session.key);
  return { ok: true, ride: r };
}

  return { plaatsOrderVoor, betaalOrderVoor, koopTicketVoor, betaalBoekingVoor, vraagRitVoor, betaalRitVoor };
};
