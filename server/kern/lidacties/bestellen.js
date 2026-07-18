/* Lidacties (deelmodule): bestellen bij een partner: plaatsOrderVoor (met
   ledenprijsgarantie, 86 van de keuken, de alcohol/leeftijdsgrens en het
   betaalmoment) en betaalOrderVoor (fooi, puntentegoed, spaarpunten).
   Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/lidacties.js. */
module.exports = (ctx) => {
  const { db, save, crypto, schoon, PERSONAS, findSupplier, ledenPrijs, optieAan,
    leeftijdVan, geborenVan, alcoholGrensVan, pickupCode, entreeCode, ticketsVoorSlot,
    fooiUit, pasTegoedToe, verdienPunten, liveCodename, haversine, pushLive,
    notifySupplier, sseToSupplier, sseToOffice, zorgVoor, zorgContact, keuken,
    orderMetRef, ordersVoegToe, boekingMetRef, boekingenVoegToe, openLijnVoor, ledenvoordeelVoor } = ctx;
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
  ordersVoegToe(order);
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
  const o = orderMetRef(body.ref);
  if (!o || (o.customerKey || o.customerTier) !== session.key) return { status: 404, error: 'Bestelling niet gevonden.' };
  if (o.paid) return { status: 409, error: 'Al betaald.' };
  // de verloopgrens geldt alleen voor vooraf betalen; achteraf mag later
  if (o.status === 'wacht-op-betaling' && Date.now() - new Date(o.at) > 30 * 60000) return { status: 410, error: 'Deze bestelling is verlopen. Plaats hem opnieuw.' };
  // fooi (gaat naar het team), punten-tegoed (RTG legt bij) en spaarpunten
  const fooi = fooiUit(body, o.total);
  if (fooi) o.fooi = fooi;
  const korting = pasTegoedToe(session.key, o.total);
  if (korting) o.puntenKorting = korting;
  // het RTG-ledenvoordeel per genre (de boardroom bepaalt; RTG legt bij,
  // dus de zaak houdt het volle bedrag en de nettoprijzen-belofte blijft staan)
  const voordeel = ledenvoordeelVoor(findSupplier(o.supplierCode), o.total - korting);
  if (voordeel) o.regieKorting = voordeel;
  o.paid = true;
  o.paidAt = new Date().toISOString();
  if (o.status === 'wacht-op-betaling') o.status = 'nieuw';
  verdienPunten(session.key, o.total - korting - voordeel, o.supplierName);
  save();
  // betaald = definitief: het keukenbrein boekt de ingredienten af via de recepten
  try { keuken.boekVerkoopAf(findSupplier(o.supplierCode), o.items || [], 'bestelling ' + o.ref); } catch (e) {}
  // nu pas hoort de zaak ervan: betaald = definitief
  notifySupplier(o.supplierCode, { icon: '\u{1F6CE}\uFE0F', title: 'Nieuwe bestelling (betaald)', body: o.customerCodename + ', ' + o.items.reduce((n, i) => n + i.qty, 0) + ' item(s), \u20AC ' + o.total + (o.allergyNote ? ' \u00B7 allergie: ' + o.allergyNote : '') });
  sseToSupplier(o.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  return { ok: true, order: o };
}
  return { plaatsOrderVoor, betaalOrderVoor };
};
