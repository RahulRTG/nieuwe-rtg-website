/* RTG Mall, deelbestand "vestigingen": EEN ZAAK OP MEER DAN EEN PLEK.

   Een bakker met drie filialen, een keten met twintig, een franchise waarvan
   elke vestiging een eigen ondernemer is. Tot nu toe had een zaak precies EEN
   stad, en dat betekende dat de vestiging in Haarlem onvindbaar was zodra het
   hoofdadres in Amsterdam stond.

   ================== EEN RIJ, MEER PLEKKEN ==================

   De verleiding is om per vestiging een kopie van het aanbod te maken. Dat is
   fout op twee manieren: de zoeklijst raakt vol met hetzelfde brood, en elke
   prijswijziging moet dan op twintig plaatsen landen (LAT-regel 4). Hier blijft
   het EEN aanbod-object, met een lijst plekken erbij. De zoeklaag doet dan drie
   dingen anders:

     bedient()    raak als EEN van de vestigingen de gezochte plek bedient
     afstandTot() de afstand tot de DICHTSTBIJZIJNDE vestiging
     plekkenUit() de zaak telt mee in elke stad waar zij een vestiging heeft

   ================== WAT DIT NIET OPLOST ==================

   Een keten waarvan de filialen verschillende prijzen, voorraden of
   openingstijden hebben, is hiermee NIET gemodelleerd. Dit zegt "wij zijn ook
   in Haarlem", niet "in Haarlem kost het minder". Die stap vraagt om voorraad
   en agenda per vestiging, en dat is een verbouwing in de Supplier OS zelf --
   niet iets om er in een leeslaag bij te fantaseren. Daarom komt bij elk aanbod
   van een zaak met meer vestigingen `perVestiging: false` mee: het scherm kan
   dan zeggen dat prijs en voorraad van de zaak als geheel zijn.

   FRANCHISE. Waar elke vestiging een eigen ondernemer is, hoort zij een eigen
   zaak te zijn met een eigen code -- dat is geen vestiging maar een bedrijf.
   Deze lijst is voor filialen van EEN zaak. */

const MAX_VESTIGINGEN = 40;

/* De vestigingen van een zaak, als plek-objecten. De hoofdvestiging (het adres
   van de zaak zelf) staat altijd voorop: die is er altijd, ook als er geen
   lijst is ingevuld. */
function vestigingenVan(s, plekVan) {
  const hoofd = plekVan({ stad: s.city, land: s.country, punt: s.loc, label: (s.loc || {}).label });
  const rij = Array.isArray(s.vestigingen) ? s.vestigingen.slice(0, MAX_VESTIGINGEN) : [];
  const extra = rij
    .map(v => plekVan({ stad: v.stad || v.city, land: v.land || v.country, punt: v.loc || v.punt, label: v.naam || v.label }))
    .filter(p => p.slug && p.slug !== hoofd.slug);
  return [hoofd, ...extra];
}

/* Bedient een van de vestigingen deze plek? `bedientEen` is de gewone regel van
   ./plek.js, hier per vestiging toegepast -- er wordt geen tweede afstandsregel
   naast gezet. */
function bedientVanaf(a, doel, bedientEen) {
  const plekken = a.vestigingen && a.vestigingen.length ? a.vestigingen : [a.plek];
  return plekken.some(p => bedientEen({ plek: p, bereik: a.bereik }, doel));
}

// de afstand tot de dichtstbijzijnde vestiging; null als geen enkele te meten is
function afstandVanaf(a, punt, meet) {
  const plekken = a.vestigingen && a.vestigingen.length ? a.vestigingen : [a.plek];
  let beste = null;
  for (const p of plekken) {
    const d = meet({ plek: p }, punt);
    if (d != null && (beste == null || d < beste)) beste = d;
  }
  return beste;
}

module.exports = { vestigingenVan, bedientVanaf, afstandVanaf, MAX_VESTIGINGEN };
