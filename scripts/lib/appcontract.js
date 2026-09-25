/* ============================================================================
   HET APP-CONTRACT -- welke bestaande proef mag een bewijs van een app leveren.

   WAAROM DIT BESTAAT. APPWERKT.json meet per onderdeel uit MAPPEN acht bewijzen
   (BETROUWBAARHEID.md), en vijf daarvan stonden voor alle 102 apps op
   GEEN_FIXTURE. Tegelijk liggen er gesloten ketenproeven (tafel, rit,
   toelating, Adam, moment, zaak-live, lus) die complete stromen van begin tot
   bevestiging lopen -- en APPWERKT las er geen enkele. Dit is de naad: een app
   mag bewijs SAMENSTELLEN uit onafhankelijke proeven die al bestaan, in plaats
   van een tweede fixture te bouwen die hetzelfde nog eens vaststelt.

   WAT HET CONTRACT IS, EN WAT NIET. Het is een VERKLARING en geen uitslag: er
   staat per app welke bron een bewijs mag leveren, nooit dat het bewijs
   geleverd is. De uitslag verdient de bron zelf, op een vers register
   (scripts/lib/bewijsbron.js). Er staat nergens PASS in dit bestand, en
   test/appcontract.test.js zakt als iemand het er toch in zet.

   DE ACHT BEWIJZEN BLIJVEN CANONIEK. Een contract mag alleen een van de acht
   namen uit BETROUWBAARHEID.md dragen. Er komt geen negende ("storingsvast"
   valt onder herstelbaar) -- acht stabiele begrippen zijn meer waard dan een
   steeds fijner kwaliteitsmodel.

   EEN KETEN LEVERT PRECIES EEN BEWIJS, EN DAT IS MET OPZET. Een ketenproef
   bewijst `voltooibaar`: de hele stroom kan worden afgemaakt, tot en met wat de
   ANDERE partij daarvan ziet. Hij bewijst niet:
     herstelbaar      -- zijn storingen zijn dubbele tikken, verkeerde rollen en
                         verboden standen; herstelbaar gaat over uitval van
                         Redis/PostgreSQL, een providertimeout en een verzoek dat
                         midden in een mutatie afbreekt. Dat is een ander
                         experiment (verraad.js, crashproef), en een groen vinkje
                         op het verkeerde experiment is BEWIJSMACHINE.md par. 6a.
     persistent       -- er is geen herstart op dezelfde data.
     waarheidsgetrouw -- hij leest API-antwoorden, niet wat het SCHERM zegt.
     bevoegd          -- een handvol verkeerde-rol-storingen is geen kruisproef
                         over de hele app.
   Wie een keten voor een van die vier laat tellen, verzint bewijs.

   DE KOPPELING WORDT GEMETEN, NIET GELOOFD. Elke regel hieronder moet een
   gedeelde route hebben met de ingang van de app (SCHERMROUTES.json, via de
   scripts die de ingang laadt). Anders beweert het contract iets over een
   scherm dat de proef nooit heeft aangeraakt. Die overlap is NODIG en niet
   VOLDOENDE -- vandaar de `belofte` in woorden: een mens zegt dat de keten de
   KERNbelofte van de app dekt, en niet een deelbelofte ervan.

   DE KETENS ZONDER APP staan er even groot bij (`ZONDER_APP`). Van de zeven
   gesloten ketens landt er vandaag EEN op de kernbelofte van een app in MAPPEN.
   Weglaten zou lezen als "nog niet gedaan"; ze staan er met de reden, zodat
   zichtbaar is waarom en wat er zou moeten gebeuren om ze wel te laten tellen.
   ========================================================================== */
'use strict';

/* De acht, in de volgorde van BETROUWBAARHEID.md. Gelijk aan de sleutels die
   scripts/appwerkt.js per rij schrijft; de toets houdt die twee gelijk. */
const BEWIJZEN = ['bereikbaar', 'bedienbaar', 'voltooibaar', 'waarheidsgetrouw',
  'persistent', 'bevoegd', 'herstelbaar', 'menselijk'];

/* Welke soort bron welk bewijs mag leveren. Gesloten: een ketenproef levert
   voltooibaar en verder niets (zie de kop). Een nieuwe bronsoort (wereldproef,
   authority, verraad) komt hier met zijn eigen bewijs bij, en niet door een
   bestaande soort op te rekken. */
const BRONSOORTEN = {
  ketenproef: ['voltooibaar'],
  /* De liegronde levert waarheidsgetrouw en verder niets: zijn JS-fouten en
     rommel op een leeg antwoord zeggen iets over robuustheid, niet over bewijs 8
     (menselijk), want een echte backend antwoordt nooit zo. */
  liegronde: ['waarheidsgetrouw'],
  /* De bevoegdronde levert bevoegd en verder niets: IDOR en ROLPROEF zeggen
     wie er NIET bij kan, niet of het scherm iets bewaart of herstelt. */
  bevoegdronde: ['bevoegd']
};

/* Sleutel: de functie-id uit MAPPEN (zoals APPWERKT.json hem als `functie`
   schrijft), zodat een hernoemde app het contract niet stil laat vallen. */
const CONTRACT = {
  'link:horeca': {
    belofte: 'een zaak bedient een tafel van rekening openen tot afrekenen, en keuken en gast zien elke stap',
    voltooibaar: {
      soort: 'ketenproef',
      register: 'TAFELPROEF.json',
      instrument: 'scripts/tafelproef.js',
      waarom: 'de tafelproef loopt exact die stroom over /api/supplier/horeca/*, de routes die /apps/horeca.html zelf aanroept'
    }
  },
  /* De lusproef stond tot 24 september 2026 in ZONDER_APP: hij schreef geen
     register, en Ontdekken leek /apps/rtg.html te zijn. Beide klopten niet meer:
     link:connect is /apps/connect.html, dat acht /api/connect-routes met de proef
     deelt, en de proef schrijft nu LUSPROEF.json met het huisstempel. De proef
     loopt als LID over /api/connect, de deur die connect.html zelf aanroept; de
     gezinsdeur /api/rtf/connect is dezelfde motor maar wordt niet gelopen, en dat
     staat in `waarom` in plaats van weggelaten. */
  'link:connect': {
    belofte: 'je ontdekt iets, begrijpt het, doet er iets mee, en een ander bevestigt dat het hem hielp -- zonder score, rangorde of niveau',
    voltooibaar: {
      soort: 'ketenproef',
      register: 'LUSPROEF.json',
      instrument: 'scripts/lusproef.js',
      waarom: 'de lusproef loopt de ontdeklus van CONNECT.md over /api/connect/*, de routes die /apps/connect.html zelf aanroept, met twee leden; de gezinsdeur /api/rtf/connect (dezelfde motor) loopt hij niet'
    }
  }
};

/* Gesloten ketens die (nog) geen bewijs voor een app in MAPPEN leveren, met de
   reden. `nodig` zegt wat er moet veranderen voordat ze wel tellen -- en dat is
   nooit "het contract ruimer lezen". */
const ZONDER_APP = [
  { register: 'RITPROEF.json', instrument: 'scripts/ritproef.js',
    reden: 'geen enkel scherm in SCHERMROUTES.json roept /api/ride/request aan; de rit wordt vanuit de ledenapp gestart (standen reizen/terplaatse), die geen eigen adres heeft',
    nodig: 'de ledenapp-standen meetbaar maken (appwerkt kan ze vandaag alleen als niet getest melden)' },
  { register: 'ADAMPROEF.json', instrument: 'scripts/adamproef.js',
    reden: 'de stroom loopt over /api/rtf/solliciteer en /api/concern/*; geen ingang in MAPPEN roept die aan (werk.html van de Foundation en concern.html staan er niet in)',
    nodig: 'een besluit welke app in FoundationOS "werk vinden" belooft, en die ingang in MAPPEN' },
  { register: 'MOMENTPROEF.json', instrument: 'scripts/momentproef.js',
    reden: 'raakt RTG Media (/api/mediaos/aanwezig/*), maar alleen de deelbelofte volgen en gewekt worden -- niet wat RTG Media als geheel belooft',
    nodig: 'een tweede bron voor de kernbelofte van RTG Media, of een splitsing van die app in MAPPEN' },
  { register: 'TOELATINGSPROEF.json', instrument: 'scripts/toelatingsproef.js',
    reden: 'de klant is geen lid en de keten loopt over kantoor en aanmeldbalie; MAPPEN kent alleen lid- en gezinswerelden',
    nodig: 'niets aan de keten -- dit bewijs hoort bij een zaak- of kantoorregister, niet bij APPWERKT' },
  { register: 'ZAAKLIVEPROEF.json', instrument: 'scripts/zaakliveproef.js',
    reden: 'de zaakkant (poort, rondleidingen, live gaan); geen ingang in MAPPEN',
    nodig: 'idem: een zaakregister naast APPWERKT' }
];

/* DE WERELD DIE EEN APP NODIG HEEFT (Ronde B, 24 september 2026). Een app
   verklaart alleen WELKE wereld; hoe die ontstaat en wat hij daarvoor nodig heeft
   staat in ./wereldcompositor.js. Net als bij een bewijsbron is de verklaring
   GEMETEN: de wereldbouwer moet routes raken die de ingang van de app aanroept
   (test/wereldcompositor.test.js). Alleen koppelingen met meerdere gedeelde
   routes staan hier; de wortels-wereld raakt twintig apps met elk EEN route, en
   een wereld op een enkele gedeelde route declareren is raden.

   Een wereld die niet opkomt blijft gewoon gedeclareerd: een declaratie
   verbergt niets. De spelwereld kwam eerst niet op -- hij vraagt een
   `member-account`-sessie die geen munter maakte. Die munter staat sinds
   ronde C in ./proefsleutels.js, en daarmee komt ook Spelen op. */
const WERELD = {
  'link:horeca': { werelden: ['horeca'], waarom: 'een open rekening op een tafel: de wortel van /api/supplier/horeca/*' },
  'link:spelen': { werelden: ['spel'], waarom: 'een potje dat loopt: de wortel van /api/member/spel/*' }
};

/* BRONNEN DIE VOOR ELKE APP GELDEN. Een contract noemt per app een bron; een
   ronde als de liegronde meet ELKE rij met dezelfde procedure, en heeft dus geen
   koppeling per app nodig maar een uitslag per rij. Het register is de
   koppeling: staat de rij er niet in, of is hij vervallen, dan blijft het bewijs
   NIET_GETEST. Een contract per app gaat voor. */
const ALGEMEEN = {
  waarheidsgetrouw: {
    soort: 'liegronde',
    register: 'LIEGRONDE.json',
    instrument: 'scripts/liegronde.js',
    waarom: 'dezelfde liegpoort als test/liegend-scherm.e2e.js, per rij met de persona van die rij; alleen een verzonnen zekerheid is een defect'
  },
  bevoegd: {
    soort: 'bevoegdronde',
    register: 'BEVOEGD.json',
    instrument: 'scripts/bevoegdronde.js',
    waarom: 'ledenschermen bakenen af op de sessie (BETROUWBAARHEID.md par. 4f), dus hun routes uit IDOR.json en ROLPROEF.json; gezinsschermen noemen hun code, dus een kruisproef met het token van een ander gezin'
  }
};

module.exports = { BEWIJZEN, BRONSOORTEN, CONTRACT, ZONDER_APP, WERELD, ALGEMEEN };
