/* REGISTRATIE DICHT -- de blijvende, handmatige grendel op nieuwe accounts.

   Besluit van de eigenaar (oktober 2026, pre-v1): de openbare registratie gaat
   dicht tot de /media-reparatie (#587) is uitgerold en bewezen. Bestaande
   accounts loggen gewoon in, herstellen hun wachtwoord en het kantoor blijft
   werken; er ontstaat alleen geen NIEUW account. Heropenen is een besluit van
   de eigenaar.

   WAAROM HIER EN NIET OP DE ROUTE. Er zijn drie wegen die een rij in `users`
   maken: /api/auth/register, de SSO-binnenkomst (een eerste aanmelding op een
   gekoppeld domein maakt het account erbij) en SCIM. Ze lopen alle drie door
   createUser van de accountgevel (./index.js), dus een grendel daar dekt ook de weg die morgen
   wordt bijgebouwd. De zekering `registratie` op het techniekbord (en de
   noodrem die hem een uur trekt) staat alleen op /api/auth/register; die blijft
   zoals hij was.

   WAAROM EEN OMGEVINGSVARIABELE. Hij overleeft een herstart, een herstel uit
   een back-up en een gewiste db.json -- de zekering leeft in de operationele
   data en gaat met die data mee. Aan- en uitzetten is een herstart, en dat is
   met opzet: dit is een besluit en geen reflex.

   FAIL-CLOSED LEZEN. De eerste versie las alleen een letterlijke `1` als dicht,
   en daarmee liet `true`, `yes`, `ja`, `01` of `1 # dicht tot #587` de
   registratie OPEN -- een besluit dat dicht bedoeld was, faalde de verkeerde
   kant op (de envlezers van golive.js en scripts/docker/start.js houden een
   commentaar achter de waarde gewoon vast). Nu is het andersom: leeg of
   ontbrekend is open, een expliciete `0` is open, en ELKE andere waarde is
   dicht. Een commentaar achter de waarde (`0 # ...`) telt niet mee; een
   waarde die niet `0` of `1` is, krijgt bij het opstarten een waarschuwing
   (config.valideer), zodat een typefout zichtbaar is en niet stil open of
   dicht staat. Die regel staat in ../config/registratie.js.

   createUserZaai valt hier buiten: die maakt alleen de demo-seed en weigert
   buiten de demostand al zelf (kluis.zaaiHash). Het eigenaarsscript
   (scripts/eigenaar-aanmaken.js) valt er ook buiten, en dat staat daar
   uitgeschreven: het schrijft LANGS de gevel, buiten elk verzoek om. */
'use strict';

/* Het LEZEN van de vlag woont in ../config/registratie.js: config.valideer
   waarschuwt bij het opstarten op dezelfde regel, en de configuratielaag mag
   het binnenwerk van de kluis niet laden (scripts/lib/verboden.js). Een regel,
   twee lezers -- geen kopie. */
const { VLAG, waarde, dicht, onbekend, keur } = require('../config/registratie');
const UITLEG = 'Nieuwe registraties zijn op dit moment gesloten. Bestaande accounts kunnen gewoon inloggen.';
/* De `hoe` van BETROUWBAARHEID.md par. 3: een weigering die zegt dat het een
   INSTELLING is en geen defect. Die gaat naar ANONIEME aanroepers, dus hij
   noemt geen interne variabele en geen herstart -- dat staat in HOE_TECHNIEK,
   en die toont alleen het techniekbord (stand()). De vorm blijft gelijk: een
   503 met een `hoe` leest de meting (scripts/appwerkt.js) als CONFIG. */
const HOE = 'Registratie is tijdelijk gesloten door een besluit van RTG.';
const HOE_TECHNIEK = 'Registratie gesloten bij besluit van de eigenaar (' + VLAG + ' in de serveromgeving). ' +
  'Heropenen kan alleen de eigenaar: de variabele weghalen of op 0 zetten, en de server herstarten.';
/* Welke wegen deze grendel dekt -- alle drie lopen door createUser van de gevel. */
const PADEN = Object.freeze([
  { weg: 'registreren', pad: '/api/auth/register' },
  { weg: 'eerste SSO-aanmelding', pad: '/api/sso/terug en /api/sso/saml/acs' },
  { weg: 'SCIM-provisioning', pad: '/api/scim/v2/Users' }
]);

/* De stand voor het techniekbord: alleen lezen, en met de wegen erbij. */
function stand(env = process.env) {
  return {
    vlag: VLAG,
    dicht: dicht(env),
    onbekendeWaarde: onbekend(env),
    herkomst: 'besluit van de eigenaar, in de serveromgeving',
    paden: PADEN.map(p => ({ ...p })),
    wijzigbaarHier: false,
    hoe: HOE_TECHNIEK
  };
}

/* Het weigerantwoord van /api/auth/register, met ALLE redenen die gelden. Zijn
   besluit en zekering allebei dicht, dan staan ze er allebei: anders zegt het
   antwoord na een reset van de zekering iets anders terwijl de deur gewoon
   dicht blijft, en leest een reset als heropenen. Geeft null als niets sluit. */
const HOE_ZEKERING = 'Registratie is tijdelijk uitgeschakeld door RTG.';
function weigering(zekeringEruit, env = process.env) {
  const reden = [];
  if (dicht(env)) reden.push('besluit');
  if (zekeringEruit) reden.push('zekering');
  if (!reden.length) return null;
  return {
    error: reden.includes('besluit') ? UITLEG : 'Registreren is tijdelijk uitgeschakeld.',
    code: 'REGISTRATIE_DICHT',
    reden,
    hoe: reden.includes('besluit') ? HOE : HOE_ZEKERING
  };
}

/* Gooit VOOR elke schrijfactie; de aanroeper vertaalt status en code. */
function eisOpen() {
  if (dicht()) throw Object.assign(new Error(UITLEG), { code: 'REGISTRATIE_DICHT', status: 503, reden: ['besluit'], hoe: HOE });
}

module.exports = { VLAG, UITLEG, HOE, HOE_TECHNIEK, PADEN, waarde, dicht, onbekend, keur, stand, weigering, eisOpen };
