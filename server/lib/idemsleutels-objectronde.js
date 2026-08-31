/* ============================================================================
   IDEM-SLEUTELS -- DE TIEN UIT DE OBJECTRONDE (31 augustus 2026).

   Deel van ./idemsleutels.js.

   Toen de proefopstelling een festival, een entiteit, een onderneming, een
   onderzoek en een stadsafdeling kreeg, gaven 192 routes voor het eerst een
   uitslag. Tien daarvan deden zonder sleutel het werk opnieuw.

   Zeven van de tien zijn TOEVOEGINGEN aan een onderzoeksdossier, en dat is geen
   toeval: `taakBij`, `documentBij`, `logBij`, `besluitBij`, `datasetBij` heten
   niet voor niets zo. Een dubbeltik zet er twee in. Alle vijf eisen een
   verplichte tekst of naam (drie tekens), dus de valstrik uit
   ./idemsleutels-nooit.js -- een leeg lijf dat altijd dezelfde vingerafdruk
   geeft -- speelt hier niet.
   ========================================================================== */
'use strict';

const SLEUTELS = {
  /* ---- het werkdossier van een onderzoek: vijf keer toevoegen ---- */
  'POST /api/lab2/werk/taak': { zelfdeVerzoek: true },        // tekst, minimaal 3
  'POST /api/lab2/werk/besluit': { zelfdeVerzoek: true },     // tekst, minimaal 3
  'POST /api/lab2/werk/document': { zelfdeVerzoek: true },    // naam
  'POST /api/lab2/werk/log': { zelfdeVerzoek: true },         // tekst, minimaal 3
  'POST /api/lab2/bewijs/dataset': { zelfdeVerzoek: true },   // naam

  /* Een bron toevoegen aan het onderzoeksplan. TWEE TAKKEN IN EEN ROUTE, en die
     zijn nagelopen: `weg: true` verwijdert (en weigert met 409 als de bron een
     conclusie draagt), anders komt er een bron bij met een verplichte titel. De
     lijven verschillen dus per tak en botsen niet.

     De prijs staat erbij: bij een herhaalde VERWIJDERING geeft de laag "ok"
     terug waar de route zelf 404 zou zeggen. Dat is een stand die als handeling
     leest -- minder erg dan een dubbele bron in een onderzoeksdossier, maar het
     is een afweging en geen gratis winst. */
  'POST /api/lab2/plan/bron': { zelfdeVerzoek: true },

  /* ---- en drie buiten het lab ---- */
  'POST /api/concern/discovery/neem': { zelfdeVerzoek: true },
  /* Neemt een voorstel over en MAAKT DAAR EEN ENTITEIT VAN. Twee keer overnemen
     is twee entiteiten. Het lijf draagt `onderneming`, dus twee oproepen met
     dezelfde onderneming zijn dezelfde bedoeling. */
  'POST /api/onderneming/kas/saldo': { zelfdeVerzoek: true },
  /* kasSaldoZet() ZET het saldo (`o.kasSaldo = { bedrag }`) en telt niet op --
     twee keer hetzelfde bedrag geeft dezelfde stand. Wat de proef zag bewegen
     was de tijdstempel ernaast. Dat het over geld gaat maakt de regel hier
     belangrijker en niet gevaarlijker: er verdwijnt niets door de tweede oproep
     op te vangen. */
  'POST /api/rtfos/stad/kernteam': { zelfdeVerzoek: true },
  /* Een pure overschrijving: `stad.kernteam = namen.map(...)`. Twee keer
     dezelfde namenlijst zetten laat dezelfde lijst achter. */

  /* ---- en de tiende, die met opzet GEEN regel krijgt ---- */
  'POST /api/lab2/coach/conclusie': { nietIdempotent: true,
    waarom: 'een conclusievoorstel vragen aan het model: twee keer vragen is twee antwoorden, en een ' +
      'onderzoeker die het eerste voorstel niet overtuigend vond vraagt het opnieuw. Zelfde lezing als ' +
      'de concierge-, bijles- en babymoment-vragen elders in dit huis' }
};

module.exports = { SLEUTELS };
