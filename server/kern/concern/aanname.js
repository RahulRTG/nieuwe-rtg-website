/* CONCERN (deelmodule): DE BRUG VAN AANNAME NAAR DIENSTVERBAND.

   Besluit 1 van ARBEID.md par. 7a (23 september 2026): het dienstverband aan
   een ENTITEIT is de waarheid over een werkrelatie. De werving eindigde tot nu
   toe bij een personeelsnummer aan een ZAAK (staffId), en er ontstond geen
   employment -- de Adamproef schakel 16 wees het aan: het lid stond in het team,
   had een contract, en /api/concern/mijnwerk zei "U heeft nog geen werkplek".

   DE BRUG LOOPT EEN KANT OP, in de vorm van kern/mobiliteit/appbrug.js: een
   aanname maakt een dienstverband, en een dienstverband maakt nooit een
   personeelsplek. Twee lijsten die elkaar bijwerken hebben geen waarheid meer.

   DE ZAAK WIJST DE ENTITEIT AAN, EN ALLEEN DE ZAAK. Een zaak is een operating
   unit op een vestiging (./vestiging.js), en die vestiging hoort bij precies een
   entiteit. Hangt de zaak nergens aan, dan is er geen werkgever om iemand in
   dienst van te nemen -- dat wordt niet geraden en niet verzonnen, en de uitslag
   zegt het met de weg eromheen. Een aanname die daardoor geen dienstverband
   krijgt, gaat gewoon door: de brug mag geen aanname weigeren die gisteren nog
   lukte (dezelfde regel als de ritbrug).

   `persoon` is de ledensleutel, dezelfde die /api/concern/mijnwerk en
   uitnodigingAccepteer() gebruiken. Die komt van de aanroeper uit een
   geverifieerd account en nooit uit een verzoek. */
'use strict';

module.exports = (ctx) => {
  const { vestigingVanUnit, employmentNieuw } = ctx;

  function dienstverbandUitAanname({ zaak, persoon, rol } = {}) {
    if (!persoon) return { gemaakt: false, reden: 'Zonder eigen RTG-account is er niemand om in dienst te nemen.' };
    const v = vestigingVanUnit(zaak);
    if (!v) return { gemaakt: false,
      reden: 'Deze zaak hangt aan geen vestiging van een entiteit, dus er is geen werkgever om een dienstverband bij te maken.',
      hoe: 'Koppel de zaak in RTG Concern aan een vestiging (/api/concern/vestiging/zaak); daarna krijgt elke aanname ook een dienstverband.' };
    if (v.gesloten) return { gemaakt: false, reden: 'De vestiging van deze zaak is gesloten.' };
    const r = employmentNieuw({ persoon, entiteit: v.entiteit, vestiging: v.id,
      rol: String(rol || '').trim() || 'Medewerker' });
    if (r && r.ok) return { gemaakt: true, employment: r.employment.id, entiteit: v.entiteit, vestiging: v.id };
    /* Dezelfde rol bij dezelfde werkgever loopt al: dat is geen fout, en er komt
       geen tweede bij. */
    if (r && r.status === 409 && r.employment)
      return { gemaakt: false, bestond: true, employment: r.employment.id, reden: r.error };
    return { gemaakt: false, reden: (r && r.error) || 'Het dienstverband kon niet worden gemaakt.' };
  }

  return { dienstverbandUitAanname };
};
