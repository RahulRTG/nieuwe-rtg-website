'use strict';

/* DE DEKKINGSINDEX -- waarom hier een register staat en geen lus met includes().

   EIGEN MODULE, en dat is niet alleen netheid. In scripts/keuring.js stond dit
   tussen eenendertig kilobyte andere regels, en de mutatiemotor koos daar zijn
   plek per operator: hij landde vrijwel nooit op deze zestig regels, en
   test/keuringsindex.test.js kwam als OVERLEVER uit de meting terwijl twee
   gerichte mutaties hem met de hand wel degelijk laten zakken. Dat is geen
   zwakke toets maar een te grote hooiberg om in te muteren. Hier is de module
   het onderwerp, en meet de motor wat de toets beweert.

   Dit was zeven keer `testTekst.includes(...)` per route, en testTekst is de
   samengeplakte inhoud van alle toetsbestanden: tientallen megabytes. Bij ruim
   vierduizend routes zijn dat bijna dertigduizend volledige scans over die
   tekst. Gemeten met --cpu-prof: 64% van de HELE keuring zat in die ene
   functie, 21 van de 33 seconden. En de keuring is geen eenmalig ding --
   scripts/norm.js roept hem aan, en test/meterijk.test.js roept norm aan voor
   ELKE meter; die toets liep daardoor tegen de twaalf minuten.

   De omkering: niet de hooiberg afzoeken per naald, maar de hooiberg EEN keer
   doorlopen en er een register van maken.

     - `naApi` is alles wat er in de toetsen direct achter een '/api/' staat.
       `testTekst.includes(route)` is dan precies: begint een van die stukken
       met de staart van deze route. Gesorteerd, met een tweedeling gezocht.
     - `letterlijk` is de verzameling teksten die in de toetsen TUSSEN twee
       aanhalingstekens staan. `includes("'" + vorm + "'")` is dan precies: zit
       `vorm` in die verzameling.

   Allebei geven ze exact hetzelfde antwoord en geen benadering: split() op een
   scheidingsteken levert per definitie de stukken die ertussen staan. Dat is
   ook nagemeten -- de keuring geeft na deze wijziging een byte-voor-byte
   identiek --json-rapport, en test/keuringsindex.test.js houdt de gelijkheid
   vast met de TRAGE vorm als tegenspeler, op de echte toetsen en op tekst die
   met opzet lastig is.

   KAP staat op 400: een route is nooit zo lang, en zonder die grens zou een
   toets met een lange regel tekst het register laten opzwellen. */
const DEKKING_KAP = 400;
function maakDekkingsIndex(testTekst) {
  const naApi = String(testTekst).split('/api/').slice(1).map(s => s.slice(0, DEKKING_KAP)).sort();
  const letterlijk = new Set();
  for (const teken of ["'", '"', '`']) {
    const d = String(testTekst).split(teken);
    for (let i = 1; i < d.length - 1; i++) if (d[i].length <= DEKKING_KAP) letterlijk.add(d[i]);
  }
  /* Begint een van de gesorteerde stukken met deze staart? Tweedeling: zoek de
     eerste die niet kleiner is, en kijk of die het voorvoegsel draagt. */
  const beginErmee = (staart) => {
    let lo = 0, hi = naApi.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (naApi[mid] < staart) lo = mid + 1; else hi = mid; }
    return lo < naApi.length && naApi[lo].startsWith(staart);
  };
  return function gedekt(route) {
    const staart = route.slice(5);          // zonder '/api/'
    if (beginErmee(staart)) return true;    // was: testTekst.includes(route)
    /* Ook de vorm MET leidende slash maar ZONDER /api-prefix. Dat is hoe een
       test hem schrijft als haar helper de prefix zelf plakt:
       `l.call('/member/boardroom/zetveel')`. Die endpoints werden geteld als
       ongedekt terwijl de test ze wel degelijk aanroept -- de teller keek naar
       de verkeerde vorm. Een indicatie die de goede gevallen mist, stuurt je
       naar werk dat al gedaan is. */
    return letterlijk.has(staart) || letterlijk.has('/' + staart);
  };
}

module.exports = { maakDekkingsIndex, DEKKING_KAP };
