/* De TABELLEN van de verkoopweg: de zes soorten, de vijf toegangsniveaus en
   wat er met opzet niet bestaat. Pure data, geknipt uit ./verkoopweg.js toen
   die over de 10 kB-leesgrens ging -- zelfde snede als ./werkwoordlijst.js,
   ./koopbaarlijst.js en ./retourlijst.js in deze laag.

   De uitleg bij `publiek` staat in de kop van ./verkoopweg.js en in
   ./publiekslot.js; hier staat alleen wat het IS. */
'use strict';

const WEGSOORTEN = [
  { id: 'web', label: 'Website', wat: 'een site van de verkoper zelf' },
  { id: 'pos', label: 'Kassa', wat: 'aan de balie, op het scherm van de zaak' },
  { id: 'qr', label: 'QR ter plekke', wat: 'aan tafel, op de kamer, bij het schap' },
  { id: 'b2b', label: 'Zakelijk portaal', wat: 'voor bedrijven met een relatie' },
  { id: 'mall', label: 'RTG Mall', wat: 'binnen de leden-app' },
  { id: 'agent', label: 'AI-agent', wat: 'een gesprek in plaats van een scherm' }
];

/* DE TOEGANG. Vier soorten kunnen altijd; `publiek` is AFHANKELIJK en draagt
   daarom `kan: null` en geen `false` -- dezelfde vorm als WALLET_SALDO in
   kern/bevoegdheid/lijst.js, waar een stand in de boardroom bepaalt wat een
   begrip is. Een lijst waar `publiek` niet in staat laat de vraag onbeantwoord;
   een lijst waar hij in staat met zijn voorwaarden, geeft het antwoord. */
const TOEGANG = [
  { id: 'personeel', label: 'Alleen personeel', kan: true, wie: 'medewerkers van de zaak' },
  { id: 'leden', label: 'RTG-leden', kan: true, wie: 'iedereen die is ingelogd' },
  { id: 'klanten', label: 'Eigen klanten', kan: true, wie: 'leden die de verkoper heeft uitgenodigd' },
  { id: 'bedrijven', label: 'Zakelijke relaties', kan: true, wie: 'organisaties met een relatie' },
  { id: 'publiek', label: 'Iedereen op internet', kan: null,
    wie: 'ook wie geen account heeft',
    afhankelijk: 'Kan pas als de twee sloten van kern/webdomein.js open staan: het besluit van de boardroom voor het hele huis, en een eigen adres dat deze zaak zelf online heeft gezet. Deze laag opent er geen van beide; hij leest ze.' }
];

const NIET_GEBOUWD = {
  prijsbeleid: 'Een eigen prijs per verkoopweg (kassaprijs anders dan webprijs) vraagt een tweede prijsbron naast het domein. Zolang die er niet is, geldt de prijs van het aanbod; een verkoopweg met een eigen prijslijst zou meteen de vraag oproepen welke van de twee klopt.',
  betaalbeleid: 'Welke betaalwijzen een verkoopweg toestaat, hoort bij kern/pay en niet hier. Er komt geen tweede plek die bepaalt of iets betaald mag worden.',
  fulfilmentbeleid: 'Bezorgen en afhalen staan per zaak in kern/leverancier/bezorgregel.js. Een verkoopweg die dat overschrijft, laat een zaak per weg iets anders beloven dan haar bezorgschakelaar zegt.',
  eigenDomein: 'Een eigen adres REGELT u bij Mijn website (kern/webdomein.js), en niet hier. Een verkoopweg leest die twee sloten alleen: hij kan zien dat u een adres online heeft staan, en er publiek op verkopen, maar hij kan er geen koppelen en de boardroomfunctie niet aanzetten.',
  merk: 'Het merk van een verkoper woont in kern/webmerk.js en geldt per vestiging. Een verkoopweg met een eigen huisstijl zou een vierde plek zijn waar een logo vandaan komt.'
};

const OP_ID = (l) => new Map(l.map(x => [x.id, x]));
const WEGSOORT = OP_ID(WEGSOORTEN), TOEG = OP_ID(TOEGANG);

/* Meer dan dit is geen kanaalstrategie meer maar een doolhof. */
const MAX_PER_ZAAK = 20;

module.exports = { WEGSOORTEN, TOEGANG, NIET_GEBOUWD, WEGSOORT, TOEG, MAX_PER_ZAAK };
