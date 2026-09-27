/* ============================================================================
   BURGERPADEN -- welke verzoeken pseudoniem in de sporen komen (POLITIEK.md
   fase C3, besluit van 25 september 2026).

   Een burger die een kwestie inbrengt, staat in DemocratieOS alleen als een
   inbrengersnummer, en alleen kern/democratie/koppeling.js weet welke mens
   erachter zit. De twee sporen die elk verzoek vastleggen (lib/handelingsspoor
   en het API-spoor in opzet/auditspoor.js) schreven er naast het pad zijn
   RTG-sleutel, een tijd tot op de milliseconde en een afdruk van het lichaam
   bij. Die afdruk van `{ id: 'KW-...' }` is door het kantoor na te rekenen, dus
   het spoor legde precies de koppeling die de laag zelf niet maakt.

   HET BESLUIT IS NIET "GEEN SPOOR" MAAR "GEEN ONNODIG IDENTIFICEERBAAR SPOOR".
   De regel blijft staan -- dat een handeling plaatsvond, op welk pad en met
   welke uitslag -- maar zonder sleutel, zonder afdruk en met alleen de DAG.
   Wie namens het kantoor over een kwestie beslist, blijft wel op naam staan:
   dat gaat via /api/office/democratie/ en valt hier met opzet buiten.

   Wat dit NIET wegneemt, staat in kern/democratie/bewijsstand.js: de volgorde
   van de regels in een keten blijft zichtbaar. */
'use strict';

const BURGERPADEN = ['/api/member/democratie/'];
const PSEUDONIEM = 'burger (pseudoniem)';

const isBurgerpad = (pad) => BURGERPADEN.some(p => String(pad || '').startsWith(p));

/* Alleen de dag, in dezelfde vorm als een gewone tijd, zodat een lezer die
   een ISO-tijd verwacht niet breekt. */
const dag = (ms) => new Date(ms == null ? Date.now() : ms).toISOString().slice(0, 10) + 'T00:00:00.000Z';

module.exports = { BURGERPADEN, PSEUDONIEM, isBurgerpad, dag };
