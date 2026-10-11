/* HET EXTERNE ANKER BIJ EEN AVG-WISSING, voor ./vergeten.js.

   De herzegeling van het API-spoor geeft de geankerde kop een andere zegel, en
   de ankertimer houdt elke herschrijving voor een vervalsing (lib/ankertimer.js):
   elke wissing zette het anker dan stil tot een mens met de hand opnieuw
   ankerde. Daarom rekent de ankerdienst EERST uit wat de herzegeling gaat doen
   en tekent dat (lib/ankerherzegel.js) -- met wie de wissing deed uit de SESSIE
   en zonder de gewiste sleutel. Na het vastleggen gaat die verklaring met een
   gewone ankerronde mee naar buiten.

   Afgesplitst uit vergeten.js, dat al over de omvanggrens stond. */
'use strict';

function voor(kern, key, sessie, reden) {
  if (!(kern.apiSpoor && kern.apiSpoor.wisActor && kern.ankerdienst && kern.ankerdienst.herzegelVoor)) return null;
  return kern.ankerdienst.herzegelVoor({ journaal: 'apiSpoor', actor: key, reden,
    door: sessie.role === 'office' && sessie.lidKey ? { rol: 'office', wie: String(sessie.lidKey) }
      : { rol: sessie.role || 'lid', wie: 'de betrokkene zelf' },
    vorigAnker: kern.ankerpost && kern.ankerpost.vorigAnker ? kern.ankerpost.vorigAnker() : null });
}

/* De herzegeling naar buiten, als ONDERDEEL van de wissing -- en via een gewone
   ankerronde, niet via een losse post: die vergelijkt eerst het vorige blok. Een
   kale post zou een vervalsing van vóór de wissing onder een vers blok begraven.
   Zonder ankerpost (geen RTG_ANKERPOST_URL) zegt de ronde "niet in bedrijf"; lukt
   hij niet, dan ligt de getekende herzegeling klaar en neemt de volgende
   periodieke ronde hem mee. */
async function naar(kern, herzegeling) {
  if (herzegeling && kern.ankerpost) await require('../lib/ankertimer').eenRonde(kern.ankerpost, console);
}

module.exports = { voor, naar };
