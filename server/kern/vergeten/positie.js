/* Vergeten, deelbestand "positie": DE PLEK VAN EEN LID, WAAR HIJ OOK LIGT.

   POSITIESTROOM.json telt elke plek waar de positie van een mens blijft
   staan, en zeventien daarvan hingen aan een ledensleutel of codenaam die deze
   route niet kende: een rit, een reis, een SOS, een flitsmelding, een
   bezorgadres als punt. Na "verwijder mijn gegevens" bleven ze gewoon staan.

   WAAROM EEN TABEL EN GEEN REGELS. Bijna al die plekken zijn van een domein
   met een eigen deur: mobiliteit en veiligheid hebben een opslagcontract
   (keuringsregel 53), flits en horeca bezitten hun collectie
   (kern/eigencollectie.js, regel 63). Hier rechtstreeks in db.data gaan wissen
   zou precies die grens breken. Dus vraagt deze route het domein, en het domein
   wist -- met zijn eigen kennis van wat er van de ander is en blijft.

   Wat deze tabel WEL is: de lijst die zegt welke collectie op welke manier
   meegaat, op een plek. Elke rij is [collectie, functie]. De functie staat
   hieronder; een collectie die er niet in staat, is niet vergeten -- en dat
   leest scripts/positiestroom.js hier terug, net zoals EIGEN_TAKKEN in
   ./eigen.js. Wie een rij toevoegt zonder functie, laat die meter zakken.

   Wat er per domein gebeurt (WEG of DE PERSOON ERUIT) staat bij het domein:
   kern/mobiliteit/vergeten.js, kern/veiligheid/vergeten.js,
   kern/ontmoeting/vergeten.js, en een functie `vergeet...` in kern/flits.js,
   kern/plaats/opslag.js, kern/gemeente/meldingen.js, kern/stadsweefsel/
   zaakbeeld.js, kern/horeca.js en kern/modebezorg.js. test/vergeten-positie
   .test.js zet in elk een herkenbare plek van een lid en controleert dat er na
   deze route niets van over is.

   OPEN, en hier opgeschreven zodat het niet als gedaan leest: dit is een
   POSITIEwisser. Een bestelling (orders) houdt na deze stap haar klantsleutel
   -- dat is de index van de transactielaag, en die herschrijven vraagt een
   besluit over server/db/tx -- en een horecarekening houdt de codenaam van de
   gast als `gastId`. Het punt is er in beide weg. */
'use strict';

const POSITIE_TAKKEN = Object.freeze([
  ['mobOpdrachten', 'wisMobiliteit'],      // ritten: punten en reiziger eruit, de rit blijft
  ['mobReizen', 'wisMobiliteit'],          // eigen reisoverzichten: weg
  ['mobFavorieten', 'wisMobiliteit'],      // eigen plekken: weg
  ['veilig', 'wisVeilig'],                 // plek, spoor, kring en alarmen
  ['ontmoetDates', 'wisOntmoeten'],        // date-positie en SOS-plek
  ['flitsMeldingen', 'wisFlits'],          // eigen meldingen weg, stemmen eruit
  ['plaatsLog', 'wisPlaats'],              // het actielog langs de hekken
  ['plaatsWaarnemingen', 'wisPlaats'],     // binnen/buiten per hek
  ['gemeenteMeldingen', 'wisGemeente'],    // de melder eraf, de plek blijft bij het probleem
  ['weefselZaken', 'wisWeefsel'],          // idem in het stadsweefsel
  ['horeca', 'wisHoreca'],                 // het bezorgpunt op de rekening
  ['orders', 'wisOrders'],                 // het bezorgpunt op een bestelling
  ['modeBezorg', 'wisModeBezorg']          // bestemming en koerierpunt
]);

module.exports = (kern) => {
  /* Een domein zonder zijn vergeetfunctie is geen stille overslag maar een
     fout: dan blijft precies de plek staan die deze tabel belooft te wissen. */
  const eis = (fn, naam) => {
    if (typeof fn !== 'function') throw new Error('vergeten/positie: ' + naam + ' ontbreekt in de kern; ' +
      'zonder die functie blijft de positie van dit lid staan');
    return fn;
  };

  const WISSERS = {
    wisMobiliteit: ({ key }) => eis(kern.mobVergeetLid, 'mobVergeetLid')(key),
    wisVeilig: ({ key }) => eis(kern.veiligVergeet, 'veiligVergeet')(key),
    wisOntmoeten: ({ key }) => eis(kern.ontmoetVergeetLid, 'ontmoetVergeetLid')(key),
    wisFlits: ({ key, codenaam }) => eis(kern.flitsVergeet, 'flitsVergeet')(key, codenaam),
    wisPlaats: ({ codenaam }) => eis(kern.plaats && kern.plaats.plaatsVergeet, 'plaats.plaatsVergeet')(codenaam),
    wisGemeente: ({ key, codenaam }) =>
      eis(kern.gemeente && kern.gemeente.vergeetMelder, 'gemeente.vergeetMelder')(key, codenaam),
    wisWeefsel: ({ codenaam }) =>
      eis(kern.weefsel && kern.weefsel.weefselVergeetMelder, 'weefsel.weefselVergeetMelder')(codenaam),
    // de horecakern hangt niet aan de tas maar wordt per route gemaakt (kern/horeca.js)
    wisHoreca: ({ codenaam }) => require('../horeca')(kern).vergeetBezorgpunten(codenaam),
    /* De bestellingen lopen door de transactielaag (server/db/tx); dat is hun
       deur. Een bestelling is de administratie van de zaak en blijft, met het
       adres als tekst; het punt gaat weg, zoals bij afronden (NAVIGATIE.md N20). */
    wisOrders: ({ key }) => {
      let n = 0;
      for (const o of eis(kern.ordersVanKlant, 'ordersVanKlant')(key)) if (o && o.geo) { o.geo = null; n++; }
      return { punten: n };
    },
    wisModeBezorg: ({ key }) => eis(kern.mbVergeet, 'mbVergeet')(key)
  };

  for (const [tak, fn] of POSITIE_TAKKEN)
    if (typeof WISSERS[fn] !== 'function') throw new Error('vergeten/positie: ' + tak + ' wijst naar ' + fn + ', en die bestaat niet');

  /* Elke wisser een keer, ook als hij meer collecties dekt. Het antwoord zegt
     per wisser wat er gebeurde, voor wie het wil nalopen. */
  function wisPosities(key, codenaam) {
    const uit = {};
    for (const fn of new Set(POSITIE_TAKKEN.map(t => t[1]))) uit[fn] = WISSERS[fn]({ key, codenaam });
    return uit;
  }

  return { wisPosities, POSITIE_TAKKEN };
};
module.exports.POSITIE_TAKKEN = POSITIE_TAKKEN;
