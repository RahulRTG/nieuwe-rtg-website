/* WAT ER OPEN BLIJFT, WAT ER OOK GEBEURT -- de lijsten en hun gronden.

   De VRAAG (blijftOpen) staat in ./openpaden.js; hier staat het antwoord waar
   iemand over heeft besloten. Elke regel draagt een uitgeschreven grond, want
   een vrijstelling zonder reden is over een half jaar een vrijstelling die
   niemand meer durft weg te halen.

   ./leesset.js sluit onder isolatie alles waarvan het lezerschap niet is
   BEWEZEN. Dat is de goede regel, en hij heeft twee uitzonderingen die geen
   uitzondering op de veiligheid zijn maar op de MEETMETHODE: paden die om een
   andere reden open horen te blijven dan omdat de proef ze toevallig heeft
   gemeten.

   Ze staan hier samen omdat ze dezelfde vorm hebben -- een genoemde lijst met per
   regel een grond -- en met opzet niet als patroon. Een patroon als
   /api/privacy/ zou elke toekomstige route van dat domein automatisch
   vrijstellen, en juist hier hoort elke vrijstelling een besluit te zijn dat
   iemand heeft genomen.

   ---------------------------------------------------------------------------
   1. DE UITGANG VAN DE STAND ZELF.

   Gemeten en niet bedacht: kern/isolatie/bruikbaarheid.js liet zien dat onder
   `isolatie` de verhalen `zelf-beschermen` en `ontsluiten-aanvragen` op "werkt
   niet" stonden. De routes van deze laag zijn nieuw, dus de proef heeft ze nooit
   gemeten, dus de leesset sloot ze -- en dan kan een mens die in isolatie staat
   zichzelf niet meer beschermen en er ook niet meer uit.

   Een stand zonder uitgang is een val, en een val zet niemand aan.

   ---------------------------------------------------------------------------
   2. WAT EEN MENS OVER ZICHZELF MAG.

   Zes paden zonder functie in de catalogus bleken data-subject-rechten: inzage,
   uitdraai, het inzagejournaal en het intrekken van toestemming. Die horen niet
   dicht te vallen omdat er een incident loopt, en om twee redenen die allebei
   op zichzelf genoeg zijn.

   JURIDISCH: een AVG-recht schort je niet op omdat het even slecht uitkomt. Een
   verzoek om inzage mag een termijn hebben, maar geen beveiligingsstand als
   grond om er niet aan te beginnen.

   EN INHOUDELIJK, wat hier zwaarder weegt: deze zes VERGROTEN geen vermogen.
   Inzage en uitdraai LEZEN wat er al van jou is; toestemming intrekken maakt de
   verzameling wat mag alleen KLEINER. Een beveiligingslaag die een versmalling
   tegenhoudt, werkt tegen zichzelf in.

   WAT ER MET OPZET NIET IN STAAT: /api/privacy/delete. Dat is de enige van de
   zeven die onomkeerbaar is en breed uitwaaiert -- de gemeten collecties laten
   zien dat hij rechten, identiteit, andermans gegevens, koppelingen en de
   beveiliging raakt. Onder een gesloten stand blijft hij dus dicht, en dat is
   geen weigering van het recht: het recht blijft bestaan en de UITVOERING wacht
   tot het account niet meer onder verdenking staat. Wie dat anders wil, neemt
   dat besluit hier en niet met een regex.

   ---------------------------------------------------------------------------
   EN WAT ER OOK NIET IN STAAT: /api/toestel/meting. Dat pad heeft geen functie
   omdat het geen ledenroute is -- kern/toestellen.js geeft een horloge of een
   weegschaal een eigen smalle sleutel die precies een ding kan. Het is dus geen
   blinde vlek in de beschermstand maar een andere deur, en die hoort niet met
   een uitzondering te worden opengezet. */
'use strict';

const EIGEN_UITGANG = Object.freeze({
  '/api/isolatie/mijn': 'de eigen stand kunnen LEZEN; wie niet ziet dat hij dichtstaat, snapt niets',
  '/api/isolatie/mijn/zet': 'zichzelf strenger zetten mag nooit door de bescherming zelf dichtvallen',
  '/api/isolatie/mijn/ontsluiting': 'de uitgang aanvragen',
  '/api/isolatie/mijn/ontsluiting/stap': 'de uitgang aflopen',
  '/api/isolatie/mijn/ontsluiting/stap/opties': 'de uitgang aflopen kan niet zonder het bewijs ervoor aan ' +
    'te vragen; deze route dicht en de vorige open zou een uitgang zijn die je alleen nog met een ' +
    'onbewezen stap kunt nemen',
  '/api/isolatie/mijn/ontsluiting/commit': 'de uitgang afmaken',
  '/api/isolatie/mijn/ontsluiting/afbreken': 'de uitgang laten vallen',

  /* DE UITGANG VAN HET KANTOOR, en die ontbrak hier -- dezelfde val die deze
     lijst voor het LID moest voorkomen, stond voor de EIGENAAR gewoon open.

     Gemeten voor de reparatie: alle vijf paden hieronder stonden onder `isolatie`
     DICHT met de grond NIET_BEWEZEN_LEZER. Ze hangen aan geen enkele functie in
     de catalogus, dus de leesset kende ze niet, en de proef kon ze nooit als
     lezer bewijzen -- het zijn schrijvers, dat is nu juist het punt.

     De zin die de ledenuitgang openzette geldt hier woord voor woord: **een
     stand zonder uitgang is een val, en een val zet niemand aan.** Wie de
     isolatiestand als eigenaar aanzet en hem daarna niet meer kan opheffen, zet
     hem de volgende keer niet aan -- en dan is de knop er wel en gebruikt
     niemand hem (BESTUUR.md grens 6.10). Het is bovendien de hand die REPAREERT,
     dezelfde redenering waarmee 'RTG-Backoffice' in beschermstand-lijst.js
     doorloopt.

     LET OP WAT HIER NIET STAAT: /api/techniek/controle/incident. Die route zet de
     stand van het HUIS, en de huis-stand woont niet in deze laag maar in
     kern/incidentcontrole.js -- die kent zijn eigen weg terug (de ceremonie via
     huisCeremoniePoort). Hem hier opnemen zou suggereren dat deze lijst er iets
     over te zeggen heeft. */
  '/api/techniek/isolatie/zet': 'de hand die de stand zet moet hem ook kunnen VERSTRENGEN tijdens ' +
    'een incident; verstrengen kent geen ceremonie en mag dus nooit dichtvallen',
  '/api/techniek/isolatie/ontsluiting': 'de uitgang van het kantoor aanvragen',
  '/api/techniek/isolatie/ontsluiting/stap/opties': 'het bewijs voor een stap aanvragen; deze dicht ' +
    'en de volgende open zou een uitgang zijn die alleen nog met een onbewezen stap te nemen is',
  '/api/techniek/isolatie/ontsluiting/stap': 'de uitgang van het kantoor aflopen',
  '/api/techniek/isolatie/ontsluiting/commit': 'de uitgang van het kantoor afmaken',
  '/api/techniek/isolatie/ontsluiting/afbreken': 'de uitgang van het kantoor laten vallen'
});

const RECHT_VAN_DE_MENS = Object.freeze({
  '/api/privacy/inzage': 'inzage in je eigen gegevens; dit LEEST en vergroot niets',
  '/api/privacy/export': 'een uitdraai van je eigen gegevens; zelfde reden',
  '/api/inzagekaart': 'het inzagejournaal: wie heeft er in mijn dossier gekeken',
  '/api/toestemming': 'zien wat je hebt toegestaan',
  '/api/toestemming/intrek': 'toestemming intrekken maakt de verzameling wat mag alleen KLEINER; ' +
    'een beveiligingslaag die een versmalling tegenhoudt, werkt tegen zichzelf in'
});

/* ---------------------------------------------------------------------------
   3. DEUREN DIE EEN MENS FYSIEK BUITENSLUITEN.

   Een eigen lijst en niet bij de twee hierboven, want de grond is anders. De
   uitgang gaat over de stand zelf en de rechten gaan over gegevens; dit gaat
   over de wereld BUITEN het scherm. Een digitale stand die iemand op straat laat
   staan, doet schade die niets met zijn account te maken heeft -- en die schade
   is niet terug te draaien met een ontsluitceremonie van tien minuten.

   BESLUIT VAN DE EIGENAAR, 2 september 2026. Ze stonden allebei als vondst in
   ISOLATIEPROEF.json met de meting erbij; de keuze om ze open te zetten is
   genomen en staat hier met de afweging, niet als stille uitzondering.

   DE TEGENWERPING, en die hoort erbij: wie de sessie heeft overgenomen kan de
   hotelkamer nu ook openen. Dat weegt licht, want die aanvaller staat dan al
   voor de deur -- een fysieke deur openen op afstand levert hem niets wat hij
   niet al had. Bij het gezinsportaal weegt het nog lichter: de stand sloot daar
   alleen de INLOG terwijl de gegevens erachter openbleven, dus wie al binnen was
   las gewoon door. Een half gesloten deur beschermt niemand en houdt alleen de
   ouder tegen die er nog niet was. */
const FYSIEKE_DEUR = Object.freeze({
  '/api/verblijf/deur': 'de sleutel van je hotelkamer. Iemand die op reis is en zijn kamer niet meer ' +
    'in kan omdat zijn account onder verdenking staat, is echte schade in de fysieke wereld -- en een ' +
    'deur openen vergroot geen digitaal vermogen.',
  '/api/foundation/gezin/inloggen': 'de deur van het gezinsportaal. Hij sloot alleen de INLOG terwijl ' +
    'de gegevens erachter openbleven: wie al binnen was las door, wie erbuiten stond kwam er niet in. ' +
    'Een ouder die zijn kind zoekt is niet de aanvaller waar deze stand tegen is.'
});

/* Met opzet buiten beide lijsten gehouden, met de reden erbij -- zodat een
   volgende lezer ziet dat ze zijn overwogen en niet vergeten. */
const BEWUST_DICHT = Object.freeze({
  '/api/privacy/delete': 'onomkeerbaar en breed: de gemeten collecties laten rechten, identiteit, ' +
    'andermans gegevens, koppelingen en de beveiliging zien. Het RECHT blijft bestaan; de UITVOERING ' +
    'wacht tot het account niet meer onder verdenking staat.',
  '/api/toestel/meting': 'geen ledenroute maar een toestelsleutel (kern/toestellen.js): een andere ' +
    'deur, geen blinde vlek in deze.'
});

module.exports = { EIGEN_UITGANG, RECHT_VAN_DE_MENS, FYSIEKE_DEUR, BEWUST_DICHT };
