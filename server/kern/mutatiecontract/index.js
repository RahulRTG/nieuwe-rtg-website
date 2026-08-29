/* ============================================================================
   HET MUTATIECONTRACT -- de keuring.

   De twee woordenlijsten (STATUS en TOEGANG) staan in ./klassen.js, met per
   stand wat hij betekent en welk bewijs hij eist. Dit bestand controleert of een
   contract die eisen waarmaakt, en telt het resultaat.

   HET VERSCHIL MET ../mutatie.js, EN WAAROM ER TWEE ZIJN.

   `kern/mutatie.js` beantwoordt: WAT IS DEZE MUTATIE? (idempotent,
   sleutelVereist, hooguitEens, compenseerbaar, nietHerhaalbaar, onbekend). Dat
   is een uitspraak over de handeling zelf, en die blijft daar staan -- er komt
   hier geen tweede woordenlijst voor hetzelfde. Dat is precies de fout die
   SEMANTIEK.json in dit huis 78 keer heeft gevonden, en waar twee bestanden met
   allebei een `VERMOGENS` het duurste voorbeeld van zijn.

   Deze laag beantwoordt een ANDERE vraag: WAT WETEN WIJ ERVAN, EN HOE HARD IS
   DAT? Een route kan `nietHerhaalbaar` zijn omdat iemand dat heeft vastgesteld,
   of omdat niemand ooit heeft gekeken. Voor een taakloper, een SDK en een
   release-poort is dat verschil alles, en geen enkele klasse in mutatie.js kan
   het uitdrukken.

   DE VIJF ASSEN, EN WAAR ELK VAN ZE WOONT:

     1. SEMANTIEK        wat is deze mutatie          -> kern/mutatie.js
     2. DUPLICAATGEDRAG  wat is "hetzelfde verzoek"   -> lib/idemsleutels.js
     3. BEWIJS           wat is er gemeten            -> IDEMPROEF.json
     4. TOEGANG          wie mag hier binnen          -> ./klassen.js
     5. STAND            hoe hard is onze kennis      -> ./klassen.js

   DE REGEL DIE HET GEHEEL DRAAGT: alleen LEGACY_PENDING_CLASSIFICATION moet naar
   nul. De andere vijf standen zijn eindstanden. Een route die met opzet niet
   idempotent is, is KLAAR zodra dat is vastgesteld en bewezen -- niet zodra hij
   idempotent is gemaakt. Wie dat omdraait, verbouwt de architectuur om een
   percentage mooi te krijgen, en dat is duurder dan het gat dat hij dicht.
   ========================================================================== */
'use strict';

const { STATUS, TOEGANG, STATUSNAMEN, TOEGANGNAMEN } = require('./klassen');

const { keur } = require('./keuring');

/* DE POORT. Aanroepen bij het OPBOUWEN, net als mutatie.poort() -- een contract
   dat niet deugt hoort de bouw te laten zakken en niet een verzoek van een lid. */
function poort(contracten, waar) {
  const plek = String(waar || 'een verzameling contracten');
  const fouten = [];
  for (const c of Array.isArray(contracten) ? contracten : Object.values(contracten || {})) {
    for (const f of keur(c)) fouten.push(f);
  }
  if (fouten.length) {
    throw new Error('Mutatiecontracten deugen niet in ' + plek + ':\n  - ' + fouten.join('\n  - '));
  }
  return true;
}

/* De telling waarop het dashboard rust. Eén plek, zodat het scherm, de toets en
   de release-poort niet elk hun eigen optelling maken. */
function telling(contracten) {
  const uit = { totaal: 0, perStand: {}, perToegang: {}, perSemantiek: {},
    zonderEindstand: 0, naarNul: 0 };
  for (const c of Array.isArray(contracten) ? contracten : Object.values(contracten || {})) {
    uit.totaal++;
    const s = c.stand || 'LEGACY_PENDING_CLASSIFICATION';
    uit.perStand[s] = (uit.perStand[s] || 0) + 1;
    const t = (c.toegang && c.toegang.klasse) || '(geen)';
    uit.perToegang[t] = (uit.perToegang[t] || 0) + 1;
    const m = (c.semantiek && c.semantiek.klasse) || '(geen)';
    uit.perSemantiek[m] = (uit.perSemantiek[m] || 0) + 1;
    const d = STATUS[s];
    if (d && !d.eindstand) uit.zonderEindstand++;
    if (d && d.naarNul) uit.naarNul++;
  }
  return uit;
}

module.exports = { STATUS, TOEGANG, STATUSNAMEN, TOEGANGNAMEN, keur, poort, telling };
