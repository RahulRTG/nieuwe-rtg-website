/* ============================================================================
   DE VORM VAN EEN BEVESTIGING -- de stand en wat er naar buiten gaat. De code
   wordt sinds 27 september 2026 als hash vergeleken in ./bevestiging-code.js.

   Apart van ./bevestiging.js omdat dat bestand er over de omvangsgrens van
   keuringsregel 13 mee ging, met de naad op dezelfde plek als bij de machtiging:
   geen levensloop, geen opslag, alleen vorm.

   TWEE DINGEN DIE HIER HUN REDEN HEBBEN.

   WAT DE MEDEWERKER ZIET IS NIET WAT HET LID ZIET. De code hoort in de app van
   het LID: een medewerker die hem van zijn eigen scherm kan aflezen, bevestigt
   niets, en dan is de terugval een lege ceremonie.

   EN HET LID MOET ZIEN OF ER EEN MACHINE VRAAGT. `ai:onderzoeker` leest niemand
   als "dit is geen mens". De vlag wordt AFGELEID uit het voorvoegsel dat niemand
   zelf kan zetten (./machtiging-grenzen.js), en nooit uit een veld dat de
   aanvrager meegeeft.
   ========================================================================== */
'use strict';

const klok = require('../../lib/klok');
const { isAi } = require('./machtiging-grenzen');

function stand(b) {
  if (b.gebruiktAt) return 'gebruikt';
  if (b.geweigerdAt) return 'geweigerd';
  return Date.parse(b.tot) <= klok.nu() ? 'verlopen' : 'open';
}
const levend = (b) => stand(b) === 'open';

function kortB(b, { voorLid = false, minuten } = {}) {
  const basis = { id: b.id, zaak: b.zaak, mens: b.mens, machine: isAi(b.mens), doel: b.doel,
    reden: b.reden, capabilities: b.capabilities.slice(), stand: stand(b), at: b.at, tot: b.tot,
    machtiging: b.machtiging, via: b.via };
  // de code staat hier nooit: het lid vraagt hem op met toon() en ziet hem precies een keer
  if (voorLid) return Object.assign(basis, { minuten });
  return basis;
}

module.exports = { stand, levend, kortB };
