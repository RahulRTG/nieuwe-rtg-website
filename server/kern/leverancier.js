/* De leverancier-laag: de request-tijd read/write-helpers van de partner-app.
   De publieke weergave (publicSupplier, publicTrip), het complete dashboard
   (supplierState), de kassa-dag (posDay), gastchat (deptsFor/getChat), kamers en
   housekeeping (setRoomHk/addTicket), slimme deuren (unlockDoor), tickets, De
   Salon (salonNaarVolgers), de AI-zoekhulpjes en de zaak-opties.

   De kleine primitieven en glue (findSupplier, de SSE-routers, notifySupplier,
   logActivity, supplierAuth, ensureSupplierDefaults) blijven in server.js: die
   worden al vroeg, door andere kern-fabrieken, gebruikt. Deze fabriek draait ná
   de werk-kern, omdat supplierState werkgeverSollicitatie meeneemt. */

const HK_STATUSES = ['schoon', 'vuil', 'bezig', 'bezet', 'defect'];
/* Aan de kassa zijn er twee manieren van betalen: contant of RTG Pay (de
   betaalcode uit de app, geind via het grootboek). 'kamer' en 'tafel' zijn
   geen betaling maar uitstel: de last komt bij de check-out of het afrekenen
   van de tafel alsnog langs deze twee. */
const POS_METHODS = ['contant', 'rtgpay', 'kamer', 'tafel'];
const DOOR_RELOCK_MS = 10000;
const TABLE_STATUSES = ['vrij', 'bezet', 'gereserveerd', 'dicht'];
/* Elke zaak is baas over de eigen opties. Alles kan aan of uit, met een
   principiele uitzondering: betalen via de app staat altijd aan. Wel kiest de
   zaak het moment: vooraf of achteraf. */
const ZAAK_OPTIES = {
  betaalVooraf: 'vooraf betalen',
  gastchat: 'de gastchat',
  ritten: 'ritaanvragen',
  deurenGast: 'de digitale gastsleutel',
  events: 'event-aanmeldingen'
};

const { ordersVanZaak, boekingenVanZaak } = require('../db'); // O(1) per zaak i.p.v. een scan over alle orders/boekingen

function maakLeverancier({ db, save, crypto, i18n, notify, broadcastSync, sseToSupplier, sseToCustomer, logActivity, findSupplier, connectedSupplierCodes, guestsFor, gidsHaal, etaMinutes, haversine, accounts, werkgeverSollicitatie }) {
  function publicTrip(t, staffRate, lang) {
    const out = {
      id: t.id, dest: t.dest, visual: t.visual, title: i18n.localize(t.title, lang),
      dates: i18n.localize(t.dates, lang), desc: i18n.localize(t.desc, lang), includes: i18n.localizeList(t.includes, lang),
      price: Math.round(t.netto * (1 + db.data.partnerService))
    };
    if (staffRate != null) out.staffPrice = Math.round(t.netto * (1 + staffRate));
    return out;
  }

  // afdelingen per sector: de gast kiest met wie hij spreekt

  /* De drie lagen (gastcontact, zaak, state) draaien als submodules op een
     gedeelde context, een keer opgebouwd bij het opstarten; elke laag komt
     na het mounten de context in omdat supplierState ze allemaal gebruikt. */
  const ctx = { db, save, crypto, i18n, notify, broadcastSync, sseToSupplier, sseToCustomer, logActivity,
    findSupplier, connectedSupplierCodes, guestsFor, gidsHaal, etaMinutes, haversine, accounts, werkgeverSollicitatie,
    HK_STATUSES, POS_METHODS, DOOR_RELOCK_MS, TABLE_STATUSES, ZAAK_OPTIES,
    ordersVanZaak, boekingenVanZaak, publicTrip };
  const deelGastcontact = require('./leverancier/gastcontact')(ctx);
  Object.assign(ctx, deelGastcontact);
  const deelZaak = require('./leverancier/zaak')(ctx);
  Object.assign(ctx, deelZaak);
  const deelState = require('./leverancier/state')(ctx);
  const { deptsFor, chatKeyOf, getChat, validDept, zorgContact, klantSalon } = deelGastcontact;
  const { publicSupplier, magBezorgen, ticketsVoorSlot, addTicket, setRoomHk, salonNaarVolgers, posDay, unlockDoor, makeSupplierCode, managerOnly, optieAan, aiFindRoom, aiFindDoor } = deelZaak;
  const { supplierState } = deelState;

  return {
    publicTrip, deptsFor, chatKeyOf, getChat, validDept, zorgContact, klantSalon, publicSupplier, magBezorgen,
    ticketsVoorSlot, addTicket, setRoomHk, salonNaarVolgers, posDay, unlockDoor,
    makeSupplierCode, managerOnly, optieAan, aiFindRoom, aiFindDoor, supplierState
  };
}

module.exports = { HK_STATUSES, POS_METHODS, DOOR_RELOCK_MS, TABLE_STATUSES, ZAAK_OPTIES, maakLeverancier };
