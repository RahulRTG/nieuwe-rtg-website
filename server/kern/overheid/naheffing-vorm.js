/* Overheid-domein "naheffing" (deelmodule): DE VORM waarin een naheffing naar
   buiten gaat.

   Vijf slices schrijven aan een naheffing -- opmaken, betalen, invorderen,
   remmen, beslissen op bezwaar -- en ze geven hem alle vijf terug. Als elk van
   die vijf zijn eigen beeld zou samenstellen, ziet de zaak op het ene scherm
   iets anders dan op het andere, en dan is het scherm de bron in plaats van de
   opslag.

   Vandaar EEN vorm, hier. Wat er niet in staat, gaat ook nergens naar buiten:
   dat is de reden dat dit een aparte plek verdient en geen kopieerwerk. */
'use strict';

module.exports = () => {
  const publiek = (n) => ({ id: n.id, kenmerk: n.kenmerk, code: n.code, zaak: n.zaak, periode: n.periode,
    grondslagCenten: n.grondslagCenten, aangegevenCenten: n.aangegevenCenten, naheffingCenten: n.naheffingCenten,
    boetePct: n.boetePct, boeteCenten: n.boeteCenten, boeteGrond: n.boeteGrond,
    totaalCenten: n.naheffingCenten + n.boeteCenten + (n.kostenCenten || 0), aanleiding: n.aanleiding,
    status: n.status, opgemaaktDoor: n.opgemaaktDoor, opgemaaktOp: n.opgemaaktOp,
    vastgesteldDoor: n.vastgesteldDoor || null, vastgesteldOp: n.vastgesteldOp || null,
    vervaltOp: n.vervaltOp || null, ingetrokkenDoor: n.ingetrokkenDoor || null, reden: n.reden || null,
    betaaldOp: n.betaaldOp || null, betaalCenten: n.betaalCenten || 0, terugbetaaldOp: n.terugbetaaldOp || null,
    kostenCenten: n.kostenCenten || 0, aanmaningOp: n.aanmaningOp || null, dwangbevelOp: n.dwangbevelOp || null,
    beslagOp: n.beslagOp || null, beslagCenten: n.beslagCenten || 0, regeling: n.regeling || null,
    invorderingGestopt: n.invorderingGestopt || null,
    openstaandCenten: Math.max(0, n.naheffingCenten + n.boeteCenten + (n.kostenCenten || 0) - (n.betaalCenten || 0)),
    bezwaar: n.bezwaar ? { reden: n.bezwaar.reden, at: n.bezwaar.at, besluit: n.bezwaar.besluit || null,
      motivering: n.bezwaar.motivering || null, door: n.bezwaar.door || null } : null });

  return { publiek };
};
