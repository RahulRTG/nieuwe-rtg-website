/* RTG Mall, deelbestand "zoekhome": DE PLEKKENLIJST EN DE VOORPAGINA.

   Afgesplitst uit ./zoek.js toen dat bestand na de kaart-, land- en
   filterlagen tegen de tienkilobytegrens aan liep. De naad zat er al: zoek.js
   beantwoordt een zoekvraag, dit bestand beantwoordt twee vragen die daarvoor
   komen -- waar kan ik kijken, en wat staat daar.

   Allebei zijn ze projecties over dezelfde zoeklaag; er wordt hier niets
   opnieuw gefilterd of gerangschikt. */

module.exports = (ctx, hulp) => {
  const { aanbodAlles } = ctx;
  const { zoek, plekkenUit, P } = hulp;

  // de plekken waar iets te doen is, met hun aantal
  function plekken() {
    const { aanbod, stuk } = aanbodAlles();
    return { ok: true, plekken: plekkenUit(aanbod), landbron: P.landbron(), stuk };
  }

  /* De Mall-home voor een plek. Bewust kort: de verdiepingen met wat er staat,
     een handvol dingen die vandaag kunnen, en wat er van leden zelf ligt.
     Geen oneindige lijst en geen kunstmatige urgentie -- "nog 1 beschikbaar!"
     staat er alleen als het waar is en uit de bron komt. */
  function home(opt = {}) {
    const d = zoek({ plek: opt.plek, punt: opt.punt, per: 60, pagina: 1 });
    const items = d.items;
    const partners = new Set(items.filter(a => a.aanbieder.code).map(a => a.aanbieder.code));
    return {
      ok: true,
      plek: d.plek, punt: d.punt,
      verdiepingen: d.perVerdieping,
      vandaag: items.filter(a => a.beschikbaar && a.beschikbaar.hard).slice(0, 6),
      marktplaats: items.filter(a => a.aanbieder.soort === 'particulier').slice(0, 4),
      reizen: items.filter(a => a.type === 'reis').slice(0, 4),
      partners: partners.size,
      totaal: d.totaal,
      stuk: d.stuk, geweigerd: d.geweigerd,
      opmerking: d.plek
        ? 'Alles van RTG in en om ' + d.plek.stad + '. Wie de aanbieder is staat bij elk aanbod; RTG staat niet garant voor wat een ander levert.'
        : 'Kies een plek om de Mall op jouw omgeving te zetten, of zoek meteen.'
    };
  }

  return { mallPlekken: plekken, mallHome: home };
};
