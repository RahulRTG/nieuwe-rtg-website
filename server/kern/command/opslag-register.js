/* ============================================================================
   HET OPSLAGCONTRACT VAN COMMAND -- de enige deur van dit domein naar db.data.

   Vijfde domein achter een contract, en het eerste dat de woordenschat van de
   vorige vier NIET aankon. Payroll, concern, veiligheid en mobiliteit hadden
   genoeg aan "wat bezit ik" en "wat lees ik van een ander". Command heeft vier
   soorten omgang met opslag, en ze door elkaar halen zou het contract juist een
   leugen maken. Daarom staan ze hier apart, met hun eigen naam:

     bak()               de VEERTIEN collecties die command bezit
     teller()            een GETAL, geen collectie -- het incidentnummer
     gedeeld.*           gedeeld en SCHRIJFBAAR: de schakelkast
     vreemd.*            van een ander en alleen LEZEND
     vak()               het standaardvak van de compartimentenlaag

   WAAROM `gedeeld` NIET HETZELFDE IS ALS `vreemd`. In de vorige vier contracten
   betekende `vreemd`: van een ander domein, en wij lezen alleen. Command SCHRIJFT
   in db.data.techniek.functies -- de schakelkast waarmee functies aan en uit
   gaan per land, per stad en per canary. Dat is niet stiekem: command IS het
   bedieningsvlak, en een bedieningsvlak dat de schakelkast niet mag bedienen
   heeft geen bestaansrecht. Maar het is ook niet van command: server/functies.js
   zegt met zoveel woorden dat de stand daar staat, en twintig bestanden buiten
   dit domein raken diezelfde collectie aan.

   Een contract dat dat `vreemd` zou noemen, zou liegen over de richting. Een
   contract dat het `bak` zou noemen, zou liegen over het eigendom. Vandaar een
   derde woord, en de belofte die eronder hoort is smaller: command bedient deze
   collectie, hij bezit hem niet, en wie de invarianten ervan zoekt vindt ze bij
   server/functies en niet hier.

   DRIE KOPIEEN VAN DEZELFDE ACCESSOR ZIJN ER EEN GEWORDEN. staat() -- twee
   regels die db.data.techniek.functies aanmaken -- stond in stadstart.js,
   landpakket.js en canary.js, alle drie woord voor woord gelijk, en een vierde
   keer in server/functies/wachter.js. Dit contract haalt de drie van command
   weg. De vierde blijft staan: wachter.js hoort bij de EIGENAAR van die
   collectie, en die verhuizen is werk in een domein dat nog geen contract heeft.
   Dat staat hier zodat het niet als vergeten leest.

   WAAROM vak() BESTAAT, EN WAAROM DAT GEEN GAT IS. Negen bestanden hier
   (journaal, operator, beleid, runbooks, sonde, zaken, register, mdm, mdmsamen)
   werken op een VAK: een houder waarin dezelfde sleutels worden bijgehouden.
   db.data is daar het standaardvak van, en een aanroeper mag een ander vak
   meegeven -- zo krijgt elke zaak zijn eigen journaalketen met zijn eigen zegel
   in plaats van dat alle zaken in een lijst schrijven waar ze elkaars regels
   zouden zien. Zie de kop van ./journaal.js.

   Die laag leest dus met OPZET collecties die pas bij naam bekend zijn als de
   configuratie ze noemt, en een vast register kan dat niet dekken zonder de
   voorziening kapot te maken. vak() geeft daarom het hele standaardvak terug.
   Dat is de zwakste plek van dit contract en hij hoort hardop genoemd: het is
   EEN deur met een naam en een reden, in plaats van negen zonder. Wie hier ooit
   een echte grens wil, moet eerst de vraag beantwoorden die eronder ligt --
   welke collecties mag een register tonen -- en dat is een bevoegdheidsvraag en
   geen opslagvraag.
   ========================================================================== */
'use strict';
/* ----------------------------------------------------------------------------
   WAT ER NIET IN ZIT, MET DE REDEN.
   ------------------------------------------------------------------------- */
const NIET_GEBOUWD = {
  schema: 'Veertien collecties tegelijk een schema geven vraagt per collectie een eigen ronde.',
  validatie: 'Hangt aan het schema en komt er niet voor.',
  bevoegdheid: 'Zit vandaag bij de ROUTE en bij ./toegang.js (rechten en mandaten), niet bij de ' +
    'opslag. Juist hier is dat scherp: vak() geeft een breed venster, en wie dat wil versmallen ' +
    'stelt een bevoegdheidsvraag. Die hoort bij de Authority Graph.',
  gebeurtenissen: 'server/bus.js vervoert wel maar spreekt geen taal (OS.md par. 4).',
  bewaartermijn: 'De bewaarlaag kent dit domein nog niet. commandIncidenten groeit onbegrensd.',
  vensterGrens: 'vak() geeft het hele standaardvak. Een grens daarop vraagt eerst een besluit ' +
    'over welke collecties een register mag tonen -- zie de kop hierboven.'
};

/* ----------------------------------------------------------------------------
   HET REGISTER. De veertien dingen die command BEZIT, met hun vorm.
   ------------------------------------------------------------------------- */
const REGISTER = {
  commandAlarmen:        { soort: 'kaart', wat: 'lopende alarmen van het bedieningsvlak' },
  commandProeven:        { soort: 'kaart', wat: 'uitslagen van de gezondheidsproeven' },
  commandRechten:        { soort: 'lijst', wat: 'wie mag wat in het bedieningsvlak' },
  commandMandaten:       { soort: 'lijst', wat: 'tijdelijke mandaten, met einddatum' },
  commandIncidenten:     { soort: 'lijst', wat: 'incidenten met hun tijdlijn' },
  commandIncidentTeller: { soort: 'getal', wat: 'het volgnummer voor RTG-0001, RTG-0002, ...' },
  commandClaims:         { soort: 'kaart', wat: 'wie een incident heeft opgepakt' },
  commandAgents:         { soort: 'kaart', wat: 'de agenten die meekijken, met hun laatste teken' },
  steden:                { soort: 'kaart', wat: 'per stad: staat RTG daar aan, en sinds wanneer' },
  landen:                { soort: 'kaart', wat: 'per land: welk pakket er draait' },
  zandbakken:            { soort: 'kaart', wat: 'losse compartimenten om iets te beproeven' },
  apiPoort:              { soort: 'kaart', wat: 'de stand van de API-poort per pad' },
  overnames:             { soort: 'kaart', wat: 'wanneer RTG een omgeving van een klant overnam' },
  bijstand:              { soort: 'lijst', wat: 'verzoeken om bijstand vanuit een werkruimte' }
};

const LEEG = { lijst: () => [], kaart: () => ({}), getal: () => 0 };

module.exports = { REGISTER, NIET_GEBOUWD, LEEG };
