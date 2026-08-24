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

/* DE ZEVEN VORMEN STAAN OP EEN PLEK, en dat is de reden dat de snelle en de
   losse vraag niet uit elkaar KUNNEN lopen. Wie hier een vorm bijzet, zet hem
   voor allebei bij; een tweede lijst zou precies het gat maken waar de kop
   hierboven voor waarschuwt. */
function patronenVoor(route) {
  const staart = route.slice(5);          // zonder '/api/'
  const uit = [route];
  for (const vorm of [staart, '/' + staart]) {
    uit.push("'" + vorm + "'", '"' + vorm + '"', '`' + vorm + '`');
  }
  return uit;
}

function gedektIn(route, testTekst) {
  for (const p of patronenVoor(route)) if (testTekst.includes(p)) return true;
  return false;
}

/* DEZELFDE VRAAG VOOR ALLE ROUTES TEGELIJK, EN DAT SCHEELT ACHTTIEN SECONDEN.

   gedektIn() per route is 4195 x 7 = 29.365 aanroepen van String.includes over
   een tekst van 10 MB: ruim 126 gigabyte scannen, en gemeten 16,9 seconde. En
   die vraag wordt niet een keer per ronde gesteld maar bij elke meting die
   endpointsZonderTest, dekkingPct of keuringScheef nodig heeft -- in de
   meterijking alleen al 85 van de 126 seconden.

   scripts/lib/veelzoek.js draait het om: alle patronen EEN keer in een boom, de
   tekst EEN keer erdoorheen (Aho-Corasick). Gemeten op de echte toetscode: 327
   ms in plaats van 16.899, met exact dezelfde 2874 gedekte routes.

   Dat "exact dezelfde" is hier geen bijzin. Deze uitkomst voedt twee
   RATELTANDEN (endpointsZonderTest en dekkingPct in NORM.json), en een snellere
   zoeker die net iets anders vindt is geen versnelling maar een stille
   verschuiving van een norm. test/veelzoek.test.js houdt de twee daarom tegen
   elkaar op de ECHTE toetscode, route voor route. */
function gedektenIn(routes, testTekst) {
  const { welkeKomenVoor } = require('./veelzoek');
  const alle = [];
  for (const r of routes) for (const p of patronenVoor(r)) alle.push(p);
  const gevonden = welkeKomenVoor(testTekst, alle);
  const uit = new Set();
  for (const r of routes) if (patronenVoor(r).some(p => gevonden.has(p))) uit.add(r);
  return uit;
}

module.exports = { gedektIn, gedektenIn, patronenVoor };
