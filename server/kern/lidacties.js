/* Lidacties: de transactiefuncties van het lid als kern-module met
   EXPLICIETE afhankelijkheden. Bestellen, tickets en ritten, elk als
   (session, body) -> { ok, ... } | { status, error }. Dit zijn exact de
   functies achter de app-knoppen EN achter Rahul (via de
   acties-registry in server.js), dus er is een codepad en geen drift.
   De regels reizen mee: ledenprijsgarantie, 86 van de keuken, de
   leeftijds/alcohol-grens per land, het zorgprofiel en het betaalmoment
   van de zaak. */
// De transactie-index (O(1) opzoeken op ref/klant/zaak) komt rechtstreeks uit de
// opslaglaag: db.js is een singleton en de index hoort bij de collecties zelf.
const { orderMetRef, ordersVoegToe, ordersVanKlant, boekingMetRef, boekingenVoegToe } = require('../db');

module.exports = ({ db, save, crypto, schoon, PERSONAS, findSupplier, ledenPrijs, optieAan,
  leeftijdVan, geborenVan, idGeverifieerd, alcoholGrensVan, pickupCode, entreeCode, ticketsVoorSlot,
  fooiUit, pasTegoedToe, herstelTegoed, verdienPunten, liveCodename, haversine, pushLive,
  notifySupplier, sseToSupplier, sseToOffice, zorgVoor, zorgContact, keuken,
  ledenvoordeelVoor, facturatie, pay }) => {

  /* Een betaalde lidtransactie wordt een factuur -- waarom dat er niet was en
     waarom het op EEN plek staat: zie de kop van ./lidacties/factuur.js. */
  const factuurVoorLid = require('./lidacties/factuur').maakFactuurVoorLid(facturatie);

  /* Zodra het lid echt bij een partner koopt, opent de chatlijn: ze zijn
     dan geen vreemden meer. Idempotent en stil voor gasten. */
  const openLijnVoor = (s, session) => {
    if (!s || session.tier === 'guest') return;
    try { zorgContact(s, session.key, liveCodename(session), session.tier); } catch (e) {}
  };

function koopTicketVoor(session, body) {
  const s = findSupplier(body.supplierCode);
  const caps = s ? (db.capsVan(s)) : [];
  if (!s || !caps.includes('tickets')) return { status: 404, error: 'Geen activiteitenpartner gevonden.' };
  const act = (s.activiteiten || []).find(a => a.id === body.activiteitId);
  if (!act) return { status: 404, error: 'Deze activiteit bestaat niet (meer).' };
  const datum = String(body.datum || '');
  const tijd = String(body.tijd || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum < new Date().toISOString().slice(0, 10))
    return { status: 400, error: 'Kies een datum vanaf vandaag.' };
  if (!(act.tijden || []).includes(tijd)) return { status: 400, error: 'Kies een tijdslot van deze activiteit.' };
  /* De sluitdag van de zaak (kern/activiteitendicht.js): een gesloten dag is
     niet vol maar DICHT, en dat verschil hoort de gast te lezen -- "vol" nodigt
     uit tot een ander slot op dezelfde dag, "gesloten" niet. */
  const dicht = require('./activiteitendicht').dichtOp(s, datum, act.id);
  if (dicht) return { status: 409, error: s.name + ' is op ' + datum + ' gesloten' +
    (dicht.reden ? ' (' + dicht.reden + ')' : '') + '. Kies een andere dag.' };
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
  return { ok: true, ticket }; // afrekenen via /api/booking/pay of Rahul
}

function betaalBoekingVoor(session, body) {
  const b = boekingMetRef(body.ref);
  if (!b || (b.customerKey || b.customerTier) !== session.key) return { status: 404, error: 'Boeking niet gevonden.' };
  if (b.paid) return { status: 409, error: 'Al betaald.' };
  /* Een geannuleerde boeking blijft geannuleerd. Zonder deze regel valt de enige
     poort weg zodra er is terugbetaald -- de annulering zet paid weer op false --
     en kan dezelfde retour-boeking opnieuw afgerekend worden. Zelfde vorm als bij
     de bestelling en de rit; alle drie stonden ze op alleen `paid`. */
  if (b.refunded || ['geweigerd', 'terugbetaald', 'geannuleerd'].includes(b.status))
    return { status: 409, error: 'Deze boeking is geannuleerd (' + b.status + ') en kan niet opnieuw betaald worden.' };
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
  // en de factuur, net als bij een bestelling en een rit (zie factuurVoorLid)
  factuurVoorLid({ soort: 'dienst', supplierCode: b.supplierCode, supplierNaam: b.supplierName,
    codenaam: b.customerCodename, ref: b.ref, methode: 'rtg',
    regels: [{ omschrijving: (b.service && b.service.name) || 'Dienst', aantal: 1, stuk: b.price || 0 }] });
  notifySupplier(b.supplierCode, { icon: 'agenda', title: 'Nieuwe boeking (betaald)', body: b.customerCodename + ': ' + b.service.name + (b.wanneer ? ' · ' + b.wanneer : '') + ' · € ' + b.price });
  sseToSupplier(b.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  return { ok: true, boeking: b };
}

  /* De bestel- en ritlaag draaien als submodules op een gedeelde context,
     een keer opgebouwd bij het opstarten. */
  /* De submodules krijgen `factuurVoorLid` en NIET de facturatiemotor zelf:
     dan is er een plek die weet hoe een lidtransactie een factuur wordt, en
     kan geen van de vier er zijn eigen variant naast zetten. */
  const ctx = { db, save, crypto, schoon, PERSONAS, findSupplier, ledenPrijs, optieAan, factuurVoorLid,
    leeftijdVan, geborenVan, idGeverifieerd, alcoholGrensVan, pickupCode, entreeCode, ticketsVoorSlot,
    fooiUit, pasTegoedToe, herstelTegoed, verdienPunten, liveCodename, haversine, pushLive, pay,
    notifySupplier, sseToSupplier, sseToOffice, zorgVoor, zorgContact, keuken,
    orderMetRef, ordersVoegToe, ordersVanKlant, boekingMetRef, boekingenVoegToe, openLijnVoor, ledenvoordeelVoor };
  const { plaatsOrderVoor, betaalOrderVoor } = require('./lidacties/bestellen')(ctx);
  const { rekeningVoor, betaalRekeningVoor } = require('./lidacties/rekening')(ctx);
  const { vraagRitVoor, betaalRitVoor } = require('./lidacties/ritten')(ctx);

  return { plaatsOrderVoor, betaalOrderVoor, rekeningVoor, betaalRekeningVoor, koopTicketVoor, betaalBoekingVoor, vraagRitVoor, betaalRitVoor };
};
