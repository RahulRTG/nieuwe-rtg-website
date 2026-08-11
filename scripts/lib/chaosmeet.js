/* DE MEETKANT VAN DE CHAOSPROEF -- wat er uit een reeks monsters volgt.

   Los van ../chaos.js omdat dit het enige deel is dat je KUNT toetsen zonder
   processen om te leggen: geef er een reeks metingen in en er komt een oordeel
   uit. Het omleggen zelf is een script dat je draait; het rekenen erover hoort
   een toets te hebben, want juist hier zit de verleiding om een gunstig getal
   te maken.

   DRIE DINGEN DIE HIER BEWUST ZO STAAN:

   1. DE HERSTELTIJD LOOPT VANAF DE EERSTE MISLUKKING EN NIET VANAF DE KLAP.
      Tussen het omleggen en het eerste mislukte verzoek zit de tijd tot de
      volgende meting; die meerekenen maakt de uitslag afhankelijk van hoe vaak
      je meet. Wat de klant merkt, begint bij het eerste verzoek dat niet
      lukte -- dat is dus het startpunt, en het moment van de klap staat er
      apart bij.

   2. GEEN ENKELE MISLUKKING IS EEN UITSLAG EN GEEN BEWIJS. Een proef waarin
      niets omviel kan betekenen dat de failover perfect was, of dat er tussen
      twee metingen door hersteld is. Daarom heet die uitkomst 'geen onderbreking
      gemeten' en niet 'geen onderbreking'.

   3. NOOIT HERSTELD IS DE ERNSTIGSTE UITSLAG EN MOET DAT OOK BLIJVEN. Als er na
      de klap geen enkel verzoek meer lukt, is de hersteltijd NIET nul en niet
      "de duur van de proef" -- hij is onbekend, en het oordeel is 'niet
      hersteld'. */
'use strict';

function meet(monsters, klapAt) {
  const rij = (Array.isArray(monsters) ? monsters : []).slice().sort((a, b) => a.at - b.at);
  const totaal = rij.length;
  const mislukt = rij.filter(m => !m.ok).length;
  const na = rij.filter(m => m.at >= klapAt);
  const eersteFout = na.find(m => !m.ok) || null;
  const herstel = eersteFout ? na.find(m => m.at > eersteFout.at && m.ok) || null : null;

  let oordeel, hersteltijdMs = null;
  if (!eersteFout) oordeel = 'geen onderbreking gemeten';
  else if (!herstel) oordeel = 'niet hersteld';
  else { oordeel = 'hersteld'; hersteltijdMs = herstel.at - eersteFout.at; }

  return {
    verzoeken: totaal, mislukt,
    deelGelukt: totaal ? Number(((totaal - mislukt) / totaal).toFixed(4)) : null,
    klapAt, eersteFoutAt: eersteFout ? eersteFout.at : null,
    herstelAt: herstel ? herstel.at : null,
    hersteltijdMs, oordeel,
    /* De vertraging tussen het omleggen en het eerste gemiste verzoek. Hij
       staat er apart bij omdat hij niets zegt over de failover en alles over
       hoe vaak er gemeten is. */
    meetvertragingMs: eersteFout ? eersteFout.at - klapAt : null,
    let: !eersteFout
      ? 'er is geen onderbreking GEMETEN. Dat kan betekenen dat de failover binnen de meetafstand ' +
        'viel; het is geen bewijs dat er geen onderbreking was.'
      : (!herstel ? 'na de klap is geen enkel verzoek meer gelukt. De hersteltijd is dus niet nul maar ' +
        'onbekend, en dit is de ernstigste uitslag die deze proef kent.' : null)
  };
}

module.exports = { meet };
