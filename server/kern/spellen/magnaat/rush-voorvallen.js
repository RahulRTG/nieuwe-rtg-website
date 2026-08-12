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

   `mag` LEGT EEN VOORVAL BIJ EEN BEVOEGDHEID uit ./dienst-rollen.js. Wat een
   hulpkracht niet mag, ziet hij niet -- dat is wet 2 uit VERHAAL.md par. 0f. Het
   is tegelijk de enige plek waar de vijf hoogtes uit die paragraaf alvast
   zichtbaar zijn: dezelfde koeling staat er twee keer, een keer als "zet de
   waar over" en een keer als "laat onderhoud komen". Er is geen raamwerk voor
   gebouwd en dat is de bouwvolgorde -- de tweede dienst vertelt wat het
   raamwerk is, deze kan dat niet.

   `incident` MARKEERT WAT EEN AVOND BIJZONDER MAAKT. Niet elke klik wordt
   geschiedenis (wet 5); dit is de gesloten lijst van wat dat wel kan worden. */
'use strict';

const SOORTEN = [
  { id: 'bestelling', kost: 0.10, groei: 0.34, mag: null,
    wat: 'Bestelling 184 staat zes minuten onder de lamp.',
    deed: 'bestelling 184 alsnog uitgedragen' },
  { id: 'koeling', kost: 0.95, groei: 0.09, mag: null, incident: true,
    wat: 'Koeling B loopt op. De verse waar van morgen ligt erin.',
    deed: 'de verse waar uit koeling B overgezet' },
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
  /* WAT EEN HULPKRACHT NIET MAG. Hij komt niet in zijn lijst en hij ziet hem
     niet -- tot de dag dat hij vakkracht wordt en er ineens een regel op zijn
     PDA staat die er gisteren niet was. Dat IS de promotie, en er staat geen
     venster omheen. */
  { id: 'installatie', kost: 1.10, groei: 0.10, mag: 'onderhoud', incident: true,
    wat: 'De thermostaat van koeling B blijft terugvallen. Onderhoud laten komen?',
    deed: 'onderhoud op de koeling laten komen' }
];

/* ALLEEN HULPKRACHT, ALLEEN HORECA. Dat is geen gebrek maar de bouwvolgorde uit
   par. 0f: bouw er EEN, helemaal. Een dienst voor een rol die hier niet in staat
   bestaat niet, en het scherm zegt dat ook met zoveel woorden -- een lege
   werkvloer zonder uitleg leest als een storing. */
const magRush = (rol, sector) => rol === 'hulp' && sector === 'horeca';

module.exports = { SOORTEN, magRush };
