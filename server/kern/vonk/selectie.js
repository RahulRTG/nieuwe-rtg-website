/* RTG Vonk, deelbestand "selectie": WIE ZIET WIE.

   De dagselectie is eindig (zes) en wederzijds: iemand komt alleen in beeld als
   hij bij uw wensen past EN u bij de zijne. Twee filters achter elkaar --
   pastBij voor de drie altijd-harde eisen (geslacht, leeftijd, afstand) en
   hardePoort voor de verplichte eisen uit de voorkeurstaal (../vonk/wensen) --
   en daarna een volgorde die het antwoord niet in gaat.

   Afgesplitst van ./index.js, dat de poort en het profiel houdt. Krijgt de
   gedeelde ctx, net als ./match. */
const W = require('./wensen');

module.exports = (ctx) => {
  const { d, mag, likeVan, matchTussen, haversine, publiek, DAG_MAX, rooster, tafelkaart } = ctx;

  /* AFSTAND IN KILOMETERS, of null als we het niet weten.

     lib/geo.haversine neemt TWEE PUNTEN ({lat,lng}) en geeft meters. Vonk riep
     hem lang aan met vier losse getallen; dan is `a.lat` undefined, geeft de
     meter keurig null terug -- en `null / 1000` is 0. Gevolg: de afstandsgrens
     filterde nooit iets, de volgorde negeerde afstand, en de tafel "rond het
     geografische midden" pakte de eerste zaak uit de lijst omdat `null < Infinity`
     waar is. Drie dingen stilletjes stuk door een aanroep die er goed uitzag.

     Daarom staat de omrekening nu op EEN plek, met de goede handtekening, en
     geeft hij null bij onbekend.

     Precies over wat null hier betekent, want dat verschilt per gebruiker:
     in pastBij en in de volgorde betekent onbekend "filtert niet mee" -- wie
     geen plaats opgaf, valt niet weg en wordt ook niet vooruit geschoven. In
     tafelInHetMidden (./match) is null wel het verschil, want dáár WON een
     onbekende afstand van elke bekende. Dat was de echte fout. */
  function km(a, b) {
    if (![a && a.lat, a && a.lng, b && b.lat, b && b.lng].every(v => isFinite(v))) return null;
    const m = haversine({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
    return m == null ? null : m / 1000;
  }

  /* ---- profiel en wensen (alles op codenaam; alleen de stad is zichtbaar) ---- */

  function pastBij(a, b) { // valt b binnen de wensen van a?
    if (!a.zoekt.includes(b.geslacht)) return false;
    if (b.leeftijd < a.leeftijdMin || b.leeftijd > a.leeftijdMax) return false;
    const afstand = km(a, b);
    if (afstand != null && afstand > a.maxKm) return false;
    return true;
  }
  const hardePoort = (a, b) => !W.botst(a, b) && !W.botst(b, a);
  function selectie(key) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const ik = d().profielen[key];
    if (!ik) return { status: 200, profiel: null, mensen: [], uitleg: 'Maak eerst uw profiel; daarna stelt Vonk elke dag een kleine selectie voor.' };
    /* `orde` bepaalt alleen de VOLGORDE en gaat het antwoord niet in. Er komt
       geen cijfer op een mens te staan -- ONTMOETEN.md par. 4.4. */
    const basis = Object.entries(d().profielen)
      .filter(([k, p]) => k !== key && p.actief !== false
        && !ik.blokkade.includes(k) && !(p.blokkade || []).includes(key)
        && pastBij(ik, p) && pastBij(p, ik)
        && !likeVan(key, k) && !matchTussen(key, k));
    const door = basis.filter(([, p]) => hardePoort(ik, p));
    const wegDoorEis = basis.length - door.length;   // wat de harde eisen ECHT weghaalden
    const mensen = door
      .map(([k, p]) => ({ k, p, orde: W.weegt(ik, p) * 100
        + (p.interesses || []).filter(i => ik.interesses.includes(i)).length * 10
        - (km(ik, p) || 0) / 10 }))
      .sort((x, y) => y.orde - x.orde)
      .slice(0, DAG_MAX)
      .map(({ k, p }) => ({ ...publiek(k, p), gemeen: (p.interesses || []).filter(i => ik.interesses.includes(i)),
        waarom: W.reden(ik, p) }));
    /* Een lege dag is een antwoord en geen storing (ONTMOETEN.md par. 3.5).

       De zin wijst de harde eisen alleen aan als die WERKELIJK iemand hebben
       weggehaald -- niet zodra het lid er toevallig een heeft staan. Anders
       kreeg iemand wiens dag leeg was door de afstand te horen dat het aan zijn
       voorkeuren lag, en dan verandert hij het verkeerde. Elk oordeel noemt zijn
       eigen bron, ook dit kleine. */
    const leeg = mensen.length ? null
      : wegDoorEis ? 'Vandaag geen nieuwe Vonk. Niemand voldeed aan wat u het belangrijkst noemde.'
        : 'Vandaag geen nieuwe Vonk. Morgen kijken we weer.';
    return { status: 200, profiel: publiek(key, ik, true), mensen, tabel: W.tabel(), rooster: rooster(), tafelkaart: tafelkaart(), leeg,
      /* Wat er NIET meeweegt hoort bij de uitleg: dat is precies het vertrouwen
         dat een datingapp normaal niet geeft (ONTMOETEN.md par. 3.2). */
      nietGebruikt: ['politieke voorkeur', 'inkomen', 'populariteit'],
      uitleg: 'Een kleine selectie per dag, wederzijds passend bij de wensen; morgen weer nieuwe mensen.' };
  }

  return { vonkSelectie: selectie };
};
