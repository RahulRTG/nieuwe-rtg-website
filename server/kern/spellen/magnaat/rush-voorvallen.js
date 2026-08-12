/* Magnaat: WAT ER OP EEN AVOND MISGAAT -- de voorvallentabel van PDA Rush.

   De wetten en de machinerie staan in ./rush.js; dit bestand is de TABEL.
   Dezelfde scheiding als ./dienst.js tegenover ./dienst-rollen.js, en om
   dezelfde reden: de lijst groeit met elke rol en elke sector mee, de
   redenering niet.

   TWEE GETALLEN PER SOORT, EN ZE DOEN VERSCHILLENDE DINGEN:

     kost   wat het kost als het de hele dienst BLIJFT liggen
     groei  wat het per moment WACHTEN erbij kost

   Daar zit de hele afweging in, en hij is met opzet niet op te lossen door op
   bedrag te sorteren. `bestelling` kost bijna niets als hij blijft liggen maar
   loopt hard op -- een bord dat koud wordt is na vier momenten duurder dan een
   koeling die je aan het eind nog dichtdoet. `voorraad` is precies omgekeerd:
   duur om te laten liggen, maar hij heeft geduld. Wie alles op het hoogste
   bedrag pakt, speelt slechter dan de ploeg die ze op volgorde afwerkt.

   DE GETALLEN ZIJN GEWICHTEN EN GEEN EURO'S. Wat een voorval in geld kost hangt
   af van de zaak: veertig stoelen op de boulevard bederven meer dan vier in een
   zijstraat. ./rush.js schaalt ze naar de derving van DIE vestiging.

   `mag` LEGT EEN VOORVAL BIJ EEN BEVOEGDHEID uit ./dienst-rollen.js -- wet 2 uit
   VERHAAL.md par. 0f.

   EN DE TWEEDE DIENST VERTELDE WAT HET RAAMWERK IS. De eerste opzet zette
   dezelfde koeling er TWEE KEER in: een keer als "zet de waar over" voor de
   hulpkracht en een keer als "laat onderhoud komen" voor de vakkracht. Dat las
   als de vijf hoogtes, maar het waren twee incidenten die toevallig op elkaar
   leken -- en bij de derde rol waren het er drie geweest.

   Wat het werkelijk is: EEN incident met OPTIES, en welke je ziet hangt aan je
   rol. Daarom draagt `koeling` hieronder een `opties`-lijst en de rest niets;
   een voorval zonder opties heeft er impliciet een, namelijk "pak het op". De
   tabel hoeft dus alleen iets te zeggen waar het echt anders is.

   EN EEN VOORVAL MET EEN `storing` BESTAAT ALLEEN ALS DIE STORING OPEN STAAT.
   "Koeling B loopt op" op een avond waarop de koeling het prima doet, is een
   leugen op het scherm -- en "repareren" zou dan een knop zijn die niets
   repareert. Zie ./storing.js.

   `incident` MARKEERT WAT EEN AVOND BIJZONDER MAAKT. Niet elke klik wordt
   geschiedenis (wet 5); dit is de gesloten lijst van wat dat wel kan worden. */
'use strict';

const SOORTEN = [
  { id: 'bestelling', kost: 0.10, groei: 0.34, mag: null,
    wat: 'Bestelling 184 staat zes minuten onder de lamp.',
    deed: 'bestelling 184 alsnog uitgedragen' },
  /* DE KOELSTORING, en dit is het voorval waar de vijf hoogtes uit par. 0f op
     staan. Hij draagt als enige OPTIES: hetzelfde incident, en wat je ermee
     kunt hangt aan je rol.

     Een hulpkracht ziet er precies een: zet de waar over. Dat lost de storing
     NIET op -- hij redt wat er vanavond in ligt, en morgen ligt er weer wat in.
     Een vakkracht ziet er vier, en elke uitweg heeft een andere rekening
     (./storing.js). Er is er geen gratis.

     DAT IS DE PROMOTIE. Niet een venster met confetti maar een scherm dat meer
     te zeggen heeft dan gisteren. */
  { id: 'koeling', kost: 0.95, groei: 0.09, mag: null, incident: true,
    wat: 'Koeling B loopt op. De verse waar van morgen ligt erin.',
    deed: 'de verse waar uit koeling B overgezet',
    /* Het voorval hoort bij deze storing: staat hij open, dan komt het voorval
       elke dienst terug tot iemand hem oplost. Dat is de continuiteit uit
       par. 0f -- de ochtendploeg begint niet in een schone wereld. */
    storing: 'koeling',
    opties: [
      { id: 'overzetten', mag: null,
        wat: 'De waar overzetten naar de andere koeling',
        deed: 'de verse waar uit koeling B overgezet',
        uitleg: 'Redt wat er vanavond in ligt. Morgen ligt er weer wat in.' },
      /* REPAREREN STAAT NIET OP DE WERKVLOER, en dat is de scherpste les van de
         tweede dienst. Zolang de vakkracht zelf een monteur kon bestellen, was
         repareren altijd het beste en was de noodkoeling een knop die niemand
         ooit hoort te gebruiken -- scripts/magnaat-storing.js zei dat met
         zoveel woorden.

         En het is ook gewoon niet waar. Een vakkracht om tien uur 's avonds
         belt geen monteur; hij komt de avond door. Wie geld uitgeeft aan het
         pand, is de zaak -- en die kiest hem op zijn eigen scherm
         (./storing-acties.js). `escaleren` hieronder is precies de weg
         daarnaartoe, en heeft daarmee eindelijk een reden om te bestaan. */
      { id: 'repareren', mag: 'onderhoud', lost: true, alleenZaak: true,
        wat: 'Monteur laten komen',
        deed: 'koeling B laten repareren',
        uitleg: 'Kost spoedgeld op de maandrekening, en dan is het over.' },
      { id: 'workaround', mag: 'onderhoud', staat: 'workaround',
        wat: 'Noodkoeling regelen en doordraaien',
        deed: 'een noodkoeling geregeld voor koeling B',
        uitleg: 'Bijna geen bederf meer, maar iemand is er elke dienst mee bezig. Houdt het een paar maanden.' },
      { id: 'uit', mag: 'onderhoud', staat: 'uit',
        wat: 'Koeling B uit bedrijf nemen',
        deed: 'koeling B uit bedrijf genomen',
        uitleg: 'Er bederft niets meer, maar je kunt minder aan.' },
      { id: 'escaleren', mag: 'onderhoud', staat: 'open',
        wat: 'Melden en de zaak laten beslissen',
        deed: 'de koelstoring gemeld bij de zaak',
        uitleg: 'Kost vanavond niets. De storing blijft open tot iemand anders kiest.' }
    ] },
  { id: 'afruimen', kost: 0.14, groei: 0.26, mag: null,
    wat: 'Tafel 12 is niet afgeruimd; er wacht een gezelschap van zes.',
    deed: 'tafel 12 afgeruimd' },
  { id: 'glaswerk', kost: 0.08, groei: 0.30, mag: null,
    wat: 'De vaatwasser is vol. Achter de bar zijn geen schone glazen meer.',
    deed: 'de vaatwasser gedraaid' },
  { id: 'voorraad', kost: 0.62, groei: 0.05, mag: null,
    wat: 'De levering van vanmiddag staat nog naast de koeling.',
    deed: 'de levering weggezet' },
  { id: 'mise', kost: 0.40, groei: 0.16, mag: null,
    wat: 'De mise-en-place voor de tweede ronde is niet af.',
    deed: 'de mise-en-place bijgewerkt' },
  { id: 'gemorst', kost: 0.06, groei: 0.22, mag: null,
    wat: 'Er is wijn over de doorloop bij de bar gegaan.',
    deed: 'de doorloop schoongemaakt' },
  { id: 'terras', kost: 0.30, groei: 0.12, mag: null,
    wat: 'Het terras loopt vol en er staat niemand.',
    deed: 'het terras opgevangen' },
  { id: 'kraan', kost: 0.52, groei: 0.14, mag: null,
    wat: 'De tapkraan schuimt; er gaat meer in de lekbak dan in het glas.',
    deed: 'de tap ontlucht' },
  { id: 'retour', kost: 0.44, groei: 0.11, mag: null,
    wat: 'Tafel 7 stuurt twee gerechten terug. Ze staan op de doorgeefplank.',
    deed: 'de retour van tafel 7 opgelost' },
];

/* WIE ER EEN WERKVLOER HEEFT. Twee rollen nu, en dat is de tweede dienst:
   dezelfde avond in dezelfde zaak, maar een vakkracht heeft bij een storing
   vier uitwegen waar een hulpkracht er een heeft.

   EEN BEDRIJFSLEIDER STAAT ER NIET IN, en dat is geen vergetelheid. Hij lost
   dezelfde storing op vanaf zijn zaakscherm (./storing-acties.js), met het
   maandoverzicht ernaast in plaats van midden in de drukte. Dat is de derde
   hoogte, en hij vraagt geen dienst -- hij vraagt een besluit.

   ALLEEN HORECA, nog steeds: bouw er EEN, helemaal (par. 0f). Een rol of sector
   die hier niet in staat krijgt geen lege werkvloer maar een regel waarom, want
   een leeg scherm zonder uitleg leest als een storing in het spel. */
const ROLLEN_MET_DIENST = ['hulp', 'vakkracht'];
const magRush = (rol, sector) => ROLLEN_MET_DIENST.includes(rol) && sector === 'horeca';

module.exports = { SOORTEN, ROLLEN_MET_DIENST, magRush };
