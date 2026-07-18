/* Lidacties (deelmodule): ritten: vraagRitVoor (slimme offerte op afstand
   en tarief, leeftijdsgrens voor jets/helikopters, plannen vooruit, het
   zorgprofiel voor de chauffeur) en betaalRitVoor. Krijgt de gedeelde
   context een keer bij het opstarten vanuit kern/lidacties.js. */
module.exports = (ctx) => {
  const { db, save, crypto, schoon, PERSONAS, findSupplier, ledenPrijs, optieAan,
    leeftijdVan, geborenVan, alcoholGrensVan, pickupCode, entreeCode, ticketsVoorSlot,
    fooiUit, pasTegoedToe, verdienPunten, liveCodename, haversine, pushLive,
    notifySupplier, sseToSupplier, sseToOffice, zorgVoor, zorgContact, keuken,
    orderMetRef, ordersVoegToe, boekingMetRef, boekingenVoegToe, openLijnVoor, ledenvoordeelVoor } = ctx;
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
  // het RTG-ledenvoordeel per genre (de boardroom bepaalt; RTG legt bij)
  const voordeelR = ledenvoordeelVoor(findSupplier(r.supplierCode), r.quote - kortingR);
  if (voordeelR) r.regieKorting = voordeelR;
  r.paid = true;
  r.paidAt = new Date().toISOString();
  if (r.status === 'wacht-op-betaling') r.status = 'aangevraagd';
  verdienPunten(session.key, r.quote - kortingR - voordeelR, r.supplierName);
  save();
  notifySupplier(r.supplierCode, { icon: r.type === 'jet' ? '\u2708\uFE0F' : '\u{1F697}', title: 'Nieuwe ritaanvraag (betaald)', body: r.customerCodename + ': ' + r.from + ' naar ' + (r.to || 'bestemming') + ' \u00B7 ' + r.passengers + 'p \u00B7 \u20AC ' + r.quote + (r.plannedFor ? ' \u00B7 ' + r.when : '') });
  sseToSupplier(r.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  pushLive(session.key);
  return { ok: true, ride: r };
}
  return { vraagRitVoor, betaalRitVoor };
};
