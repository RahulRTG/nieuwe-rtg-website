/* HET CARRIERE LEDGER bij ./idemsleutels-nooit-routes.js -- zes routes die het
   ZELF al weten, en dat is de grond uit de kop van ./idemsleutels-nooit.js:
   die laag is er voor routes die NIET weten dat ze het al gedaan hebben.

   Apart van ./idemsleutels-nooit-carriere.js om dezelfde reden als dat bestand
   apart staat van de hoofdlijst: samen gaan ze over de 10 kB (keuringsregel 13),
   en de naad is een ONDERWERP -- daar de machtiging en de rugdekking, hier het
   ledger.

   WAAROM EEN AFGESPEELD ANTWOORD HIER EXTRA SCHADELIJK IS. Een duplicaatlaag
   geeft bij een tweede identiek verzoek het antwoord van de eerste terug. In dit
   domein is dat antwoord altijd "gelukt", terwijl de kern juist 409 zegt -- en
   die 409 draagt hier de hele uitleg waarom een ledger geen dubbele regel kan
   hebben ("een ledger kan niets wissen"). Wie die weigering wegpoetst, laat een
   mens denken dat hij twee titels heeft opgeschreven terwijl er een staat, of
   erger: hij laat hem de dubbele regel nooit zien terwijl die er WEL staat.

   De dubbeltik-ronde van 11 september 2026 staat per route in
   ./mutatiecontracten-carriereledger.js; deze lijst herhaalt dat bewijs niet,
   hij zegt alleen waarom er geen laag overheen komt. */
'use strict';

module.exports = Object.freeze({
  'POST /api/carriere/ledger/zet':
    'weigert een woord-voor-woord identieke regel op dezelfde dag met 409 en de uitleg dat een ledger ' +
    'niets kan wissen; een afgespeeld succes verbergt juist die uitleg en laat het lid denken dat er ' +
    'twee regels staan',
  'POST /api/carriere/ledger/intrek':
    'weigert met 409 zodra de regel al is ingetrokken; een afgespeeld antwoord zou de reden en het ' +
    'tijdstip van de EERSTE intrekking als die van de tweede laten lezen',
  'POST /api/carriere/ledger/stopdelen':
    'weigert met 409 zodra de deelcode gestopt is; een afgespeeld succes verbergt dat hij al gestopt was ' +
    'en daarmee sinds wanneer -- precies wat je bij een geschil wilt weten',
  'POST /api/office/carriere/ledger/bevestig':
    'weigert een identieke bevestiging met 409; een afgespeeld succes zou de medewerker laten denken dat ' +
    'zijn tweede aftekening is vastgelegd terwijl die van een collega al stond',
  'POST /api/supplier/carriere/bevestig':
    'zelfde weigering aan de zaakkant; de naam waaronder wordt bevestigd is die van de ZAAK met de ' +
    'medewerker erachter, dus een afgespeeld antwoord kan een andere medewerker de eer van een collega geven',
  'POST /api/supplier/carriere/intrek':
    'weigert met 409 zodra de bevestiging is ingetrokken; een zaak die haar eigen woord terugneemt hoort ' +
    'te zien DAT het al was teruggenomen en niet een tweede keer succes te lezen'
});
