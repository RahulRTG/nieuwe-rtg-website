/* RTMAIL (deelmodule): de LIJN van een doorgegeven postvakrecht.

   Een delegatie die niet van de eigenaar komt, is zo sterk als haar gever NU
   nog is. Daarom wordt het effectieve recht bij elke vraag opnieuw gerekend
   als doorsnede (kern/namens/versmalling.js, versmalNamens) van wat er in de
   rij staat en wat de gever op dit moment nog mag weggeven. Wie de gever is,
   staat al in `door`, dus oude rijen hebben geen migratie nodig.

   Gevolgen, en daar is hij voor:
     - trekt de eigenaar de gever in, dan valt alles wat die doorgaf vanzelf weg;
     - verloopt de gever, dan verloopt wat hij doorgaf mee;
     - een kring (A gaf aan B, B gaf aan A) of een te diepe keten telt als niets.
   Geen opslag, geen klok van zichzelf: de aanroeper geeft de rijen en het
   moment mee. */
'use strict';

const { versmalNamens } = require('./namens/versmalling');

const MAX_DIEPTE = 8;

function maakLijn({ RECHTEN, geldig }) {
  function effectief(rijen, rij, t, gezien = new Set()) {
    if (!rij || !geldig(rij, t) || gezien.has(rij.id) || gezien.size >= MAX_DIEPTE) return [];
    if (!rij.door || rij.door === rij.postvak) return rij.rechten;
    gezien.add(rij.id);
    const ouder = rijen.find(x => x.postvak === rij.postvak && x.aan === rij.door);
    const o = effectief(rijen, ouder, t, gezien);
    if (!o.includes('delegatie')) return [];
    return versmalNamens({ gevraagd: rij.rechten, geverEffectief: o, beleid: RECHTEN, context: RECHTEN }).effectief;
  }
  return { effectief };
}

module.exports = { maakLijn, MAX_DIEPTE };
