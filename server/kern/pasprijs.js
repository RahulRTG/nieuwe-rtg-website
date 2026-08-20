/* WAT KOST EEN PAS PER MAAND? EEN ANTWOORD, VOOR IEDEREEN DIE HET VRAAGT.

   De eigenaar zet de pasprijs in de boardroom (kern/geldregie.js ->
   db.data.geld.pasprijzen, in centen). Drie plekken hadden die vraag nodig en
   losten hem elk apart op:

   - kern/aanmeldingen/betaalschema.js las de regie, met eigen terugvalwaarden;
   - kern/ledenregister.js las de regie, met eigen terugvalwaarden;
   - kern/lid.js las de regie HELEMAAL NIET en had { rtg: 65, lifestyle: 20000,
     business: 7500 } hard in euro's staan.

   Die derde is geen schoonheidsfoutje. lid.js schrijft dat bedrag op de FACTUUR
   van het lid: verander je de prijs in de boardroom, dan blijft de factuur het
   oude bedrag tonen. En voor de Business Pass, die volgens de regie
   nadrukkelijk GEEN prijs heeft, zette het er 7500 x 1,21 = 9.075 euro op. Een
   bedrag dat nergens is afgesproken, op een factuur.

   Vandaar dit bestand. Niet omdat drie kopieen lelijk staan, maar omdat kopieen
   uiteenlopen: dat is precies hoe teVaak() in drie kernmodules terechtkwam
   waarvan er geen enkele de opruimronde van het origineel had.

   NULL IS EEN ANTWOORD. Voor een CONTRACTUELE trede (Business, Lifestyle) is er
   geen maandprijs in de prijslijst; die spreek je per klant af. Deze functie
   geeft dan null, en wie daar toch een getal van maakt verzint het. Dat is
   bewust geen 0: nul zou "gratis" betekenen.

   EN BEWUST OOK NIET DE BODEM. Sinds de ladder (20 augustus 2026) heeft elke
   trede een ondergrens: Business Lite 150, Business 5.000, Lifestyle 20.000 euro
   per maand. Die bodem is er om invoer te WEIGEREN en om "vanaf" te tonen -- hij
   is geen prijs. Zou `maandCentenVoor` de bodem teruggeven, dan stond er weer
   een niet-afgesproken bedrag op een factuur, en dan is deze module terug bij de
   fout waarvoor ze gemaakt is. Wie de bodem wil, vraagt er expliciet om met
   `bodemCentenVoor`. */
'use strict';

const ladder = require('./pasladder');

/* De terugvalwaarden komen uit de ladder, zodat ze niet naast de bodems kunnen
   gaan liggen. Blijft geexporteerd onder de oude naam: het betaalschema, het
   ledenregister en de toetsen kennen hem zo. Contractuele treden staan er met
   null in. */
const STANDAARD = ladder.standaarden();

/* Is de hoogte van deze trede iets tussen RTG en de klant? Dan staat er geen
   bedrag in de prijslijst, hoe vaak iemand er ook een in zet. */
function contractueel(pas) {
  const t = ladder.trede(pas);
  return !!(t && t.contractueel);
}

/* `passen` is het passen-object uit geldPasprijzen(). Geef null/undefined mee en
   je krijgt de standaard -- dat is het gedrag dat de bellers al hadden toen de
   regie nog niet gemount was (laat-gebonden: zie server.js). */
function maandCentenVoor(passen, pas) {
  if (contractueel(pas)) return null;               // per klant afgesproken: er IS geen prijslijstbedrag
  const p = (passen || {})[pas];
  if (p && Number.isFinite(p.maandCenten)) return p.maandCenten;
  return Number.isFinite(STANDAARD[pas]) ? STANDAARD[pas] : 0;
}

/* De ondergrens van een trede. Voor het TONEN van een "vanaf"-prijs en voor het
   keuren van invoer -- nooit voor een bedrag dat afgerekend wordt. */
function bodemCentenVoor(pas) { return ladder.bodemCentenVan(pas); }

/* Gemaksvorm voor wie de regie als functie binnenkrijgt (het laat-gebonden
   patroon uit server.js). Vangt een falende regie op: dan de standaard, want
   een factuur die omvalt is erger dan een factuur met de standaardprijs. */
function maandCentenUit(geldPasprijzen, pas) {
  let passen = null;
  try { const p = geldPasprijzen && geldPasprijzen(); passen = (p && p.passen) || null; }
  catch (e) { passen = null; }
  return maandCentenVoor(passen, pas);
}

module.exports = { maandCentenVoor, maandCentenUit, bodemCentenVoor, contractueel, STANDAARD };
