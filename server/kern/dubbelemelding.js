/* EEN MELDING DIE TWEE KEER BINNENKOMT, IS EEN MELDING.

   Een inwoner meldt iets kapots bij de gemeente of iets met water bij de regio.
   Elke oproep maakte daar een nieuw dossier van met een eigen meldnummer, dus
   een hapering of een ongeduldige tweede tik gaf de behandelaar twee keer
   dezelfde kapotte lantaarnpaal in zijn wachtrij (TAKEN.md 4.30/4.56).

   WAAROM HIER GEEN IDEM-SLEUTEL VOLSTAAT. Die vangt alleen de herhaling van
   dezelfde POGING -- een retry, een hapering. Twee losse tikken op dezelfde
   knop zijn voor `metIdem` twee verschillende verzoeken, want de app maakt per
   klik een verse sleutel. Bij geld is dat precies goed (twee keer een kaart
   verkopen mag), maar hier niet: niemand wil dezelfde put twee keer melden.

   Daarom een VENSTER op de inhoud: dezelfde melder, dezelfde categorie en
   dezelfde tekst binnen een minuut is dezelfde melding, en die krijgt zijn
   eigen meldnummer terug in plaats van een nieuw dossier.

   WAT DIT NIET IS. Geen ontdubbeling tussen VERSCHILLENDE melders -- twee buren
   die dezelfde put melden zijn twee echte meldingen, en het stadsweefsel voegt
   die op stadsniveau al samen tot een zaak (zie kern/gemeente/meldingen.js).
   En geen blokkade: wie na een minuut nog eens meldt, meldt gewoon opnieuw. */
'use strict';
const rtgKlok = require('../lib/klok');

const VENSTER_MS = 60000;

/* Zoek een melding van dezelfde melder met dezelfde inhoud binnen het venster.
   `lijst` staat nieuwste-eerst, dus we kunnen stoppen zodra we buiten het
   venster vallen -- dat maakt dit O(1) op een lijst van veertigduizend.

   `velden` zijn de namen die samen "dezelfde melding" bepalen (bij de gemeente
   categorie + tekst, bij water soort + tekst). Ze worden als string vergeleken,
   want dat is hoe ze zijn opgeslagen. */
function zelfdeMeldingKortGeleden(lijst, nieuw, velden, nu) {
  if (!Array.isArray(lijst) || !lijst.length) return null;
  /* De tijd komt van de RTG-klok en niet van het besturingssysteem. Dit venster
     IS een tijdsvraag -- "is deze melding kort geleden nog eens gedaan?" -- en
     wie dat aan het OS vraagt, doet niet mee aan RTG_KLOK en is dus niet te
     beproeven op een klokverschuiving. Zie server/lib/klok.js; scripts/klok.js
     telt wat er nog buiten staat. */
  const grens = (typeof nu === 'number' ? nu : rtgKlok.nu()) - VENSTER_MS;
  for (const m of lijst) {
    const at = new Date(m.at || 0).getTime();
    if (!(at >= grens)) break;                       // nieuwste-eerst: verder is alleen ouder
    if (m.melderKey !== nieuw.melderKey) continue;
    if (velden.every(v => String(m[v] == null ? '' : m[v]) === String(nieuw[v] == null ? '' : nieuw[v]))) return m;
  }
  return null;
}

module.exports = { zelfdeMeldingKortGeleden, VENSTER_MS };
