/* RTG Mall, deelbestand "lijsttonen": EEN LIJST TEGEN HET LEVENDE AANBOD.

   Afgesplitst uit ./lijsten.js toen dat bestand na de bewaarlaag tegen de
   tienkilobytegrens aan liep. De naad zat er al: lijsten.js beheert de lijsten
   (maken, wijzigen, regels toevoegen), dit bestand koppelt ze aan wat er NU in
   de Mall staat.

   Dat verschil is de reden dat het los kan: het beheer werkt op de bewaarde rij
   en dit werkt op het levende aanbod. Wat er niet meer is, vervalt zichtbaar met
   de reden erbij -- stilweg verdwijnen laat iemand zoeken naar iets waarvan hij
   zeker weet dat hij het had bewaard. */

module.exports = (ctx, hulp) => {
  const { vind, REIS_ONDERDELEN } = hulp;

  /* De lijst zoals het lid hem ziet: elke regel gekoppeld aan het LEVENDE
     aanbod. Wat er niet meer is, vervalt zichtbaar; wat duurder of goedkoper
     is geworden krijgt het verschil erbij, want dat is de reden dat je iets
     bewaart. */
  function toon(key, id) {
    const l = vind(key, id);
    if (!l) return { status: 404, error: 'Lijst niet gevonden.' };
    const levend = new Map(ctx.aanbodAlles().aanbod.map(a => [a.id, a]));
    const regels = l.regels.map(r => {
      const a = levend.get(r.aanbodId);
      if (!a) return { ...r, vervallen: true, reden: 'Dit aanbod staat niet meer in de Mall.' };
      const nuPrijs = a.prijs ? a.prijs.bedrag : null;
      const verschil = (r.prijsBijBewaren != null && nuPrijs != null && nuPrijs !== r.prijsBijBewaren)
        ? Math.round((nuPrijs - r.prijsBijBewaren) * 100) / 100 : null;
      return { ...r, vervallen: false, aanbod: a, prijsVerschil: verschil };
    });
    const uit = { ok: true, lijst: { ...l, regels }, aantal: regels.length,
      vervallen: regels.filter(r => r.vervallen).length };
    if (l.soort === 'reis') uit.reis = reisbeeld(l, regels);
    return uit;
  }

  /* Wat er in een reis nog ontbreekt. Een geheugensteun met vier vakjes, geen
     verkoopmotor: er staat wat er staat en wat er niet staat, zonder aandrang
     en zonder aanbevelingen die toevallig het duurst zijn. */
  function reisbeeld(l, regels) {
    const aanwezig = new Set(regels.filter(r => !r.vervallen).map(r => r.type));
    return {
      plek: l.plek, van: l.van, tot: l.tot,
      onderdelen: REIS_ONDERDELEN.map(o => ({
        id: o.id, label: o.label,
        heeft: o.typen.some(t => aanwezig.has(t))
      })),
      opmerking: 'Een reis boek je niet in een keer: elke regel gaat naar de partij die hem levert, met zijn eigen bevestiging.'
    };
  }

  return { toon };
};
