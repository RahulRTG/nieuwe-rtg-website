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
    orderMetRef, ordersVoegToe, ordersVanKlant, boekingMetRef, boekingenVoegToe, openLijnVoor, ledenvoordeelVoor } = ctx;
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
  // zorg-/allergieveiligheid: keur gerechten af die botsen met het allergieprofiel
  // van het lid (een allergeen van het gerecht staat in de eigen allergenenlijst),
  // tenzij het lid bewust doorzet. De menukaart, de kassa EN Rahul roepen dezelfde
  // /api/order, dus ze weigeren dit allemaal automatisch. Dieet en medische
  // aandachtspunten reizen als context mee naar de keuken.
  const zorg = zorgVoor(session.key);
  if (zorg && (zorg.allergenen || []).length && !body.allergieAkkoord) {
    const eigen = zorg.allergenen.map(a => String(a).toLowerCase());
    const botsers = [];
    for (const it of items) {
      const m = (s.menu || []).find(x => x.id === it.id);
      const raak = ((m && m.allergens) || []).filter(a => eigen.includes(String(a).toLowerCase()));
      if (raak.length) botsers.push({ id: it.id, naam: it.name, allergenen: raak });
    }
    if (botsers.length) return {
      status: 409,
      error: 'Dit botst met je allergieprofiel: ' + botsers.map(b => b.naam + ' (' + b.allergenen.join(', ') + ')').join('; ') + '. Kies iets anders, of bevestig bewust dat je het toch wilt.',
      allergieBotsing: botsers
    };
  }
  // de zaak kiest het betaalmoment: vooraf (standaard, pas zichtbaar na
  // afrekenen) of achteraf (direct zichtbaar, betalen via de app volgt);
  // jeugdleden (15-17) betalen altijd vooraf, ook bij een achteraf-zaak.
  // "Naar de kassa": het lid kiest zelf om de bestelling nu te laten maken en
  // straks aan de balie af te rekenen (met de ophaalcode); dit gaat voor op de
  // vooraf-voorkeur van de zaak, behalve bij jeugdleden.
  const jeugd = lft != null && lft < 18;
  const naarKassa = !!body.naarKassa && !jeugd;
  const vooraf = jeugd || (!naarKassa && optieAan(s, 'betaalVooraf'));
  const order = {
    ref: 'RTG-O-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    pickup: pickupCode(),
    supplierCode: s.code, supplierName: s.name, type: s.type,
    customerTier: session.tier, customerKey: session.key, customerCodename: codename,
    items, total,
    table: schoon(body.table, 24),
    allergyNote: schoon(body.allergyNote, 200),
    // het zorgprofiel reist automatisch mee naar de keuken (alleen met toestemming)
    zorg: zorg,
    allergieAkkoord: body.allergieAkkoord ? true : undefined,
    tagSalon: !!body.tagSalon,
    betaalMoment: vooraf ? 'vooraf' : 'achteraf',
    aanBalie: naarKassa ? true : undefined,
    leeftijdOk: metAlcohol && lft != null ? true : undefined,
    status: vooraf ? 'wacht-op-betaling' : 'nieuw', paid: false, at: new Date().toISOString()
  };
  ordersVoegToe(order);
  openLijnVoor(s, session);
  save();
  if (!vooraf) {
    const kop = naarKassa ? 'Nieuwe bestelling (afrekenen aan de kassa)' : 'Nieuwe bestelling (betaling achteraf)';
    notifySupplier(s.code, { icon: '\u{1F6CE}️', title: kop, body: codename + (order.table ? ' · ' + order.table : '') + ', ' + items.reduce((n, i) => n + i.qty, 0) + ' item(s), € ' + total + (order.allergyNote ? ' · allergie: ' + order.allergyNote : '') });
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
/* "De rekening" (betalen na het eten): de zaak laat bestellingen achteraf
   lopen (betaalMoment 'achteraf'), en aan het eind van het bezoek vraagt het
   lid de rekening op. Alle openstaande, achteraf-lopende bonnen bij die zaak
   worden dan als een rekening opgeteld en in een keer afgerekend, met een
   fooi over het geheel. Aan-de-balie-bonnen tellen niet mee (die worden aan
   de kassa voldaan) en vooraf-bonnen evenmin (die zijn al bij het plaatsen
   betaald). */
function lopendeBonnen(session, code) {
  const s = findSupplier(code);
  if (!s) return { s: null, bonnen: [] };
  const bonnen = ordersVanKlant(session.key).filter(o =>
    o.supplierCode === s.code && !o.paid && o.betaalMoment === 'achteraf' && !o.aanBalie &&
    !['terugbetaald', 'geannuleerd', 'geweigerd'].includes(o.status));
  return { s, bonnen };
}

function rekeningVoor(session, body) {
  const { s, bonnen } = lopendeBonnen(session, body.supplierCode);
  if (!s) return { status: 404, error: 'Leverancier niet gevonden.' };
  const subtotaal = bonnen.reduce((n, o) => n + (o.total || 0), 0);
  return {
    ok: true,
    rekening: {
      supplierCode: s.code, supplierName: s.name,
      aantal: bonnen.length,
      tafel: (bonnen.find(o => o.table) || {}).table || '',
      regels: bonnen.map(o => ({ ref: o.ref, at: o.at, total: o.total, items: (o.items || []).map(it => ({ name: it.name, qty: it.qty, price: it.price })) })),
      subtotaal
    }
  };
}

function betaalRekeningVoor(session, body) {
  const { s, bonnen } = lopendeBonnen(session, body.supplierCode);
  if (!s) return { status: 404, error: 'Leverancier niet gevonden.' };
  if (!bonnen.length) return { status: 404, error: 'Er staat geen lopende rekening open bij deze zaak.' };
  const subtotaal = bonnen.reduce((n, o) => n + (o.total || 0), 0);
  const fooi = fooiUit(body, subtotaal);
  const nu = new Date().toISOString();
  let korting = 0, voordeel = 0;
  bonnen.forEach((o, i) => {
    // puntentegoed van het lid (RTG legt bij) en het ledenvoordeel per genre
    const k = pasTegoedToe(session.key, o.total);
    if (k) { o.puntenKorting = k; korting += k; }
    const v = ledenvoordeelVoor(s, o.total - k);
    if (v) { o.regieKorting = v; voordeel += v; }
    o.paid = true;
    o.paidAt = nu;
    o.rekeningVoldaan = true; // afgerekend als deel van een gezamenlijke rekening
    if (o.status === 'wacht-op-betaling') o.status = 'nieuw';
    // de fooi voor het team komt een keer op de rekening (op de eerste bon)
    if (i === 0 && fooi) o.fooi = (o.fooi || 0) + fooi;
    verdienPunten(session.key, o.total - k - v, o.supplierName);
    // betaald = definitief: het keukenbrein boekt de ingredienten af
    try { keuken.boekVerkoopAf(s, o.items || [], 'rekening ' + o.ref); } catch (e) {}
  });
  save();
  const aantalItems = bonnen.reduce((n, o) => n + (o.items || []).reduce((m, it) => m + it.qty, 0), 0);
  const eerste = bonnen[0];
  notifySupplier(s.code, { icon: '\u{1F9FE}', title: 'Rekening voldaan', body: eerste.customerCodename + (eerste.table ? ' · ' + eerste.table : '') + ', ' + bonnen.length + ' bon(nen), ' + aantalItems + ' item(s), € ' + subtotaal + (fooi ? ' · \u{1F49B} fooi € ' + fooi : '') });
  sseToSupplier(s.code, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  return { ok: true, rekening: { supplierName: s.name, aantal: bonnen.length, subtotaal, fooi, puntenKorting: korting, regieKorting: voordeel, betaald: subtotaal + fooi, refs: bonnen.map(o => o.ref) } };
}
  return { plaatsOrderVoor, betaalOrderVoor, rekeningVoor, betaalRekeningVoor };
};
