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

   createUserZaai valt hier buiten: die maakt alleen de demo-seed en weigert
   buiten de demostand al zelf (kluis.zaaiHash). */
'use strict';

const VLAG = 'RTG_REGISTRATIE_DICHT';
const UITLEG = 'Nieuwe registraties zijn op dit moment gesloten. Bestaande accounts kunnen gewoon inloggen.';

function dicht(env = process.env) { return String(env[VLAG] || '').trim() === '1'; }

/* Gooit VOOR elke schrijfactie; de aanroeper vertaalt status en code. */
function eisOpen() {
  if (dicht()) throw Object.assign(new Error(UITLEG), { code: 'REGISTRATIE_DICHT', status: 503 });
}

module.exports = { VLAG, UITLEG, dicht, eisOpen };
