/* ============================================================================
   De SCIM-filter, maar dan alleen het stukje dat er in de praktijk toe doet.

   RFC 7644 beschrijft een complete filtertaal met and/or/not, haakjes, en
   operatoren als co, sw, pr, gt. Die hele taal bouwen betekent een parser
   schrijven die op een verzoek van buiten draait -- precies het soort code waar
   je later een lek in vindt.

   Wat de IdP's in de praktijk sturen bij het inrichten van een gebruiker is
   dit, en niets anders:

       userName eq "iemand@klant.nl"

   Dat is de vraag "ken je deze al?" voor het aanmaken. Daar houden we het bij.
   Een filter dat we niet begrijpen, geven we terug als een NETTE FOUT
   (scimType: invalidFilter) en niet als een lege lijst. Het verschil is groot:
   bij een lege lijst concludeert de IdP "die bestaat nog niet" en maakt hij een
   tweede account aan. Een fout laat de synchronisatie stoppen met een melding
   die een beheerder kan lezen.
   ========================================================================== */
'use strict';

/* userName eq "..." (of ' ), hoofdletterongevoelig in de operator en het
   attribuut, zoals de RFC voorschrijft. */
const PATROON = /^\s*(userName|emails(?:\.value)?|externalId)\s+eq\s+("([^"]*)"|'([^']*)')\s*$/i;

function ontleed(filter) {
  const s = String(filter || '').trim();
  if (!s) return { soort: 'alles' };
  const m = PATROON.exec(s);
  if (!m) return { soort: 'onbekend', reden: 'Alleen een filter van de vorm `userName eq "..."` wordt ondersteund.' };
  const attribuut = m[1].toLowerCase().startsWith('emails') ? 'userName' : m[1].toLowerCase();
  const waarde = m[3] !== undefined ? m[3] : m[4];
  if (attribuut === 'externalid')
    return { soort: 'onbekend', reden: 'RTG bewaart geen externalId; filter op userName.' };
  return { soort: 'gelijk', attribuut: 'userName', waarde: String(waarde).trim().toLowerCase() };
}

module.exports = { ontleed, PATROON };
