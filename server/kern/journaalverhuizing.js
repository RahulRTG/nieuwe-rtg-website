/* DE EENMALIGE VERHUIZING: van de oude collectie naar het bestand.

   Het doorgeefjournaal bewaarde zijn regels in db.data.doorgeefjournaal; sinds
   24 augustus 2026 staan ze in een append-only bestand (./journaalbestand.js).
   Een installatie die nog niet is bijgewerkt draagt de oude collectie, en die
   mag niet stil verdwijnen op het moment van bijwerken -- niemand kijkt elke
   dag in het journaal, dus dat zou pas opvallen als je het nodig had.

   Apart bestand omdat het een AFLOPENDE zaak is: hij draait een keer per
   installatie en is daarna dood gewicht in de module die elk verzoek raakt. */
'use strict';

/* De verhuizing gebeurt EEN keer, bij het aanmaken, en alleen als er nog een
   oude collectie ligt. Zonder dit zou een bestaande installatie zijn
   geschiedenis kwijtraken op het moment van bijwerken -- stil, want niemand
   kijkt elke dag in het journaal. */
function verhuisOude({ db, save, boek }) {
  if (!boek) return 0;
  const oud = db.data && db.data.doorgeefjournaal;
  if (!Array.isArray(oud) || !oud.length) return 0;
  let n = 0;
  for (const r of oud) if (boek.voegToe(r)) n++;
  /* EERST BEWIJZEN DAT HET GESCHREVEN IS, DAN PAS WEGGOOIEN. Hier stond
     `spoelNu(); delete ...` zonder naar de uitkomst te kijken: een volle
     schijf maakte daarmee van een verhuizing een VERWIJDERING, en niets dat
     erover klaagde. Dubbel werk bij de volgende start is niet erg; de
     geschiedenis kwijt wel. (test/journaalbestand.test.js, toets 11.) */
  const weg = boek.spoelNu();
  const stand = boek.stand();
  if (stand.stuk || weg < n) {
    console.warn('[journaal] verhuizing NIET voltooid (' + weg + ' van ' + n +
      ' regels geschreven' + (stand.stuk ? ', reden: ' + stand.stuk : '') +
      '). De oude collectie blijft staan; er gaat niets verloren.');
    return 0;
  }
  delete db.data.doorgeefjournaal;
  try { save(); } catch (e) {}
  console.log('[journaal] ' + n + ' bewaarde regels verhuisd van de database naar ' + stand.map);
  return n;
}

module.exports = { verhuisOude };
