/* ============================================================================
   DE SIGNATUREROUTES -- deuren achter de KYC-poort.

   Vierde en laatste variant van de vorm die deze ronde drie keer langskwam: de
   bewakerskaart zegt welke SOORT sessie een route vraagt, en de handeling
   erachter vraagt daar iets specifiekers van. Hier is dat het zwaarste wat dit
   huis kent -- een lid dat aantoonbaar is wie het zegt te zijn.

   De poort staat op EEN plek voor beide datingapps
   (server/kern/ontmoetpoort.js; ONTMOETEN.md par. 4) en vraagt drie dingen
   tegelijk: een Lifestyle- of Business Pass, een account met
   `verified === 'verified'`, en 18 jaar of ouder. Zie ./wereld-signature.js
   voor de weg ernaartoe -- die is met opzet lang.

   Gemeten uit de weigeringen zelf:

     /api/member/rendezvous   17  "Verifieer eerst uw identiteit"
     /api/vonk                 6  "Activeer eerst uw RTG-geverifieerde paspoort"

   /api/supplier/paspoort (2x "Dit lid heeft geen RTG-geverifieerd paspoort")
   staat hier NIET: dat is een zaak die naar een LID kijkt, niet een lid dat
   zichzelf legitimeert. Daar helpt een andere sessie niet -- daar moet het lid
   dat de zaak aanwijst geverifieerd zijn, en dat is een andere reparatie.

   DE GRENS. Deze verfijning geldt vanaf `member`, `member-account` en
   `member-lifestyle` -- alle drie ledensessies, en alle drie missen ze iets
   wat deze poort vraagt. Vanaf elke andere rol is het geen verfijning maar een
   ander antwoord op de vraag wie er aanklopt; dezelfde regel als in de drie
   zusterregisters. */
'use strict';
const { dekt } = require('./padgrens');

const VOORVOEGSELS = [
  { pad: '/api/member/rendezvous', gemeten: 17,
    waarom: 'Rendez-vous vraagt een pas, een geverifieerd account en 18 jaar -- alle drie tegelijk' },
  { pad: '/api/vonk', gemeten: 6,
    waarom: 'Vonk deelt dezelfde ontmoetpoort; zonder geverifieerd paspoort blijft hij dicht' }
];
const PADEN = [];
const PADENSET = new Set(PADEN);

/* De drie ledensessies die hierheen mogen worden verfijnd. `member-zakelijk`
   staat er niet bij: die heeft de pas wel maar het account niet, en hem hier
   toelaten zou de meting laten denken dat een Business Pass alleen genoeg is. */
const VANAF = new Set(['member', 'member-account', 'member-lifestyle']);

function dektPad(pad) {
  return PADENSET.has(String(pad || '')) || VOORVOEGSELS.some(v => dekt(pad, v.pad));
}

function signatureRolVoor(huidigeRol, pad) {
  if (!dektPad(pad)) return { rol: null, reden: 'dit pad vraagt geen geverifieerde identiteit' };
  if (!VANAF.has(huidigeRol)) {
    return { rol: null, reden: '`' + huidigeRol + '` is geen ledensessie; ' +
      'de ontmoetpoort verfijnt alleen een lid' };
  }
  return { rol: 'member-signature', reden: null };
}

module.exports = { VOORVOEGSELS, PADEN, VANAF, dektPad, signatureRolVoor };
