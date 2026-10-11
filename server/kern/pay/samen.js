/* BETALEN UIT MEERDERE POTJES: de SAMENSTELLING -- welk deel uit welk potje.

   Sinds een lid ook een maaltijdbudget of een gemeentetegoed kan hebben, is een
   betaling van 72 euro soms 25 + 12 + 35. Het lid hoort daar niets van te
   merken behalve de regel "€ 72 betaald" en, als hij doorklikt, waaruit.

   DIT BESTAND BOEKT NIETS MEER. Hier stond ook `betaalUit`: de samenstelling
   uitvoeren, met de eigen wallet EERST bijladen (zorgSaldo) en DAARNA boeken.
   Dat is de oude volgorde die de geldketen (G1-G4) heeft omgedraaid -- eerst
   boeken, dan dekken, met een economische sleutel per deel (./dekking.js,
   ./kas-boek.js) -- en `betaalUit` had geen enkele aanroeper meer: niet in
   server/, scripts/, test/ of public/. Een tweede, oudere betaalweg die niemand
   gebruikt maar die wel in de ctx stond, is precies de deur waar de volgende
   wijziging zich op vergist. Hij is daarom weg in plaats van omgebouwd. Wie de
   delen uitvoert: ./kas-boek.js (betaalDelen), langs boekAsync en dus langs de
   waardepoort -- ook de delen die uit een budget komen.

   Wat hier blijft: `stelSamen` (vraagt de samenstelling aan kern/waarde) en
   `dagBestedVan` (wat ging er vandaag al van een positie af, voor een
   daglimiet in het beleid).

   Krijgt de gedeelde ctx van kern/pay/index.js. */
module.exports = (ctx) => {
  /* De tijd uit de ctx van de paylaag. Het dagvenster hieronder bepaalt welke
     boekingen als 'vandaag' tellen voor een daglimiet; met een klok aan het OS
     is een middernachtproef niet te doen. */
  const { grootboek, rekLid, saldoVan, waarde, nu } = ctx;

  /* Wat is er vandaag al van deze positie afgegaan? Zonder dit getal is een
     dagmaximum in het beleid een regel die nooit bijt -- en een regel die nooit
     bijt, is erger dan geen regel, want er staat wel een belofte tegenover. */
  function dagBestedVan(rek) {
    const dag = new Date(nu()).toISOString().slice(0, 10);
    let som = 0;
    for (const r of grootboek()) {
      if (r.van !== rek) continue;
      if (new Date(r.at || 0).toISOString().slice(0, 10) !== dag) break; // het grootboek is nieuwste-eerst
      if (r.soort === 'terug') continue;
      som += r.centen;
    }
    return som;
  }

  /* De samenstelling opvragen. Zonder waardelaag is er per definitie één potje
     en is dit exact wat er altijd gebeurde: alles uit de eigen wallet. */
  function stelSamen({ codenaam, centen, genre, ontvanger, soort }) {
    if (!waarde) return { ok: true, delen: [{ rek: rekLid(codenaam), centen: Math.round(Number(centen)), eigen: true }] };
    return waarde.samenstellen({ codenaam, centen, genre, ontvanger, soort,
      saldoVan, dagBestedVan, nu: nu() });
  }

  return { dagBestedVan, stelSamen };
};
