/* De ervaring-laag: alles wat de reis van het lid rond de bestelling heen
   compleet maakt. Tien functies in een module, met hetzelfde maak...(state)-
   patroon als de rest van de kern:

   1. tafelreserveringen (lid vraagt aan, de zaak beslist)
   2. annuleren door het lid (order/rit/boeking, met nette terugbetaalregels)
   3. reviews (1-5 sterren na een afgeronde dienst; O(1)-gemiddelde via stats)
   4. favorieten (mijn adressen per lid)
   5. fooi (bij het betalen; gaat naar het team, telt mee in het Z-rapport)
   6. de reisagenda (alles met een datum samengevoegd tot een dagprogramma)
   7. rekening splitsen (betaalverzoeken naar verbonden vrienden)
   8. wachtlijst (vol event of tijdslot; automatisch bericht bij een vrije plek)
   9. RTG-punten (sparen bij elke betaling; verzilveren naar tegoed dat RTG
      bijlegt, de zaak ontvangt altijd het volle bedrag)
  10. meldingsvoorkeuren (per scope aan of uit; afgedwongen in notify) */

const MELDING_SCOPES = ['orders', 'events', 'salon', 'live', 'apply', 'wachtlijst', 'assets', 'fluister'];

const { orderMetRef, boekingMetRef, boekingenVanKlant } = require('../db'); // O(1)-index i.p.v. array-scans

function maakErvaring({ db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, zijnVrienden, ticketsVoorSlot, optieAan }) {
  const id = () => crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const rond = n => Math.round(n * 100) / 100;

  /* ---- de twee delen: tafels (reserveren/planning) en ledenbeleving ---- */
  const ctx = { db, save, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice,
    zijnVrienden, ticketsVoorSlot, optieAan, orderMetRef, boekingMetRef, boekingenVanKlant,
    id, nu, vandaag, rond, MELDING_SCOPES };
  return Object.assign({},
    require('./ervaring/tafels')(ctx),
    require('./ervaring/leden')(ctx));
}

module.exports = { MELDING_SCOPES, maakErvaring };
