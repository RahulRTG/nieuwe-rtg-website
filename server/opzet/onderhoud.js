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
const RONDE_MS = 5 * 60000;   // ...en zo vaak komt de veger langs

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
function onderhoudsronde({ loginFails, pinSlot, ruimBuffer, peilOpslag, legVoorspellingVast, nu } = {}) {
  const tijd = nu || Date.now();
  const uit = { remmen: 0 };
  if (loginFails) uit.remmen = ruimRemmen(loginFails, tijd);
  if (pinSlot && typeof pinSlot.opruimen === 'function') pinSlot.opruimen();
  if (typeof ruimBuffer === 'function') ruimBuffer();
  /* DE OPSLAGPEILING (KOSTEN.md). Opslag is de enige kostensoort die je niet
     kunt optellen: er STAAT op enig moment zoveel, en dat meet je. Deze ronde is
     de enige klok die dit huis al had, dus hangt de peiling eraan.

     De REM zit niet hier maar in kern/kosten/peiling.js: die slaat een peiling
     binnen het uur over. Zo hoeft deze ronde niet te weten hoe vaak te vaak is,
     en is dat op een plek te veranderen. Slikt zijn eigen fouten: een
     onderhoudsronde die omvalt op een boekhouding laat de inlogrem staan, en dat
     is een beveiligingsprobleem in plaats van een kostenprobleem. */
  if (typeof peilOpslag === 'function') {
    try { uit.peiling = peilOpslag(); } catch (e) { uit.peiling = { ok: false, waarom: e.message }; }
  }
  /* En de voorspelling van vandaag vastleggen (hooguit een keer per dag; de rem
     zit in kern/kosten/vooruitblik.js). Zonder opgeschreven voorspelling valt er
     later niets na te rekenen, en dan is elke bewering over trefzekerheid een
     herinnering in plaats van een meting. */
  if (typeof legVoorspellingVast === 'function') {
    try { uit.voorspelling = legVoorspellingVast(); } catch (e) { uit.voorspelling = { ok: false, waarom: e.message }; }
  }
  return uit;
}

module.exports = { onderhoudsronde, ruimRemmen, STILTE_MS, RONDE_MS };
