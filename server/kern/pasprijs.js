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
   nadrukkelijk `opMaat: true` is en dus GEEN prijs heeft, zette het er 7500 x
   1,21 = 9.075 euro op. Een bedrag dat nergens is afgesproken, op een factuur.

   Vandaar dit bestand. Niet omdat drie kopieen lelijk staan, maar omdat kopieen
   uiteenlopen: dat is precies hoe teVaak() in drie kernmodules terechtkwam
   waarvan er geen enkele de opruimronde van het origineel had.

   NULL IS EEN ANTWOORD. Voor de Business Pass is er geen maandprijs; die spreek
   je per klant af. Deze functie geeft dan null, en wie daar toch een getal van
   maakt verzint het. Dat is bewust geen 0: nul zou "gratis" betekenen. */
'use strict';

/* De terugvalwaarden, op EEN plek. Ze staan gelijk aan wat geldregie.js zelf
   gebruikt als er nog niets is ingesteld; liepen ze uiteen, dan zou een verse
   installatie andere bedragen tonen dan hij berekent. */
const STANDAARD = { gratis: 0, rtg: 6500, lifestyle: 2000000 };

/* `passen` is het passen-object uit geldPasprijzen(). Geef null/undefined mee en
   je krijgt de standaard -- dat is het gedrag dat de bellers al hadden toen de
   regie nog niet gemount was (laat-gebonden: zie server.js). */
function maandCentenVoor(passen, pas) {
  if (pas === 'business') return null;              // op maat: er IS geen bedrag
  const p = (passen || {})[pas];
  if (p && Number.isFinite(p.maandCenten)) return p.maandCenten;
  return Number.isFinite(STANDAARD[pas]) ? STANDAARD[pas] : 0;
}

/* Gemaksvorm voor wie de regie als functie binnenkrijgt (het laat-gebonden
   patroon uit server.js). Vangt een falende regie op: dan de standaard, want
   een factuur die omvalt is erger dan een factuur met de standaardprijs. */
function maandCentenUit(geldPasprijzen, pas) {
  let passen = null;
  try { const p = geldPasprijzen && geldPasprijzen(); passen = (p && p.passen) || null; }
  catch (e) { passen = null; }
  return maandCentenVoor(passen, pas);
}

module.exports = { maandCentenVoor, maandCentenUit, STANDAARD };
