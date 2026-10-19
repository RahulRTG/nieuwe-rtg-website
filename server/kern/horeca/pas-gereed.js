/* Horeca (kern): DE PAS, deel "gereed" -- de werklijst van de pas en de bar.
   Afgesplitst uit ./pas.js: dat bestand gaat over CLAIMEN (oppakken, loslaten,
   overnemen, uitgeven), dit over KIJKEN -- welke gang compleet klaar staat en
   wie hem heeft. Het leest de claims met claimsKijk en legt dus niets aan.
   Punt 1 en 5 uit de kop van ./pas.js gelden hier. */
'use strict';

module.exports = ({ claimsKijk, minutenSinds, gezelschap }) => {
  /* Alles wat compleet klaar staat, over de hele zaak. Dit is de werklijst van
     de pas en van de bar; welk station het is, staat op de borden zelf. */
  return function gereed(h) {
    const uit = [];
    for (const rek of Object.values(h.rekeningen || {})) {
      if (rek.status !== 'open' && rek.status !== 'betaald') continue;
      const perGang = new Map();
      for (const r of (rek.regels || [])) {
        if (!r.vrijAt || r.stand === 'uitgegeven') continue;
        const k = String(r.gang || 0);
        if (!perGang.has(k)) perGang.set(k, []);
        perGang.get(k).push(r);
      }
      for (const [gang, regels] of perGang) {
        // punt 1: een half klare gang is geen taak
        if (!regels.every((r) => r.stand === 'klaar')) continue;
        const c = claimsKijk(rek)[gang] || null;
        /* Compleet sinds het LAATSTE bord klaar was -- dat is het moment waarop
           er iets te dragen viel. Het eerste bord staat dan al langer, en dat
           getal staat op het regiescherm (staat-koud); hier gaat het over de
           gang als geheel. */
        const compleetAt = regels.reduce((laatste, r) =>
          !r.klaarAt ? laatste : (!laatste || r.klaarAt > laatste ? r.klaarAt : laatste), null);
        uit.push({
          rekeningId: rek.id, tafel: rek.tafel || rek.kanaal, kanaal: rek.kanaal,
          gang: Number(gang), borden: regels.length,
          serveerOm: regels.map((r) => r.serveerOm).find(Boolean) || null,
          gereedSinds: minutenSinds(compleetAt),
          stations: [...new Set(regels.map((r) => r.station || 'warm'))],
          allergieen: [...new Set(regels.map((r) => r.allergie).filter(Boolean))],
          /* Waar elk bord heen moet. De runner draagt vier borden en heeft aan
             "gastNr 3" niets; de stoel draagt hier zijn naam. */
          regels: regels.map((r) => ({ regelId: r.id, naam: r.naam, aantal: r.aantal,
            station: r.station || 'warm', allergie: r.allergie || null,
            stoel: gezelschap.handleVan(rek, r.gastNr) })),
          claim: c ? { naam: c.naam, staffId: c.staffId, minuten: minutenSinds(c.at),
            overgenomenVan: c.overgenomenVan || null } : null
        });
      }
    }
    /* Wat het langst klaar staat, bovenaan. Niet de duurste tafel en niet
       tafel 1: eten dat staat te wachten wordt koud, en dat is het enige waar
       op deze lijst tijd doorheen loopt. */
    return uit.sort((a, b) => b.gereedSinds - a.gereedSinds);
  };
};
