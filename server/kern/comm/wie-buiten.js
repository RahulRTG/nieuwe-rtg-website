/* WAT EEN ACTOR NODIG HEEFT VAN BUITEN: zijn naam, en de lijn waarop hij
   luistert.

   Geknipt uit ./wie.js omdat dat bestand over de leesgrens ging, en omdat deze
   twee er anders in staan dan de rest: alles daar is pure vorm -- een sleutel
   uit elkaar halen, twee sleutels vergelijken -- en dit zijn de twee plekken
   waar de buitenwereld binnenkomt. Ze krijgen hun opzoekers mee bij het
   opstarten (kernlaag4), zodat kern/comm niets weet van db, accounts of de
   leverancierskast.

   ./wie.js geeft ze gewoon door naar buiten; wie er tot nu toe naar vroeg,
   merkt niets. */
'use strict';

module.exports = ({ ontleed }) => {
/* ----------------------------------------------------------- de naam

   De kern toont nooit een sleutel maar een naam, en tot nu toe was dat altijd
   een codenaam. Een zaak heeft geen codenaam: de naam van een restaurant is
   openbaar en juist wat de klant moet zien. Een medewerker heeft er ook geen,
   en die naam is wel gevoelig -- daarom komt hij hier wel uit de bron, maar
   beslist ./index.js of hij getoond wordt (alleen binnen dezelfde zaak).

   De opzoekers komen van buiten (kernlaag4), zodat dit bestand niets weet van
   db, accounts of de leverancierskast. */
function maakNaam({ codenaamVan, zaakNaam, mensNaam, gezinNaam }) {
  return function naamVan(sleutel) {
    const a = ontleed(sleutel);
    if (!a) return null;
    if (a.soort === 'lid') return codenaamVan ? codenaamVan(a.sleutel) : null;
    if (a.soort === 'zaak') return (zaakNaam ? zaakNaam(a.code) : null) || 'Een zaak';
    if (a.soort === 'mens') return (mensNaam ? mensNaam(a.code, a.nummer) : null) || 'Een collega';
    if (a.soort === 'gezin') return (gezinNaam ? gezinNaam(a.code, a.nummer) : null) || 'Een gezinslid';
    return 'RTG';
  };
}

/* ------------------------------------------------------- het sein

   seinNaarDeRest() in de kern stuurde alles naar sseToCustomer -- de stroom
   van de ledenapp. Voor een zaak komt dat nooit aan: die luistert op
   sseToSupplier. Zonder deze wissel zou een zakelijk gesprek gewoon werken en
   alleen niet bijwerken, en dat is het soort defect dat maanden blijft staan
   omdat "even verversen" het verbergt. */
function maakSein({ sseToCustomer, sseToSupplier, sseToOffice }) {
  return function sein(sleutel, event, data) {
    const a = ontleed(sleutel);
    if (!a) return;
    if (a.soort === 'lid') return sseToCustomer && sseToCustomer(a.sleutel, event, data);
    if (a.soort === 'kantoor') return sseToOffice && sseToOffice(event, data);
    /* Een gezinsprofiel heeft geen open lijn in dit huis: de RTF-app haalt
       zelf op. Niets sturen is hier het eerlijke antwoord, en beter dan het
       naar de leverancierstroom sturen omdat de vorm toevallig lijkt. */
    if (a.soort === 'gezin') return;
    /* Zaak en mens luisteren allebei op de stroom van hun zaak; de app aan die
       kant kijkt zelf of het bericht voor het team of voor hem is. */
    return sseToSupplier && sseToSupplier(a.code, event, data);
  };
}
  return { maakNaam, maakSein };
};
