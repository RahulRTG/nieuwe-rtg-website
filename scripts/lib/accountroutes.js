/* ============================================================================
   DE ACCOUNTROUTES -- deuren die een ECHT account vragen, niet alleen een pas.

   HET VERSCHIL DAT DE PROEF NIET KENDE. `/api/login { tier }` geeft een
   PASsessie: een lid met een pas, zonder account erachter. Dat is niets
   bedachts -- het is wat de demo-inlog van de app oplevert, en de proef
   gebruikte hem voor alles wat `member` heet. Vijfentachtig routes in
   FIXTURE_403 weigeren precies daarop, en ze zeggen het er zelf bij:

     "Alleen voor leden met een eigen account."     (routes/ik.js)
     "Passkeys horen bij een eigen RTG-account."    (webauthn)
     "De algemene pin hoort bij een echt RTG-account."
     "Log in met je eigen RTG-account om een gezin te koppelen."

   De poort leest `uid(req)`, en die is bij een passessie leeg. Er is dus geen
   recht dat ontbreekt en geen rol die te zwak is; er ontbreekt een ACCOUNT.

   TWEE VORMEN, EN DAT IS GEMETEN EN NIET GEKOZEN.

   Zeven domeinen zijn in hun GEHEEL accountgebonden: alle routes eronder
   weigeren op dezelfde poort, en de handvol die dat niet doet zit al voorbij
   die poort (400 of 404) en heeft dus evengoed een account nodig. Die staan
   hier als voorvoegsel.

   De overige zeventien liggen in domeinen waar de PASsessie wel degelijk werk
   heeft -- /api/member/, /api/auth/, /api/podium/, /api/chat/ dragen seeddata
   die aan de demo-pas hangt. Een voorvoegsel zou daar routes wegnemen bij de
   sessie die er thuishoort. Die staan hier daarom als heel pad.

   WAT DIT NIET DOET. Het opent niets: `member-account` is een gewoon gratis
   lid, aangemeld langs /api/auth/register zoals iedereen. Wat de proef wint is
   aankloppen met de sessie die de route bedoelt. De poorten erachter blijven
   staan -- Vonk vraagt daarna nog steeds een geverifieerd paspoort, en dat
   blijft een 403 met reden.

   Wie hier iets bij zet, meet eerst of het hele domein accountgebonden is; zo
   niet, dan hoort het als heel pad. test/accountroutes.test.js zakt op een
   voorvoegsel dat een ander domein overlapt. */
'use strict';

/* De domeinen die in hun geheel een account vragen. Per regel het aantal
   accountweigeringen dat gemeten is, zodat een latere ronde kan zien of de
   grond nog bestaat. */
const VOORVOEGSELS = [
  { pad: '/api/ontmoeten/',     gemeten: 9, waarom: 'ontmoeten koppelt een gezin aan een account; alle negen weigeren erop' },
  { pad: '/api/rtgid/',         gemeten: 7, waarom: 'RTG iD hoort bij een eigen RTG-account; de rest van het domein zit al voorbij die poort' },
  { pad: '/api/webauthn/',      gemeten: 4, waarom: 'een passkey hangt aan een account en niet aan een pas' },
  { pad: '/api/pin/',           gemeten: 4, waarom: 'de algemene pin hoort bij een echt RTG-account' },
  { pad: '/api/sleutelwoorden/', gemeten: 3, waarom: 'sleutelwoorden horen bij een echt RTG-account; alle drie weigeren erop' },
  { pad: '/api/vonk/',          gemeten: 6, waarom: 'Vonk is voor RTG-leden met een eigen account (de 18+-poort staat daar los achter)' },
  { pad: '/api/ik',             gemeten: 6, waarom: 'het eigen dossier bestaat alleen bij een account; uid(req) is bij een passessie leeg' }
];

/* En de losse paden, in domeinen waar de PASsessie wel werk heeft. */
const PADEN = [
  '/api/auth/password', '/api/auth/resend',
  '/api/chat/send',
  '/api/member/dossier', '/api/member/identiteit/verzoeken', '/api/member/loonstroken',
  '/api/podium/kanaal/aanmeld', '/api/podium/kanalen',
  '/api/rtf/bericht', '/api/rtf/kanaal', '/api/rtf/koppel', '/api/rtf/meldingen/gelezen',
  '/api/rtf/ontkoppel', '/api/rtf/overzicht', '/api/rtf/profielen', '/api/rtf/uitnodiging/accepteer',
  '/api/werving/verbind'
];
const PADENSET = new Set(PADEN);

function dektPad(pad) {
  const p = String(pad || '');
  if (PADENSET.has(p)) return true;
  return VOORVOEGSELS.some(v => p === v.pad || p.startsWith(v.pad.endsWith('/') ? v.pad : v.pad + '/'));
}

/* MAG DEZE ROUTE NAAR EEN ACCOUNTSESSIE. Alleen vanaf `member` -- dat is
   dezelfde soort deur (een ledensessie), en dit verfijnt alleen WELKE. Vanaf
   elke andere rol is het geen verfijning maar een ander antwoord op de vraag
   wie er aanklopt; dezelfde grens als NOOIT_OPWAARDEREN in ./lijfsleutels.js
   en genreRolVoor in ./genrezaken.js. */
function accountRolVoor(huidigeRol, pad) {
  if (!dektPad(pad)) return { rol: null, reden: 'dit pad vraagt geen eigen account' };
  if (huidigeRol !== 'member') {
    return { rol: null, reden: '`' + huidigeRol + '` is geen ledensessie; een account verfijnt alleen `member`' };
  }
  return { rol: 'member-account', reden: null };
}

module.exports = { VOORVOEGSELS, PADEN, dektPad, accountRolVoor };
