/* Lidacties: de transactiefuncties van het lid als kern-module met
   EXPLICIETE afhankelijkheden. Bestellen, tickets en ritten, elk als
   (session, body) -> { ok, ... } | { status, error }. Dit zijn exact de
   functies achter de app-knoppen EN achter De Butler (via de
   acties-registry in server.js), dus er is een codepad en geen drift.
   De regels reizen mee: ledenprijsgarantie, 86 van de keuken, de
   leeftijds/alcohol-grens per land, het zorgprofiel en het betaalmoment
   van de zaak. */
// De transactie-index (O(1) opzoeken op ref/klant/zaak) komt rechtstreeks uit de
// opslaglaag: db.js is een singleton en de index hoort bij de collecties zelf.
const { orderMetRef, ordersVoegToe, ordersVanKlant, boekingMetRef, boekingenVoegToe } = require('../db');

module.exports = ({ db, save, crypto, schoon, PERSONAS, findSupplier, ledenPrijs, optieAan,
  leeftijdVan, geborenVan, alcoholGrensVan, pickupCode, entreeCode, ticketsVoorSlot,
  fooiUit, pasTegoedToe, verdienPunten, liveCodename, haversine, pushLive,
  notifySupplier, sseToSupplier, sseToOffice, zorgVoor, zorgContact, keuken,
  ledenvoordeelVoor }) => {

  /* Zodra het lid echt bij een partner koopt, opent de chatlijn: ze zijn
     dan geen vreemden meer. Idempotent en stil voor gasten. */
  const openLijnVoor = (s, session) => {
    if (!s || session.tier === 'guest') return;
    try { zorgContact(s, session.key, liveCodename(session), session.tier); } catch (e) {}
  };

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
  boekingenVoegToe(ticket);
  save();
  return { ok: true, ticket }; // afrekenen via /api/booking/pay of de Butler
}

function betaalBoekingVoor(session, body) {
  const b = boekingMetRef(body.ref);
  if (!b || (b.customerKey || b.customerTier) !== session.key) return { status: 404, error: 'Boeking niet gevonden.' };
  if (b.paid) return { status: 409, error: 'Al betaald.' };
  if (b.status === 'wacht-op-betaling' && Date.now() - new Date(b.at) > 30 * 60000)
    return { status: 410, error: 'Deze aanvraag is verlopen. Boek opnieuw.' };
  // punten-tegoed (RTG legt bij) en spaarpunten
  const kortingB = pasTegoedToe(session.key, b.price || 0);
  if (kortingB) b.puntenKorting = kortingB;
  // het RTG-ledenvoordeel per genre (de boardroom bepaalt; RTG legt bij)
  const voordeelB = ledenvoordeelVoor(findSupplier(b.supplierCode), (b.price || 0) - kortingB);
  if (voordeelB) b.regieKorting = voordeelB;
  b.paid = true;
  b.paidAt = new Date().toISOString();
  if (b.status === 'wacht-op-betaling') b.status = 'aangevraagd';
  verdienPunten(session.key, (b.price || 0) - kortingB - voordeelB, b.supplierName);
  openLijnVoor(findSupplier(b.supplierCode), session);
  save();
  notifySupplier(b.supplierCode, { icon: '🗓️', title: 'Nieuwe boeking (betaald)', body: b.customerCodename + ': ' + b.service.name + (b.wanneer ? ' · ' + b.wanneer : '') + ' · € ' + b.price });
  sseToSupplier(b.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  return { ok: true, boeking: b };
}

  /* De bestel- en ritlaag draaien als submodules op een gedeelde context,
     een keer opgebouwd bij het opstarten. */
  const ctx = { db, save, crypto, schoon, PERSONAS, findSupplier, ledenPrijs, optieAan,
    leeftijdVan, geborenVan, alcoholGrensVan, pickupCode, entreeCode, ticketsVoorSlot,
    fooiUit, pasTegoedToe, verdienPunten, liveCodename, haversine, pushLive,
    notifySupplier, sseToSupplier, sseToOffice, zorgVoor, zorgContact, keuken,
    orderMetRef, ordersVoegToe, ordersVanKlant, boekingMetRef, boekingenVoegToe, openLijnVoor, ledenvoordeelVoor };
  const { plaatsOrderVoor, betaalOrderVoor, rekeningVoor, betaalRekeningVoor } = require('./lidacties/bestellen')(ctx);
  const { vraagRitVoor, betaalRitVoor } = require('./lidacties/ritten')(ctx);

  return { plaatsOrderVoor, betaalOrderVoor, rekeningVoor, betaalRekeningVoor, koopTicketVoor, betaalBoekingVoor, vraagRitVoor, betaalRitVoor };
};
