/* DE KRITIEKE GEBRUIKERSVERHALEN -- de MENS-baan: iedereen, een lid, een gezin.

   WAAROM DE LIJST LOS STAAT VAN DE METER. ./bruikbaarheid.js is de machine: hij
   loopt per verhaal de paden na en zegt of ze open staan. Dit bestand is het
   OORDEEL: welke verhalen ertoe doen. Die twee schuiven om verschillende
   redenen -- de lijst groeit mee met de app, de meter verandert bijna nooit --
   en wie ze samen laat, past op een dag de meter aan om een verhaal kwijt te
   raken. Dezelfde naad als beschermstand-lijst.js tegenover beschermstand.js.

   DE ZAAK-BAAN STAAT IN ./verhalen-zaak.js, en dat is geen kilobyte-knip maar
   dezelfde snede die er al ligt tussen /apps/mijn-isolatie.html (het lid) en
   /apps/isolatie.html (het kantoor). Een lid hoort op zijn eigen scherm niet te
   lezen dat "afrekenen aan de kassa" niet meer werkt.

   DE METHODE STAAT IN HET PAD. `'GET /api/foundation/gezin/:code/locaties'`;
   zonder voorvoegsel is het POST. Dat moest, want de meter legde elk pad hard op
   POST met de opmerking "deze paden zijn allemaal POST, want dat is wat dit huis
   is" -- waar voor de negen die er stonden, en niet voor het gezinsportaal, waar
   een ouder juist via GET leest. Een GET die als POST wordt gemeten krijgt een
   strenger antwoord dan de werkelijkheid, en dan meldt de meter een gat dat er
   niet is. Dat is precies wat een meter waardeloos maakt.

   `moetHeel` IS EEN BELOFTE EN GEEN WENS. Hij staat alleen op verhalen die
   vandaag GEMETEN heel blijven onder alle vijf de standen. Een vlaggetje
   uitdelen dat de bouw laat zakken is geen strengheid maar een kapotte keten --
   en een keten die altijd rood staat, wordt uitgezet. Waar de belofte moreel
   voor de hand ligt maar de meting hem niet haalt (medicatie, het kind), staat
   `moetHeel: false` MET de meting in `waarom`. Dat is een besluit dat zichtbaar
   openstaat, geen stilzwijgen.

   WAT DEZE METER MEET IS HET CONTRACT EN NIET HET VERKEER. `isolatie.besluit()`
   wordt in de HTTP-keten nergens afgedwongen: middleware/functieschakelaars.js
   kijkt alleen naar de HUIS-modus. De isolatiekolom hieronder is dus wat de laag
   BELOOFT (afgedwongen in kern/stuur/isolatiefilter.js en getoond in de
   cockpitproef), niet wat een draaiende server vandaag doet. Wie dat verwart,
   leest een vondst hier als een productiestoring. */
'use strict';

const IEDEREEN = [
  { id: 'inloggen', wie: 'iedereen', wat: 'binnenkomen', moetHeel: true,
    paden: ['/api/login', '/api/auth/login', '/api/logout'],
    waarom: 'wie niet kan inloggen, kan ook niets lezen; dan is "lezen loopt door" een zin zonder inhoud' },
  { id: 'inloggen-passkey', wie: 'iedereen', wat: 'binnenkomen met een passkey', moetHeel: true,
    paden: ['/api/webauthn/opties', '/api/webauthn/login'],
    waarom: 'BESLUIT VAN DE EIGENAAR, 2 september 2026. Dit stond op "werkt beperkt": /opties kwam ' +
      'er als bewezen lezer doorheen en /login niet, want die hing aan de functie `webauthn` in de ' +
      'bevroren categorie "Betalen & verificatie". Een halfopen voordeur is erger dan een dichte. ' +
      'De twee inlogpaden horen nu bij `tg-inlog` -- de voordeur -- en registreren en verwijderen ' +
      'blijven bij `webauthn` en dus bevroren: binnenkomen met een sleutel die je al had is geen ' +
      'voorrecht, een nieuwe sleutel aanmaken tijdens een incident wel.' },
  { id: 'wachtwoord-kwijt', wie: 'iedereen', wat: 'weer binnenkomen na een vergeten wachtwoord', moetHeel: true,
    paden: ['/api/auth/forgot', '/api/auth/reset'],
    waarom: 'een mens die zijn wachtwoord kwijt is tijdens een incident, is precies de mens die er ' +
      'weer bij moet kunnen' },
  { id: 'hulpdienst', wie: 'iedereen', wat: 'een hulpdienst bereiken', moetHeel: true,
    paden: ['/api/veiligheid/alarm', '/api/veiligheid/alarm/afsluiten'],
    waarom: 'een hulpdienst stilzetten om een incident in te dammen is nooit de goedkoopste keuze' },
  { id: 'storing-melden', wie: 'iedereen', wat: 'melden dat er iets stuk is', moetHeel: true,
    paden: ['/api/fout/client'],
    waarom: 'dit is het kanaal waarlangs wij HOREN dat er iets mis is' }
];

const LID = [
  { id: 'geld-lezen', wie: 'lid', wat: 'zien wat er van mijn geld af ging', moetHeel: true,
    paden: ['/api/pay/overzicht', '/api/bank/afschrift', '/api/bank/overzicht'],
    waarom: 'juist wie denkt dat er iets mis is, moet kunnen kijken. Dit is de eerste handeling van ' +
      'een mens die zijn account niet vertrouwt' },
  { id: 'geld-sturen', wie: 'lid', wat: 'geld sturen', moetHeel: false,
    paden: ['/api/pay/stuur'],
    waarom: 'hoort onder een gesloten stand juist DICHT te zitten; hij staat hier zodat zichtbaar is ' +
      'dat de stand werkelijk iets doet -- de tegenproef van deze hele lijst' },
  { id: 'zelf-beschermen', wie: 'lid', wat: 'mezelf strenger zetten', moetHeel: true,
    paden: ['/api/isolatie/mijn', '/api/isolatie/mijn/zet'],
    waarom: 'de knop waarmee een mens zich beschermt, mag nooit dichtvallen door de bescherming zelf' },
  { id: 'ontsluiten-aanvragen', wie: 'lid', wat: 'vragen om er weer uit te mogen', moetHeel: true,
    paden: ['/api/isolatie/mijn/ontsluiting', '/api/isolatie/mijn/ontsluiting/stap/opties',
      '/api/isolatie/mijn/ontsluiting/stap', '/api/isolatie/mijn/ontsluiting/commit',
      '/api/isolatie/mijn/ontsluiting/afbreken'],
    waarom: 'een stand zonder uitgang is een val, en een val zet niemand aan. De commit en het ' +
      'afbreken stonden wel in EIGEN_UITGANG maar niet in dit verhaal: de helft van de uitgang werd ' +
      'dus nooit gemeten' },
  { id: 'eigen-gegevens-inzien', wie: 'lid', wat: 'zien wat RTG van mij heeft', moetHeel: true,
    paden: ['/api/privacy/inzage', '/api/privacy/export', '/api/inzagekaart'],
    waarom: 'een AVG-recht is geen functie die RTG kan uitzetten, ook niet tijdelijk' },
  { id: 'toestemming-intrekken', wie: 'lid', wat: 'toestemming intrekken', moetHeel: true,
    paden: ['/api/toestemming', '/api/toestemming/intrek'],
    waarom: 'intrekken maakt de verzameling wat mag alleen KLEINER; een beveiligingslaag die een ' +
      'versmalling tegenhoudt, werkt tegen zichzelf in' },
  { id: 'noodkring-bereiken', wie: 'lid', wat: 'mijn noodkring bereiken', moetHeel: true,
    paden: ['/api/veiligheid/kring', '/api/veiligheid/kring/mail'],
    waarom: 'dit is de kring die je belt als je in de problemen zit; hem dichtzetten om een ' +
      'account te beschermen is de verkeerde ruil' },
  { id: 'codewoord-gebruiken', wie: 'lid', wat: 'mijn codewoord gebruiken', moetHeel: true,
    paden: ['/api/veiligheid/codewoord/check'],
    waarom: 'het codewoord is de weg voor een mens die onder dwang staat; die weg is nooit een ' +
      'goede plek voor een beveiligingsdrempel' },
  { id: 'stil-alarm-lopen', wie: 'lid', wat: 'een stil alarm laten lopen', moetHeel: false,
    paden: ['/api/veiligheid/wacht/start', '/api/veiligheid/wacht/checkin', '/api/veiligheid/wacht/stop'] },
  { id: 'noodgegevens-lezen', wie: 'lid', wat: 'mijn noodkaart lezen', moetHeel: false,
    paden: ['/api/noodkaart'] },
  { id: 'noodgegevens-bijwerken', wie: 'lid', wat: 'mijn noodkaart bijwerken', moetHeel: false,
    paden: ['/api/noodkaart/zet'] },
  { id: 'medicatie-lezen', wie: 'lid', wat: 'zien welke medicijnen ik moet nemen', moetHeel: false,
    paden: ['/api/medicatie'],
    waarom: 'moreel ligt een belofte hier voor de hand; de meting haalt hem vandaag niet, en een ' +
      'vlaggetje dat de bouw laat zakken is geen strengheid' },
  { id: 'medicatie-afvinken', wie: 'lid', wat: 'een medicijn afvinken', moetHeel: false,
    paden: ['/api/medicatie/af', '/api/medicatie/voorraad'] },
  { id: 'agenda-lezen', wie: 'lid', wat: 'zien wat er vandaag op de agenda staat', moetHeel: false,
    paden: ['/api/agenda/mijn', '/api/agenda/mijn-lijst'] },
  { id: 'bericht-lezen', wie: 'lid', wat: 'mijn post lezen', moetHeel: false,
    paden: ['/api/member/rtmail/inbox', '/api/comm/inbox'] },
  { id: 'bericht-sturen', wie: 'lid', wat: 'een bericht sturen', moetHeel: false,
    paden: ['/api/comm/stuur'] },
  { id: 'identiteit-tonen', wie: 'lid', wat: 'zien met welke diensten ik ben gekoppeld', moetHeel: false,
    paden: ['/api/rtgid/wie', '/api/rtgid/inzage'] },
  { id: 'passkey-beheren', wie: 'lid', wat: 'mijn passkeys beheren', moetHeel: false,
    paden: ['/api/webauthn/lijst', '/api/webauthn/weg'] },
  { id: 'reis-zien', wie: 'lid', wat: 'zien welke reizen ik heb', moetHeel: false,
    paden: ['/api/reis/reizen', '/api/reis/wereld'] },
  { id: 'reis-onderweg', wie: 'lid', wat: 'onderweg bij mijn vlucht en mijn kamer kunnen', moetHeel: false,
    paden: ['/api/member/vluchten/mijn', '/api/member/vluchten/incheck', '/api/verblijf/mijn',
      '/api/verblijf/deur'],
    waarom: 'BESLUIT VAN DE EIGENAAR, 2 september 2026: /api/verblijf/deur -- de sleutel van je ' +
      'hotelkamer -- blijft open onder isolatie (kern/isolatie/openpaden-lijst.js: FYSIEKE_DEUR). ' +
      'Iemand die op reis is en zijn kamer niet meer in kan omdat zijn account onder verdenking ' +
      'staat, is echte schade in de fysieke wereld, en een deur openen vergroot geen digitaal ' +
      'vermogen. GEEN moetHeel: incheck en de vluchtlijst blijven onder isolatie dicht, en die ' +
      'belofte is niet gedaan.' },
  { id: 'reisregels-lezen', wie: 'lid', wat: 'de reisregels van mijn bestemming lezen', moetHeel: false,
    paden: ['/api/reis/wijzer'] }
];

/* Het GEZINSPORTAAL staat in ./verhalen-gezin.js. Dat is geen kilobyte-knip: de
   Foundation-kant is een eigen deur met een eigen inlog (een gezinscode, geen
   ledentoken) en een eigen toon, en hij groeit met FOUNDATION.md mee in plaats
   van met de ledenapp. */
const { GEZIN } = require('./verhalen-gezin');

module.exports = { IEDEREEN, LID, GEZIN, MENSBAAN: [].concat(IEDEREEN, LID, GEZIN) };
