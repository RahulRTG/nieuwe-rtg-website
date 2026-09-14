/* DE ONDERHOUDSRONDE: WAT ER ELKE VIJF MINUTEN WEG MAG, EN WAT NIET.

   Dit huis heeft drie tellers die vanzelf moeten krimpen -- de inlogrem
   (loginFails), het PIN-slot (pinslot.js) en de SSE-buffer (kern/sse.js). Zonder
   veger groeien ze met elke unieke bezoeker en komen ze nooit meer omlaag.

   DE VEGER IS TWEE KEER EEN GAT GEWEEST, EN BEIDE KEREN OP DEZELFDE MANIER: hij
   gooide weg wat op dat moment niets TEGENHIELD, en zag over het hoofd dat een
   emmer die nog aan het TELLEN is ook iets waard is. { n: 3, until: 0 } hield
   niets tegen en verdween dus -- elke vijf minuten begon een aanvaller weer bij
   nul. De regel van tien pogingen was in de praktijk "negen pogingen per
   opruimronde", en wie zijn gokken doseerde raakte de grens nooit. Weg mag
   alleen wat niets tegenhoudt EN niets meer telt.

   WAAROM DIT EEN FUNCTIE IS EN GEEN LUS. De reparatie hierboven zat in de
   `setInterval` van start.js, en daar kon niemand bij: een toets zou vijf
   minuten moeten wachten om hem een keer te zien draaien. Dat is precies wat
   LAT.md regel 2 een belofte noemt in plaats van een bewijs -- de zin "alleen
   opruimen wat niets tegenhoudt" stond er, en niets controleerde hem. Nu is de
   ronde een gewone functie met de tijd als parameter; start.js hangt hem in een
   interval en `test/onderhoud.test.js` roept hem aan met een nagemaakte klok.

   De klok staat er ook om een tweede reden: een veger toetsen met echte tijd
   betekent wachten, en een toets die wacht wordt uitgezet. */
'use strict';

const STILTE_MS = 15 * 60000; // zo lang moet een emmer stil zijn voor hij weg mag

/* HOE VAAK DE VEGER LANGSKOMT -- vijf minuten, en met een knop voor een MEETRONDE.

   Waarom die knop er is, en waarom hij niet over de veger gaat maar over het METEN.
   `start.js` hangt in dit interval ook `betaalWaarheid.ronde()`, die gestrande
   betaalopdrachten opnieuw inzendt; `railInzenden` meldt daarbij de stand van
   `money.payout` aan kern/commercie/capgezondheid.js. Dat schrijft dus BUITEN elk
   verzoek om -- en de idempotentieproef rekent zijn verschil tussen twee oproepen,
   dus landt dat werk bij de route die op dat moment aan de beurt is.

   Gemeten op 14 september 2026: 14 routes droegen zo `betaalOpdrachten` en 15
   `capGezondheid`, waaronder /api/lab2/labs, /api/member/snaps en
   /api/rtf/leerling/vakken -- geen daarvan betaalt iets uit. Het gevolgcontract van
   /api/pay/tik claimde die twee daarop als `gemeten`, en of dat "klopte" hing af van
   waar de tikker in een ronde van drie kwartier viel. Een meter die per ronde iets
   anders zegt, is geen meter.

   DE STANDAARD BEWEEGT NIET: zonder de variabele staat hij op dezelfde vijf minuten
   als hiervoor, dus in productie verandert er niets. `RTG_COMMERCIE_RONDE_MS` bestond
   al met precies deze vorm (server/opzet/kernlaag3c.js); dit is de tweede van de twee
   rondes die op vijf minuten tikken. Wat een STILLE server in 5,5 minuut nog meer
   schrijft is ook gemeten en staat NIET stil: `ledenSites`, `veilig` en `rtgai`. Die
   vallen buiten de twaalf seconden van de stille ijking, en er is geen enkele reden om
   aan te nemen dat dit de laatste twee tikkers zijn -- zie de kop van
   scripts/idemproef-route.js. */
const RONDE_MS = Number(process.env.RTG_ONDERHOUD_RONDE_MS || 5 * 60000);

/* Een kwartier stilte is ruim genoeg om het geheugen niet te laten vollopen, en
   te lang om een aanval te kunnen uitzitten: wie op de rem wacht, wacht langer
   dan het slot van vijf minuten dat hij probeerde te ontlopen.

   De twee grenzen zijn met opzet `>=` en niet `>`: precies op de grens blijft de
   emmer staan. Dat is de veilige kant -- een emmer een ronde te lang bewaren
   kost geheugen, een emmer een tel te vroeg weggooien lost de rem. */
function ruimRemmen(fails, nu, stilteMs) {
  const tijd = nu || Date.now();
  const stilte = stilteMs || STILTE_MS;
  let weg = 0;
  for (const [k, f] of fails) {
    if (f.until >= tijd) continue;                       // houdt op dit moment iets tegen
    if ((f.laatst || 0) >= tijd - stilte) continue;      // telt nog en is vers
    /* Geen `laatst` = een emmer van voor de reparatie, of eentje die alleen ooit
       op slot heeft gestaan. Die mag weg: hij houdt niets tegen en er is niets
       waarvan we weten dat het nog telt. */
    fails.delete(k); weg += 1;
  }
  return weg;
}

/* De hele ronde in een aanroep. Elk onderdeel is los weg te laten, zodat een
   toets er een kan bekijken zonder de andere twee op te tuigen. */
function onderhoudsronde({ loginFails, pinSlot, ruimBuffer, kappen, nu } = {}) {
  const tijd = nu || Date.now();
  const uit = { remmen: 0, gekapt: 0 };
  if (loginFails) uit.remmen = ruimRemmen(loginFails, tijd);
  if (pinSlot && typeof pinSlot.opruimen === 'function') pinSlot.opruimen();
  if (typeof ruimBuffer === 'function') ruimBuffer();
  /* DE KAPPEN. Collecties met een bovengrens werden afgekapt in de schrijfroute
     zelf; dat staat nu in kern/kappen.js en draait hier. De reden is niet
     netheid maar de begroting: een kap die in een verzoek duizenden rijen wil
     weghalen, botst op een grens die dat weigert -- en dan blijft de collectie
     te groot en loopt het volgende verzoek tegen dezelfde weigering aan. Buiten
     een verzoek bestaat dat probleem niet. Zie kern/kappen.js en KRIMP.json. */
  if (kappen && typeof kappen.ronde === 'function') uit.gekapt = kappen.ronde().totaal;
  return uit;
}

module.exports = { onderhoudsronde, ruimRemmen, STILTE_MS, RONDE_MS };
