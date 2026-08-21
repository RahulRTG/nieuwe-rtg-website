/* KOMT DEZE ROUTE IN EEN TOETS VOOR?

   Stond in scripts/keuring.js, binnen dekking(). Toen scripts/nieuweroutes.js
   dezelfde vraag moest stellen -- niet over alle routes maar alleen over de
   routes die in deze tak nieuw zijn -- was de keuze: een kopie, of een plek.
   Een kopie is LAT.md regel 4, en juist hier zou hij uiteenlopen: de twee
   tellers zouden verschillende antwoorden geven over dezelfde route, en dan
   ratelt de ene terwijl de andere doorlaat.

   WAT DEZE VRAAG WEL EN NIET IS. Hij is een TEKSTZOEKTOCHT en geen bewijs. Het
   echte cijfer komt uit scripts/dekking.js, dat het journaal leest dat de server
   tijdens de testrun zelf schrijft. Deze vorm blijft bestaan omdat hij snel is
   en geen suite hoeft te draaien -- maar hij zit er twee kanten op naast, en dat
   staat woordelijk in de kop van dekking() in keuring.js.

   DRIE VORMEN, EN DE REDEN VOOR ELK. Bijna elke toets heeft bovenaan een helper:

       const api = (pad, body, token) => fetch(base + '/api/' + pad, ...)
       await api('bank/overzicht', {}, lid.token)

   De volledige route staat dan NERGENS in het bestand terwijl hij wel degelijk
   wordt aangeroepen. Zoeken op alleen de volledige vorm telde 187 routes als
   ongedekt die het niet zijn. Daarom ook de afgeknipte vorm, en die MET een
   leidende slash maar zonder /api-prefix (`l.call('/member/boardroom/zetveel')`).
   De eis dat ze tussen aanhalingstekens staan is streng met opzet: 'bank/overzicht'
   als losse string is een aanroep, bank/overzicht in lopende tekst niet. */
'use strict';

function gedektIn(route, testTekst) {
  if (testTekst.includes(route)) return true;
  const staart = route.slice(5);          // zonder '/api/'
  for (const vorm of [staart, '/' + staart]) {
    if (testTekst.includes("'" + vorm + "'") ||
        testTekst.includes('"' + vorm + '"') ||
        testTekst.includes('`' + vorm + '`')) return true;
  }
  return false;
}

module.exports = { gedektIn };
