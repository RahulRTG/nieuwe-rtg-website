/* De verblijf-laag (toren hotel): van kamercatalogus naar echte verblijven.

   Een verblijf heeft een aankomst- en vertrekdatum, een kamer en een prijs
   (nachten maal kamerprijs) en loopt de keten aangevraagd -> bevestigd ->
   ingecheckt -> uitgecheckt (of geweigerd, geannuleerd, no-show). De regels:

   - OVERLAP: een kamer kan maar een gast tegelijk hebben; een aanvraag die
     overlapt met een bevestigd of ingecheckt verblijf op dezelfde kamer
     ketst af met de eerstvolgende vrije datum erbij.
   - CHECK-IN: de kamer gaat op "bezet" voor housekeeping en de logies gaan
     automatisch als kamerlast op de rekening (posSale, method 'kamer').
     Daarmee int de bestaande kassa-check-out ALLES in een keer: logies,
     minibar en roomservice, via RTG Pay of contant.
   - CHECK-OUT (verblijf): sluit het verblijf en zet de kamer op "vuil";
     het geld loopt via de kassa (pos/checkout), niet hier.
   - RECEPTIE: het bord van vandaag: aanvragen, aankomsten, vertrekken,
     wie er in huis is en de bezetting. */

module.exports = ({ db, save, crypto, schoon, findSupplier, notify, notifySupplier, sseToSupplier, sseToCustomer }) => {
  const id = () => crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const isDatum = x => /^\d{4}-\d{2}-\d{2}$/.test(String(x || ''));
  const lijst = () => (db.data.verblijven = Array.isArray(db.data.verblijven) ? db.data.verblijven : []);
  const nachtenTussen = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

  const ACTIEF = ['aangevraagd', 'bevestigd', 'ingecheckt'];
  function overlapt(supplierCode, roomId, aankomst, vertrek, negeerId) {
    return lijst().find(v =>
      v.supplierCode === supplierCode && v.roomId === roomId && v.id !== negeerId &&
      ['bevestigd', 'ingecheckt'].includes(v.status) &&
      v.aankomst < vertrek && aankomst < v.vertrek);
  }

  /* De gast- en receptielaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten. */
  const ctx = { db, save, crypto, schoon, findSupplier, notify, notifySupplier, sseToSupplier, sseToCustomer,
    id, nu, vandaag, isDatum, lijst, nachtenTussen, ACTIEF, overlapt };
  const { boek, mijnVerblijven, annuleer } = require('./verblijf/gast')(ctx);
  const { beslis, checkIn, checkOut, noShow, gastDeur, kamerplanning, receptie } = require('./verblijf/receptie')(ctx);

  return { verblijfBoek: boek, mijnVerblijven, verblijfAnnuleer: annuleer, verblijfBeslis: beslis, verblijfCheckin: checkIn, verblijfCheckout: checkOut, verblijfNoShow: noShow, receptie, kamerplanning, gastDeur };
};
